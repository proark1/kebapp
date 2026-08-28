// Feldextraktion aus dem Text einer Lieferantenrechnung. Die Vorlage ist
// der Beleg, den jemand mit dem Telefon abfotografiert: die Texterkennung
// liefert eine Wand aus Zeilen, hier wird daraus ein Formular.
//
// Bewusst ohne Serverbindung und ohne Texterkennung im Modul: was
// hereinkommt, ist Text - egal ob aus einem Foto, einer PDF-Textebene
// oder eingefuegt. So laesst sich der schwierige Teil - die deutschen
// Zahlen-, Datums- und Steuerformate - ohne Bild und ohne Datenbank
// pruefen.

import { parseAmountToCents } from "@/lib/german-number";

export const invoiceCategories = [
  "FLEISCH",
  "GEMUESE",
  "TROCKEN",
  "GETRAENKE",
  "VERPACKUNG",
  "SONSTIGES",
] as const;

export type InvoiceCategory = (typeof invoiceCategories)[number];

export type ExtractedInvoice = {
  /** Felder, die im Text tatsaechlich gefunden wurden. */
  recognizedFields: string[];
  category: InvoiceCategory | null;
  documentDate: string | null;
  dueDate: string | null;
  grossCents: number | null;
  invoiceNumber: string | null;
  netCents7: number | null;
  netCents19: number | null;
  supplierName: string | null;
};

const EMPTY: ExtractedInvoice = {
  category: null,
  documentDate: null,
  dueDate: null,
  grossCents: null,
  invoiceNumber: null,
  netCents7: null,
  netCents19: null,
  recognizedFields: [],
  supplierName: null,
};

/**
 * Datum in ISO-Form. Erkannt werden `12.08.2026`, `12.8.26`, `2026-08-12`
 * und `12. August 2026`. Zweistellige Jahre gelten als 20xx - Belege aus
 * dem letzten Jahrhundert fotografiert niemand ab.
 */
