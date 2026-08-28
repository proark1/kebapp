import { describe, expect, it } from "vitest";
import {
  centsToGermanAmount,
  toBookingLines,
  type BookingSourceInvoice,
} from "@/lib/booking-batch";

function invoice(
  overrides: Partial<BookingSourceInvoice> = {},
): BookingSourceInvoice {
  return {
    category: "FLEISCH",
    documentDate: "2026-08-26",
    invoiceNumber: "2026-1002",
    netCents7: 0,
    netCents19: 0,
    supplierName: "Anadolu Fleischhandel GmbH",
    ...overrides,
  };
}

describe("toBookingLines — ein Steuersatz", () => {
  it("bucht eine reine 7-%-Rechnung mit Schlüssel 2", () => {
    const [line, ...rest] = toBookingLines(invoice({ netCents7: 21_100 }));
    expect(rest).toHaveLength(0);
    expect(line).toMatchObject({
      grossCents: 22_577,
      netCents: 21_100,
      taxRatePercent: 7,
      vatKey: "2",
    });
  });

  it("bucht eine reine 19-%-Rechnung mit Schlüssel 3", () => {
    const [line, ...rest] = toBookingLines(invoice({ netCents19: 10_000 }));
    expect(rest).toHaveLength(0);
    expect(line).toMatchObject({
      grossCents: 11_900,
      netCents: 10_000,
      taxRatePercent: 19,
      vatKey: "3",
    });
  });

  it("schreibt das Belegdatum als JJJJMMTT", () => {
    expect(toBookingLines(invoice({ netCents7: 100 }))[0]?.bookingDate).toBe(
      "20260826",
    );
  });
});

describe("toBookingLines — gemischte Rechnung", () => {
  // Der Fehler, den diese Datei absichert: Ware zu 7 % und Verpackung zu
  // 19 % auf einem Beleg ergaben eine einzige Zeile mit dem vollen Brutto
  // und Schlüssel 3 — der Warenanteil wurde also mit 19 % verbucht.
  const lines = toBookingLines(
    invoice({ netCents19: 4_000, netCents7: 20_000 }),
  );

  it("erzeugt je Steuersatz eine eigene Zeile", () => {
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.vatKey)).toEqual(["2", "3"]);
  });

  it("weist jedem Anteil sein eigenes Brutto zu", () => {
    expect(lines[0]).toMatchObject({ grossCents: 21_400, netCents: 20_000 });
    expect(lines[1]).toMatchObject({ grossCents: 4_760, netCents: 4_000 });
  });

  it("ergibt in der Summe das Brutto der Rechnung", () => {
    const total = lines.reduce((sum, line) => sum + line.grossCents, 0);
    expect(total).toBe(Math.round(20_000 * 1.07) + Math.round(4_000 * 1.19));
  });

  it("trägt Beleg und Lieferant in beide Zeilen", () => {
    for (const line of lines) {
      expect(line.invoiceNumber).toBe("2026-1002");
      expect(line.supplierName).toBe("Anadolu Fleischhandel GmbH");
    }
  });
});

describe("toBookingLines — Randfälle", () => {
  it("erzeugt keine Zeile ohne Beträge", () => {
    expect(toBookingLines(invoice())).toEqual([]);
  });

  it("überspringt einen Steuersatz mit Betrag null", () => {
    expect(toBookingLines(invoice({ netCents19: 500, netCents7: 0 }))).toHaveLength(1);
  });

  it("verträgt eine fehlende Kategorie", () => {
    expect(
      toBookingLines(invoice({ category: null, netCents7: 100 }))[0]?.category,
    ).toBe("");
  });

  it("rundet auf ganze Cent", () => {
    // 3,33 EUR netto zu 19 % sind 3,9627 EUR brutto.
    expect(toBookingLines(invoice({ netCents19: 333 }))[0]?.grossCents).toBe(396);
  });
});

describe("centsToGermanAmount", () => {
  it("schreibt Cent mit Dezimalkomma", () => {
    expect(centsToGermanAmount(84_250)).toBe("842,50");
    expect(centsToGermanAmount(700)).toBe("7,00");
    expect(centsToGermanAmount(0)).toBe("0,00");
  });
});
