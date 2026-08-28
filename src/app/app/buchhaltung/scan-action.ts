"use server";

import { z } from "zod";
import {
  type ExtractedInvoice,
  extractInvoiceFields,
} from "@/lib/invoice-extraction";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  MAX_IMAGE_BYTES,
  readReceiptText,
  SUPPORTED_IMAGE_TYPES,
} from "@/server/accounting/receipt-ocr";

export type ReceiptScanState = {
  /** Das Foto als data-URL, damit es beim Speichern mitgeht. */
  image?: string;
  extracted?: ExtractedInvoice;
  message?: string;
  status: "idle" | "error" | "scanned" | "unreadable";
};

// Das Bild kommt als data-URL aus dem Browser - dieselbe Form, in der
// schon Logo und Headerbild der Ladenseite gespeichert werden. Die
// Obergrenze liegt unter dem Limit fuer Server Actions (3 MB), weil eine
// data-URL rund ein Drittel groesser ist als die Rohdaten.
const dataUrlSchema = z
  .string()
  .max(2_600_000, "Das Bild ist zu groß. Bitte erneut fotografieren.")
  .refine(
    (value) => /^data:image\/(jpeg|png|webp|bmp);base64,[A-Za-z0-9+/=]+$/.test(value),
    "Nur Fotos (JPG, PNG, WebP) werden gelesen.",
  );

function decodeDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } {
  const comma = dataUrl.indexOf(",");
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
  return {
    bytes: Buffer.from(dataUrl.slice(comma + 1), "base64"),
    mimeType,
  };
}

/**
 * Liest ein abfotografiertes Beleg-Foto und liefert die erkannten Felder
 * zurueck - gespeichert wird hier noch nichts. Erst bestaetigt die
 * Person die Werte im Formular, dann geht der regulaere Speicherweg.
 */
export async function scanReceiptAction(
  _state: ReceiptScanState,
  formData: FormData,
): Promise<ReceiptScanState> {
  // Nur wer den Bereich sehen darf, darf auch die Texterkennung
  // beschaeftigen - sie kostet spuerbar Rechenzeit.
  await requireActiveOrganizationPage("/app/buchhaltung");

  const parsed = dataUrlSchema.safeParse(String(formData.get("image") ?? ""));
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Das Foto ist unbrauchbar.",
      status: "error",
    };
  }

  const { bytes, mimeType } = decodeDataUrl(parsed.data);
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
    return { message: "Dieses Bildformat wird nicht gelesen.", status: "error" };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { message: "Das Bild ist größer als 6 MB.", status: "error" };
  }

  const scan = await readReceiptText(bytes);
  if (scan.kind === "UNAVAILABLE") {
    // Der Beleg bleibt trotzdem am Formular haengen: das Foto ist der
    // Nachweis, die Zahlen tippt die Person dann eben selbst.
    return { image: parsed.data, message: scan.reason, status: "unreadable" };
  }

  const extracted = extractInvoiceFields(scan.text);
  if (extracted.recognizedFields.length === 0) {
    return {
      image: parsed.data,
      message:
        "Auf dem Foto war nichts Verwertbares zu lesen. Bitte näher heran, gerade halten und für gutes Licht sorgen.",
      status: "unreadable",
    };
  }

  return {
    extracted,
    image: parsed.data,
    message: `${extracted.recognizedFields.length} Feld${extracted.recognizedFields.length === 1 ? "" : "er"} erkannt — bitte prüfen.`,
    status: "scanned",
  };
}
