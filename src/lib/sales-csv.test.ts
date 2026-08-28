import { describe, expect, it } from "vitest";
import { parseSalesCsv, SalesCsvError } from "@/lib/sales-csv";

// Der Kassenimport ist die einzige Quelle der Erlösseite. Alles, was hier
// still danebengeht, taucht erst beim Steuerberater wieder auf.

describe("parseSalesCsv — deutscher Kassenexport", () => {
  it("hält Cent und Gästezahl zusammen", () => {
    // Der Fehler, den diese Datei absichert: mit einer Trennung an
    // `[;,\t]` wurde aus "842,50;96" ein Umsatz von 842,00 EUR und eine
    // Gästezahl von 50 — ohne jede Fehlermeldung.
    expect(parseSalesCsv("2026-08-28;842,50;96")).toEqual([
      { businessDate: "2026-08-28", guestCount: 96, netSalesCents: 84_250 },
    ]);
  });

  it("liest eine Datei mit Kopfzeile", () => {
    const rows = parseSalesCsv(
      [
        "Datum;Umsatz;Gaeste",
        "2026-08-27;1.204,80;131",
        "2026-08-28;842,50;96",
      ].join("\n"),
    );
    expect(rows).toEqual([
      { businessDate: "2026-08-27", guestCount: 131, netSalesCents: 120_480 },
      { businessDate: "2026-08-28", guestCount: 96, netSalesCents: 84_250 },
    ]);
  });

  it("kommt mit Tausenderpunkt und Währungszeichen zurecht", () => {
    expect(parseSalesCsv("2026-08-28;1.204,80 €;131")[0]?.netSalesCents).toBe(
      120_480,
    );
  });

  it("liest tabulargetrennte Dateien", () => {
    expect(parseSalesCsv("2026-08-28\t842,50\t96")).toEqual([
      { businessDate: "2026-08-28", guestCount: 96, netSalesCents: 84_250 },
    ]);
  });

  it("liest kommagetrennte Dateien mit Dezimalpunkt", () => {
    expect(parseSalesCsv("2026-08-28,842.50,96")).toEqual([
      { businessDate: "2026-08-28", guestCount: 96, netSalesCents: 84_250 },
    ]);
  });

  it("kommt ohne Gästezahl aus", () => {
    expect(parseSalesCsv("2026-08-28;842,50")).toEqual([
      {
        businessDate: "2026-08-28",
        guestCount: undefined,
        netSalesCents: 84_250,
      },
    ]);
  });

  it("ignoriert Leerzeilen und Windows-Zeilenenden", () => {
    expect(
      parseSalesCsv("2026-08-27;100,00;10\r\n\r\n2026-08-28;200,00;20\r\n"),
    ).toHaveLength(2);
  });

  it("liefert eine leere Liste für leeren Text", () => {
    expect(parseSalesCsv("   \n \n")).toEqual([]);
  });
});

describe("parseSalesCsv — Fehler mit Zeilenangabe", () => {
  it("weist ein ungültiges Datum zurück", () => {
    expect(() => parseSalesCsv("28.08.2026;842,50;96")).toThrow(SalesCsvError);
    expect(() => parseSalesCsv("28.08.2026;842,50;96")).toThrow(/Zeile 1/);
  });

  it("weist einen fehlenden Umsatz zurück", () => {
    expect(() => parseSalesCsv("2026-08-28;;96")).toThrow(/ungültiger Umsatz/);
  });

  it("weist einen unplausibel hohen Umsatz zurück", () => {
    expect(() => parseSalesCsv("2026-08-28;250000,00;96")).toThrow(
      /ungültiger Umsatz/,
    );
  });

  it("weist eine negative Gutschrift als Tagesumsatz zurück", () => {
    expect(() => parseSalesCsv("2026-08-28;-42,00;96")).toThrow(
      /ungültiger Umsatz/,
    );
  });

  it("weist eine ungültige Gästezahl zurück", () => {
    expect(() => parseSalesCsv("2026-08-28;842,50;viele")).toThrow(
      /ungültige Gästezahl/,
    );
  });

  it("nennt die richtige Zeilennummer in einer längeren Datei", () => {
    const csv = [
      "Datum;Umsatz;Gaeste",
      "2026-08-27;100,00;10",
      "2026-08-28;kaputt;20",
    ].join("\n");
    expect(() => parseSalesCsv(csv)).toThrow(/Zeile 3/);
  });
});
