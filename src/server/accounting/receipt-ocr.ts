import "server-only";

import path from "node:path";

// Texterkennung fuer abfotografierte Belege. Laeuft mit tesseract.js im
// eigenen Prozess - kein Fremdanbieter, kein Schluessel, und die Fotos
// der Lieferantenrechnungen verlassen den Server nicht.
//
// Die Sprachdatei liegt im Repository unter `tessdata/`. Ohne sie wuerde
// tesseract.js sie beim ersten Aufruf aus dem Netz nachladen - in einem
// Container ohne ausgehende Verbindung bliebe der erste Belegscan sonst
// haengen, statt sauber zu scheitern.
const TESSDATA_DIRECTORY = path.join(process.cwd(), "tessdata");

const LANGUAGE = "deu";

// Ein Beleg ist ein Blatt Papier, keine Bildergalerie: mehr als das
// braucht kein Foto, und der Aufruf soll nicht minutenlang laufen.
export const MAX_IMAGE_BYTES = 6_000_000;
const RECOGNIZE_TIMEOUT_MS = 45_000;

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
] as const;

export type ReceiptScan =
  | { kind: "OK"; confidence: number; text: string }
  | { kind: "UNAVAILABLE"; reason: string };

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{
    data: { confidence: number; text: string };
  }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

// Ein Worker traegt rund 20 MB Modell im Speicher; er wird deshalb
// wiederverwendet. Nach einer Ruhephase gibt er den Speicher wieder ab,
// weil ein Laden vielleicht dreimal am Tag einen Beleg scannt.
const IDLE_SHUTDOWN_MS = 120_000;
let idleTimer: NodeJS.Timeout | null = null;

// tesseract.js verarbeitet je Worker genau ein Bild; parallele Aufrufe
// wuerden sich gegenseitig die Antwort wegnehmen. Deshalb eine Kette.
let queue: Promise<unknown> = Promise.resolve();

// Ein Belegscan bindet einen Kern fuer rund eine halbe Sekunde. In der
// oeffentlichen Demo kann jeder ihn ausloesen - ohne Deckel wuerde eine
// Handvoll gleichzeitiger Aufrufe alle anderen minutenlang warten
// lassen. Wer keinen Platz bekommt, erfaehrt das sofort.
const MAX_QUEUE_DEPTH = 4;
let waiting = 0;

async function getWorker(): Promise<TesseractWorker> {
  workerPromise ??= (async () => {
    const { createWorker } = await import("tesseract.js");
    return (await createWorker(LANGUAGE, 1, {
      cachePath: TESSDATA_DIRECTORY,
      // Ohne eigene Ausgabe schreibt tesseract.js seinen Fortschritt in
      // die Serverkonsole.
      logger: () => {},
    })) as unknown as TesseractWorker;
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

function scheduleShutdown(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const pending = workerPromise;
    workerPromise = null;
    idleTimer = null;
    void pending?.then((worker) => worker.terminate()).catch(() => {});
  }, IDLE_SHUTDOWN_MS);
  idleTimer.unref?.();
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Die Texterkennung hat zu lange gebraucht.")),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Liest den Text eines Belegfotos. Scheitert nie hart: kann die
 * Texterkennung nicht starten, kommt `UNAVAILABLE` zurueck und der Beleg
 * wird trotzdem abgelegt - nur eben mit leerem Formular.
 */
export async function readReceiptText(image: Buffer): Promise<ReceiptScan> {
  if (image.byteLength === 0) {
    return { kind: "UNAVAILABLE", reason: "Die Datei ist leer." };
  }
  if (image.byteLength > MAX_IMAGE_BYTES) {
    return {
      kind: "UNAVAILABLE",
      reason: "Das Bild ist größer als 6 MB.",
    };
  }

  if (waiting >= MAX_QUEUE_DEPTH) {
    return {
      kind: "UNAVAILABLE",
      reason:
        "Gerade werden mehrere Belege gelesen. Bitte in einem Moment erneut versuchen.",
    };
  }

  waiting += 1;
  const run = queue.then(async () => {
    const worker = await getWorker();
    return withTimeout(worker.recognize(image), RECOGNIZE_TIMEOUT_MS);
  });
  // Die Kette darf nicht an einem Fehlschlag zerbrechen.
  queue = run.catch(() => undefined);

  try {
    const { data } = await run;
    scheduleShutdown();
    return { confidence: data.confidence, kind: "OK", text: data.text };
  } catch (error) {
    console.error("Die Texterkennung des Belegs ist fehlgeschlagen.", error);
    return {
      kind: "UNAVAILABLE",
      reason:
        "Der Text konnte nicht gelesen werden. Bitte die Felder von Hand ausfüllen.",
    };
  } finally {
    waiting -= 1;
  }
}
