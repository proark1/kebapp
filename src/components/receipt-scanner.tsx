"use client";

import { Camera, Check, ImageUp, RotateCcw, ScanLine } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import {
  scanReceiptAction,
  type ReceiptScanState,
} from "@/app/app/buchhaltung/scan-action";
import {
  centsToInputValue,
  type InvoiceCategory,
} from "@/lib/invoice-extraction";

// Ein Handyfoto hat 12 Megapixel. Fuer die Texterkennung reicht die
// lange Kante bei 2000 Pixeln - darueber wird die Erkennung langsamer,
// nicht besser, und das Bild passt nicht mehr durch die Server Action.
const MAX_EDGE_PIXELS = 2000;
const JPEG_QUALITY = 0.82;

const initialState: ReceiptScanState = { status: "idle" };

type Category = InvoiceCategory;

/**
 * Verkleinert das Foto im Browser und gibt es als data-URL zurueck.
 * Spart Uebertragung, haelt das Bild unter dem Limit fuer Server
 * Actions und liefert der Texterkennung ein handliches Format.
 */
async function prepareImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function RecognizedMark({ recognized }: { recognized: boolean }) {
  if (!recognized) return null;
  return (
    <span className="field-recognized" title="Aus dem Foto gelesen">
      <Check size={12} aria-hidden="true" />
      erkannt
    </span>
  );
}

export function ReceiptScanner({
  categories,
  createAction,
  today,
}: {
  categories: ReadonlyArray<{ label: string; value: Category }>;
  createAction: (formData: FormData) => Promise<void>;
  today: string;
}) {
  const [state, formAction, scanning] = useActionState(
    scanReceiptAction,
    initialState,
  );
  const [preparing, setPreparing] = useState(false);
  // Nur Fehler aus dem Browser selbst - was der Server meldet, steht in
  // `state` und wird beim Rendern gelesen statt in den State gespiegelt.
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const imageFieldRef = useRef<HTMLInputElement>(null);
  const scanFormRef = useRef<HTMLFormElement>(null);

  // Wechselt die Vorlage, muss das Formular die neuen Werte annehmen.
  // Ohne den Schluessel behielte React die alten Eingaben bei.
  const formKey = state.extracted
    ? `${state.extracted.invoiceNumber ?? ""}-${state.extracted.documentDate ?? ""}-${state.extracted.recognizedFields.join(",")}`
    : "leer";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalProblem(null);
    setPreparing(true);
    try {
      const dataUrl = await prepareImage(file);
      if (imageFieldRef.current) {
        imageFieldRef.current.value = dataUrl;
        scanFormRef.current?.requestSubmit();
      }
    } catch {
      setLocalProblem("Dieses Bild ließ sich nicht öffnen. Bitte erneut aufnehmen.");
    } finally {
      setPreparing(false);
    }
  };

  const extracted = state.extracted;
  const recognized = new Set(extracted?.recognizedFields ?? []);
  const busy = preparing || scanning;
  const problem =
    localProblem ?? (state.status === "error" ? (state.message ?? null) : null);

  return (
    <section className="panel receipt-scanner">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Beleg abfotografieren</span>
          <h2>Foto statt Abtippen</h2>
          <p>
            Beleg fotografieren — Lieferant, Nummer, Datum und die
            Nettobeträge je Steuersatz werden ausgelesen und hier
            eingetragen. Das Foto bleibt als Nachweis am Beleg. Die
            Erkennung läuft auf diesem Server, das Bild geht an keinen
            Fremdanbieter.
          </p>
        </div>
      </div>

      <form action={formAction} className="receipt-scanner__capture" ref={scanFormRef}>
        <input name="image" ref={imageFieldRef} type="hidden" />

        <label className="button button--primary sales-upload">
          <Camera size={18} aria-hidden="true" />
          {busy ? "Beleg wird gelesen …" : "Beleg fotografieren"}
          <input
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            type="file"
          />
        </label>

        <label className="button button--secondary sales-upload">
          <ImageUp size={18} aria-hidden="true" />
          Aus Galerie wählen
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            type="file"
          />
        </label>
      </form>

      {busy ? (
        <p className="receipt-scanner__status" role="status">
          <ScanLine size={16} aria-hidden="true" />
          {preparing ? "Foto wird vorbereitet …" : "Text wird gelesen …"}
        </p>
      ) : null}

      {problem ? (
        <p className="save-message save-message--error" role="alert">
          {problem}
        </p>
      ) : null}

      {!busy && state.status === "unreadable" ? (
        <p className="save-message save-message--neutral" role="status">
          {state.message}
        </p>
      ) : null}

      {!busy && state.status === "scanned" ? (
        <p className="save-message save-message--success" role="status">
          {state.message}
        </p>
      ) : null}

      {state.image ? (
        <div className="receipt-scanner__review">
          <figure className="receipt-scanner__preview">
            <Image
              alt="Aufgenommener Beleg"
              height={320}
              src={state.image}
              unoptimized
              width={240}
            />
            <figcaption>
              Wird mit der Rechnung gespeichert
              <button
                className="button button--quiet button--small"
                onClick={() => window.location.reload()}
                type="button"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Verwerfen
              </button>
            </figcaption>
          </figure>

          <form
            action={createAction}
            className="form-grid form-grid--two receipt-scanner__form"
            key={formKey}
          >
            <input name="receiptImage" type="hidden" value={state.image} />

            <label className="field">
              <span>
                Lieferant <RecognizedMark recognized={recognized.has("supplierName")} />
              </span>
              <input
                defaultValue={extracted?.supplierName ?? ""}
                maxLength={180}
                name="supplierName"
                placeholder="Fleischwerk Rheinland"
                required
              />
            </label>

            <label className="field">
              <span>
                Rechnungsnummer{" "}
                <RecognizedMark recognized={recognized.has("invoiceNumber")} />
              </span>
              <input
                defaultValue={extracted?.invoiceNumber ?? ""}
                maxLength={80}
                name="invoiceNumber"
                placeholder="2026-08-114"
                required
              />
            </label>

            <label className="field">
              <span>
                Datum <RecognizedMark recognized={recognized.has("documentDate")} />
              </span>
              <input
                defaultValue={extracted?.documentDate ?? today}
                name="documentDate"
                required
                type="date"
              />
            </label>

            <label className="field">
              <span>
                Fällig am <RecognizedMark recognized={recognized.has("dueDate")} />
              </span>
              <input
                defaultValue={extracted?.dueDate ?? ""}
                name="dueDate"
                type="date"
              />
            </label>

            <label className="field">
              <span>
                Netto 7 % in € <RecognizedMark recognized={recognized.has("netCents7")} />
              </span>
              <input
                defaultValue={centsToInputValue(extracted?.netCents7 ?? null)}
                min="0"
                name="net7"
                step="0.01"
                type="number"
              />
            </label>

            <label className="field">
              <span>
                Netto 19 % in €{" "}
                <RecognizedMark recognized={recognized.has("netCents19")} />
              </span>
              <input
                defaultValue={centsToInputValue(extracted?.netCents19 ?? null)}
                min="0"
                name="net19"
                step="0.01"
                type="number"
              />
            </label>

            <label className="field">
              <span>
                Kategorie <RecognizedMark recognized={recognized.has("category")} />
              </span>
              <select
                defaultValue={extracted?.category ?? "SONSTIGES"}
                name="category"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="receipt-scanner__footer">
              <button className="button button--primary" type="submit">
                <Check size={17} aria-hidden="true" />
                Geprüft und speichern
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