export function parseGermanDate(raw: string): string | null {
  const text = raw.trim();

  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return buildIsoDate(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  const numeric = /(\d{1,2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{2,4})/.exec(text);
  if (numeric) {
    const year = Number(numeric[3]);
    return buildIsoDate(
      Number(numeric[1]),
      Number(numeric[2]),
      year < 100 ? 2000 + year : year,
    );
  }

  const named =
    /(\d{1,2})\.?\s+(Januar|Februar|M[aä]rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i.exec(
      text,
    );
  if (named) {
    const months = [
      "januar", "februar", "märz", "april", "mai", "juni",
      "juli", "august", "september", "oktober", "november", "dezember",
    ];
    const key = named[2]!.toLowerCase().replace("marz", "märz");
    const month = months.indexOf(key) + 1;
    if (month > 0) {
      return buildIsoDate(Number(named[1]), month, Number(named[3]));
    }
  }

  return null;
}

function buildIsoDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Faengt den 31. Februar ab, den die Texterkennung gelegentlich baut.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const AMOUNT_PATTERN = /-?\d{1,3}(?:[.\s]\d{3})*,\d{2}|-?\d+,\d{2}|-?\d{1,3}(?:,\d{3})+\.\d{2}|-?\d+\.\d{2}/g;

function amountsInLine(line: string): number[] {
  return (line.match(AMOUNT_PATTERN) ?? [])
    .map(parseAmountToCents)
    .filter((value): value is number => value !== null);
}

// Warengruppen eines Doenerladens. Reicht fuer die Vorauswahl - die
// Kategorie steht im Formular als Auswahlfeld und laesst sich aendern.
const CATEGORY_KEYWORDS: Array<[InvoiceCategory, RegExp]> = [
  [
    "FLEISCH",
    /\b(fleisch|kalb|rind|lamm|h[aä]hnchen|geflügel|gefluegel|hackfleisch|drehspie[sß]|dönerspie[sß]|doenerspie[sß]|metzger|schlachterei)\b/i,
  ],
  [
    "GEMUESE",
    /\b(gem[uü]se|salat|tomaten|gurken|zwiebeln|kraut|paprika|obst|kartoffel)\b/i,
  ],
  [
    "GETRAENKE",
    /\b(getr[aä]nke|cola|fanta|sprite|ayran|bier|wasser|limonade|saft|brauerei)\b/i,
  ],
  [
    "VERPACKUNG",
    /\b(verpackung|alufolie|servietten|becher|karton|beutel|t[uü]ten|einweg|menüschale|menueschale)\b/i,
  ],
  [
    "TROCKEN",
    /\b(mehl|reis|bulgur|gew[uü]rz|[oö]l|trockenware|zucker|salz|linsen|nudeln)\b/i,
  ],
];

export function guessCategory(text: string): InvoiceCategory | null {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

// Rechtsformen, an denen sich ein Firmenname sicher erkennen laesst.
const LEGAL_FORM =
  /\b(gmbh(\s*&\s*co\.?\s*kg)?|ug\s*\(haftungsbeschr[aä]nkt\)|ag|kg|ohg|gbr|e\.?\s?k\.?|e\.?\s?v\.?|mbh)\b/i;

const SUPPLIER_STOPWORDS =
  /\b(rechnung|lieferschein|beleg|quittung|kassenbon|seite|datum|kunde|kundennummer|steuernummer|ust-?id|iban|bic|telefon|e-?mail|www\.)/i;

/**
 * Der Lieferantenname steht im Briefkopf - fast immer in den ersten
 * Zeilen. Erste Wahl ist eine Zeile mit Rechtsform, zweite Wahl eine
 * ausdrueckliche Beschriftung, dritte Wahl die erste brauchbare Zeile.
 */
function findSupplier(lines: string[]): string | null {
  const labelled = lines.find((line) => /^(lieferant|verk[aä]ufer|firma)\s*[:\-]/i.test(line));
  if (labelled) {
    const value = labelled.split(/[:\-]/).slice(1).join(":").trim();
    if (value) return value.slice(0, 180);
  }

  const head = lines.slice(0, 12);
  const withLegalForm = head.find(
    (line) => LEGAL_FORM.test(line) && !SUPPLIER_STOPWORDS.test(line),
  );
  if (withLegalForm) return withLegalForm.slice(0, 180);

  const plausible = head.find(
    (line) =>
      line.length >= 3 &&
      line.length <= 80 &&
      /[A-Za-zÄÖÜäöüß]{3}/.test(line) &&
      !SUPPLIER_STOPWORDS.test(line) &&
      // Adresszeilen und reine Zahlenzeilen scheiden aus.
      !/^\d{4,5}\s/.test(line) &&
      !/\b(stra[sß]e|str\.|weg|platz|allee)\b\s*\d/i.test(line) &&
      (line.match(/\d/g) ?? []).length <= line.length / 3,
  );
  return plausible ? plausible.slice(0, 180) : null;
}

function findInvoiceNumber(lines: string[]): string | null {
  const patterns = [
    /(?:rechnungs-?\s?(?:nummer|nr\.?)|rg-?nr\.?|re-?nr\.?)\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/_.]{2,39})/i,
    /(?:beleg-?\s?(?:nummer|nr\.?))\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/_.]{2,39})/i,
    /\brechnung\s+(?:nr\.?|nummer)?\s*[:.\-]?\s*([A-Za-z0-9][A-Za-z0-9\-/_.]{2,39})/i,
  ];

  for (const pattern of patterns) {
    for (const line of lines) {
      const match = pattern.exec(line);
      const value = match?.[1]?.replace(/[.,;:]$/, "");
      // Ein reines Datum ist keine Rechnungsnummer.
      if (value && !/^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/.test(value)) {
        return value.slice(0, 80);
      }
    }
  }
  return null;
}

