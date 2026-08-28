// Deutsche Zahlen- und Trennzeichenformate. Zwei Stellen brauchen
// dasselbe: der Kassenimport liest Beträge aus einer CSV, die
// Belegerkennung liest sie aus dem Text eines Fotos. Zwei Implementierungen
// wären zwei Gelegenheiten, Cent zu verlieren.

/**
 * Deutsche Betragsschreibweise in Cent. `1.234,56` und `1234.56` meinen
 * dasselbe; entscheidend ist das *letzte* Trennzeichen, weil der Punkt
 * hierzulande die Tausender gruppiert und im Ausland die Nachkommastelle
 * einleitet.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const separator = Math.max(lastComma, lastDot);

  let whole = cleaned;
  let fraction = "";

  // Nur ein Trennzeichen mit genau ein bis zwei Stellen dahinter ist eine
  // Nachkommastelle. `1.234` sind Tausender, `12.34` sind Cent.
  if (separator > -1) {
    const tail = cleaned.slice(separator + 1);
    if (/^\d{1,2}$/.test(tail)) {
      whole = cleaned.slice(0, separator);
      fraction = tail.padEnd(2, "0");
    }
  }

  const negative = whole.startsWith("-");
  const digits = whole.replace(/\D/g, "");
  if (!digits && !fraction) return null;

  const cents = Number(digits || "0") * 100 + Number(fraction || "0");
  return negative ? -cents : cents;
}

export type CsvDelimiter = ";" | "\t" | ",";

/**
 * Bestimmt das Feldtrennzeichen einer CSV.
 *
 * Semikolon und Tabulator sind eindeutig: in einem deutschen Kassenexport
 * ist das Komma das Dezimaltrennzeichen und kann deshalb kein Feldtrenner
 * sein. Erst wenn keines von beiden vorkommt, bleibt das Komma übrig - und
 * dann gilt der Punkt als Dezimaltrennzeichen, wie in englischen Exporten.
 */
export function detectCsvDelimiter(lines: readonly string[]): CsvDelimiter {
  const sample = lines.slice(0, 5);
  const occurrences = (character: string): number =>
    sample.reduce((total, line) => total + line.split(character).length - 1, 0);

  if (occurrences(";") > 0) return ";";
  if (occurrences("\t") > 0) return "\t";
  return ",";
}

/** Zerlegt eine Zeile am erkannten Trennzeichen und trimmt die Zellen. */
export function splitCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  return line.split(delimiter).map((cell) => cell.trim());
}
