// Kassenimport: taegliche Nettoumsaetze aus dem CSV-Export einer Kasse.
// Reine Zerlegung ohne Serverbindung - damit sich das Format ohne Datenbank
// pruefen laesst. Dieselbe Trennung wie bei src/lib/platform-import.ts.

import { z } from "zod";
import {
  detectCsvDelimiter,
  parseAmountToCents,
  splitCsvLine,
} from "@/lib/german-number";

export const salesRowSchema = z.object({
  businessDate: z.iso.date(),
  guestCount: z.coerce.number().int().min(0).max(10_000).optional(),
  netSalesCents: z.coerce.number().int().min(0),
});

export type SalesRowInput = z.input<typeof salesRowSchema>;

// 100.000 EUR Tagesumsatz als Obergrenze - darueber liegt kein Imbiss,
// wohl aber ein Tippfehler oder eine falsch zugeordnete Spalte.
const MAX_NET_SALES_CENTS = 100_000 * 100;

export class SalesCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesCsvError";
  }
}

export function parseSalesCsv(csvText: string): SalesRowInput[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  // Frueher wurde pauschal an `[;,\t]` getrennt. Deutsche Kassen schreiben
  // aber "842,50" - das Komma zerlegte den Betrag, "842" wurde zum Umsatz
  // und "50" zur Gaestezahl. Der Import meldete Erfolg, der Cent-Verlust je
  // Zeile fiel niemandem auf. Das Trennzeichen wird deshalb einmal fuer die
  // ganze Datei bestimmt.
  const delimiter = detectCsvDelimiter(lines);

  const rows: SalesRowInput[] = [];
  for (const [index, line] of lines.entries()) {
    const cells = splitCsvLine(line, delimiter);
    if (index === 0 && /datum/i.test(cells[0] ?? "")) continue;

    const date = z.iso.date().safeParse(cells[0]);
    if (!date.success) {
      throw new SalesCsvError(`Zeile ${index + 1}: ungültiges Datum.`);
    }

    const netSalesCents = parseAmountToCents(cells[1] ?? "");
    if (
      netSalesCents === null ||
      netSalesCents < 0 ||
      netSalesCents > MAX_NET_SALES_CENTS
    ) {
      throw new SalesCsvError(`Zeile ${index + 1}: ungültiger Umsatz.`);
    }

    let guestCount: number | undefined;
    if (cells[2]) {
      const guests = z.coerce
        .number()
        .int()
        .min(0)
        .max(10_000)
        .safeParse(cells[2]);
      if (!guests.success) {
        throw new SalesCsvError(`Zeile ${index + 1}: ungültige Gästezahl.`);
      }
      guestCount = guests.data;
    }

    rows.push({
      businessDate: date.data,
      guestCount,
      netSalesCents,
    });
  }
  return rows;
}