function findDate(lines: string[], labels: RegExp): string | null {
  for (const line of lines) {
    if (!labels.test(line)) continue;
    const parsed = parseGermanDate(line.replace(labels, " "));
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Steuersaetze. Auf deutschen Belegen steht mal der Nettobetrag je Satz,
 * mal nur der Steuerbetrag - beides fuehrt zum Netto, aber ueber
 * verschiedene Rechnungen. Unterschieden wird an den Worten der Zeile.
 */
function findNetByRate(lines: string[], rate: 7 | 19): number | null {
  const ratePattern = new RegExp(`\\b${rate}\\s*(?:,\\s*0+)?\\s*%`);
  let taxOnly: number | null = null;

  for (const line of lines) {
    if (!ratePattern.test(line)) continue;
    const amounts = amountsInLine(line);
    if (amounts.length === 0) continue;

    const mentionsTax = /(mwst|ust|umsatzsteuer|steuer)/i.test(line);
    const mentionsNet = /(netto|warenwert|zwischensumme|bemessung|entgelt)/i.test(line);

    // Zeilen wie "7 % MwSt aus 100,00 = 7,00" tragen beide Werte: der
    // groessere ist die Bemessungsgrundlage, der kleinere die Steuer.
    if (amounts.length >= 2 && (mentionsNet || !mentionsTax)) {
      return Math.max(...amounts);
    }

    if (mentionsNet && !mentionsTax) return amounts[0]!;
    if (mentionsTax) {
      taxOnly = amounts[amounts.length - 1]!;
      continue;
    }
    return amounts[0]!;
  }

  return taxOnly === null ? null : Math.round(taxOnly / (rate / 100));
}

function findGross(lines: string[]): number | null {
  const labels =
    /(gesamtbetrag|rechnungsbetrag|zahlbetrag|endbetrag|brutto|gesamtsumme|zu\s+zahlen)/i;
  for (const line of lines) {
    if (!labels.test(line)) continue;
    const amounts = amountsInLine(line);
    if (amounts.length > 0) return Math.max(...amounts);
  }
  return null;
}

/**
 * Zerlegt den Text einer Rechnung in Formularfelder. Alles, was nicht
 * sicher erkannt wird, bleibt `null` - geraten wird nicht, weil hinter
 * dem Formular die Umsatzsteuervoranmeldung haengt.
 */
export function extractInvoiceFields(text: string): ExtractedInvoice {
  if (!text || !text.trim()) return { ...EMPTY };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length === 0) return { ...EMPTY };

  const documentDate =
    findDate(lines, /\b(rechnungsdatum|belegdatum|ausstellungsdatum|datum)\b/i) ??
    findDate(lines, /\b(lieferdatum|leistungsdatum)\b/i);

  // "Fällig", "Faellig", "Fallig": Belege werden ohne Umlaute gesetzt,
  // und die Texterkennung verliest sie zusätzlich - beides muss treffen.
  const dueDate = findDate(
    lines,
    /\b(f(?:ä|ae|a)llig(?:keit|keitsdatum)?(?:\s*am)?|zahlbar\s+bis|zahlungsziel)\b/i,
  );

  let netCents7 = findNetByRate(lines, 7);
  let netCents19 = findNetByRate(lines, 19);
  const grossCents = findGross(lines);

  // Ein Beleg mit genau einem Steuersatz und ausgewiesener Bruttosumme
  // laesst sich auch dann aufloesen, wenn die Nettozeile fehlt - der
  // haeufigste Fall beim Kassenbon vom Grosshandel.
  if (netCents7 === null && netCents19 === null && grossCents !== null) {
    const hasSeven = lines.some((line) => /\b7\s*(?:,\s*0+)?\s*%/.test(line));
    const hasNineteen = lines.some((line) => /\b19\s*(?:,\s*0+)?\s*%/.test(line));
    if (hasSeven && !hasNineteen) netCents7 = Math.round(grossCents / 1.07);
    if (hasNineteen && !hasSeven) netCents19 = Math.round(grossCents / 1.19);
  }

  const extracted: ExtractedInvoice = {
    category: guessCategory(text),
    documentDate,
    dueDate: dueDate === documentDate ? null : dueDate,
    grossCents,
    invoiceNumber: findInvoiceNumber(lines),
    netCents7,
    netCents19,
    recognizedFields: [],
    supplierName: findSupplier(lines),
  };

  extracted.recognizedFields = (
    [
      ["supplierName", extracted.supplierName],
      ["invoiceNumber", extracted.invoiceNumber],
      ["documentDate", extracted.documentDate],
      ["dueDate", extracted.dueDate],
      ["netCents7", extracted.netCents7],
      ["netCents19", extracted.netCents19],
      ["category", extracted.category],
    ] as const
  )
    .filter(([, value]) => value !== null)
    .map(([field]) => field);

  return extracted;
}

/** Cent als Feldwert für ein `input[type=number]`: `12345` -> `123.45`. */
export function centsToInputValue(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2);
}
