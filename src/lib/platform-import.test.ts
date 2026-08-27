import { describe, expect, it } from "vitest";
import {
  parseAmountToCents,
  parsePlatformCsv,
  parsePlatformDate,
  parsePlatformItems,
} from "@/lib/platform-import";

describe("parseAmountToCents", () => {
  it("liest deutsche und englische Schreibweise", () => {
    expect(parseAmountToCents("12,50")).toBe(1250);
    expect(parseAmountToCents("12.50")).toBe(1250);
    expect(parseAmountToCents("1.234,50")).toBe(123_450);
    expect(parseAmountToCents("1,234.50")).toBe(123_450);
    expect(parseAmountToCents("12,50 €")).toBe(1250);
  });

  it("weist unlesbare Betraege zurueck", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("kostenlos")).toBeNull();
    expect(parseAmountToCents("-5,00")).toBeNull();
  });
});

describe("parsePlatformDate", () => {
  it("liest deutsches und ISO-Format", () => {
    expect(parsePlatformDate("20.08.2026 18:30")?.getFullYear()).toBe(2026);
    expect(parsePlatformDate("20.08.2026")?.getMonth()).toBe(7);
    expect(parsePlatformDate("2026-08-20 18:30")?.getDate()).toBe(20);
  });

  it("weist unlesbare Daten zurueck", () => {
    expect(parsePlatformDate("gestern")).toBeNull();
    expect(parsePlatformDate("")).toBeNull();
  });
});

describe("parsePlatformItems", () => {
  it("verteilt den Gesamtbetrag auf die Positionen", () => {
    const items = parsePlatformItems("2x Döner | 1x Ayran", 1800);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      name: "Döner",
      quantity: 2,
      unitPriceCents: 600,
    });
  });

  it("faellt ohne Artikelspalte auf eine Sammelposition zurueck", () => {
    expect(parsePlatformItems("", 1500)).toEqual([
      { name: "Plattformbestellung", quantity: 1, unitPriceCents: 1500 },
    ]);
  });
});

describe("parsePlatformCsv", () => {
  const header = "Bestellnummer;Datum;Telefon;Name;Art;Betrag;Artikel";

  it("liest gueltige Zeilen und normalisiert die Nummer", () => {
    const result = parsePlatformCsv(
      [
        header,
        "LF-1001;20.08.2026 18:30;0176 1234567;Ayse K.;Lieferung;18,00;2x Döner",
        "LF-1002;20.08.2026 19:05;+49 176 1234567;;Abholung;7,50;1x Döner",
      ].join("\n"),
    );

    expect(result.issues).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.phone).toBe("491761234567");
    expect(result.rows[0]?.mode).toBe("DELIVERY");
    expect(result.rows[0]?.totalCents).toBe(1800);
    expect(result.rows[1]?.mode).toBe("PICKUP");
    expect(result.rows[1]?.name).toBeNull();
  });

  it("erkennt Komma als Trennzeichen", () => {
    const result = parsePlatformCsv(
      [
        "bestellnummer,datum,telefon,betrag",
        "LF-2001,2026-08-21 12:00,+491701111111,9.90",
      ].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.totalCents).toBe(990);
  });

  it("meldet jede uebersprungene Zeile mit Grund", () => {
    const result = parsePlatformCsv(
      [
        header,
        ";20.08.2026;0176 1234567;;Lieferung;18,00;",
        "LF-1003;gestern;0176 1234567;;Lieferung;18,00;",
        "LF-1004;20.08.2026;keine Nummer;;Lieferung;18,00;",
        "LF-1005;20.08.2026;0176 1234567;;Lieferung;kostenlos;",
      ].join("\n"),
    );

    expect(result.rows).toEqual([]);
    expect(result.issues.map((issue) => issue.line)).toEqual([2, 3, 4, 5]);
    expect(result.issues[0]?.reason).toContain("Bestellnummer");
    expect(result.issues[1]?.reason).toContain("Datum");
    expect(result.issues[2]?.reason).toContain("Telefonnummer");
    expect(result.issues[3]?.reason).toContain("Betrag");
  });

  it("meldet Dubletten innerhalb der Datei", () => {
    const result = parsePlatformCsv(
      [
        header,
        "LF-1001;20.08.2026;0176 1234567;;Lieferung;18,00;",
        "LF-1001;20.08.2026;0176 1234567;;Lieferung;18,00;",
      ].join("\n"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.issues[0]?.reason).toContain("mehrfach");
  });

  it("lehnt eine unvollstaendige Kopfzeile ab", () => {
    const result = parsePlatformCsv("foo;bar\n1;2");
    expect(result.rows).toEqual([]);
    expect(result.issues[0]?.reason).toContain("Kopfzeile");
  });

  it("faengt eine leere Datei ab", () => {
    expect(parsePlatformCsv("").issues[0]?.reason).toContain("leer");
  });
});
