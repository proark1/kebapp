import { describe, expect, it } from "vitest";
import {
  detectCsvDelimiter,
  parseAmountToCents,
  splitCsvLine,
} from "@/lib/german-number";

describe("parseAmountToCents", () => {
  it("liest deutsche Beträge mit Tausenderpunkt", () => {
    expect(parseAmountToCents("1.234,56")).toBe(123_456);
    expect(parseAmountToCents("12.345.678,90")).toBe(1_234_567_890);
  });

  it("liest Beträge ohne Tausendertrennung", () => {
    expect(parseAmountToCents("842,50")).toBe(84_250);
    expect(parseAmountToCents("7,00")).toBe(700);
  });

  it("liest die englische Schreibweise", () => {
    expect(parseAmountToCents("1234.56")).toBe(123_456);
    expect(parseAmountToCents("1,234.56")).toBe(123_456);
  });

  it("erkennt einen Tausenderpunkt ohne Nachkommastellen", () => {
    expect(parseAmountToCents("1.234")).toBe(123_400);
  });

  it("ignoriert Währungszeichen und Leerraum", () => {
    expect(parseAmountToCents(" 225,73 EUR ")).toBe(22_573);
    expect(parseAmountToCents("€ 99,99")).toBe(9_999);
  });

  it("füllt eine einzelne Nachkommastelle auf", () => {
    expect(parseAmountToCents("12,5")).toBe(1_250);
  });

  it("behält das Vorzeichen einer Gutschrift", () => {
    expect(parseAmountToCents("-45,00")).toBe(-4_500);
  });

  it("liefert null ohne Ziffern", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("EUR")).toBeNull();
  });
});

describe("detectCsvDelimiter", () => {
  it("erkennt das Semikolon des deutschen Kassenexports", () => {
    expect(detectCsvDelimiter(["Datum;Umsatz;Gaeste", "2026-08-28;842,50;96"])).toBe(";");
  });

  it("erkennt den Tabulator", () => {
    expect(detectCsvDelimiter(["2026-08-28	842,50	96"])).toBe("	");
  });

  it("nimmt das Komma nur, wenn nichts anderes vorkommt", () => {
    expect(detectCsvDelimiter(["2026-08-28,842.50,96"])).toBe(",");
  });

  it("lässt sich von einem Dezimalkomma nicht täuschen", () => {
    // Das Komma steht hier im Betrag, das Semikolon trennt die Felder.
    expect(detectCsvDelimiter(["2026-08-28;842,50;96"])).toBe(";");
  });

  it("nimmt das Semikolon auch, wenn es erst in einer späteren Zeile steht", () => {
    expect(detectCsvDelimiter(["Tagesabschluss", "2026-08-28;842,50;96"])).toBe(";");
  });
});

describe("splitCsvLine", () => {
  it("hält den Betrag zusammen, wenn am Semikolon getrennt wird", () => {
    expect(splitCsvLine("2026-08-28;842,50;96", ";")).toEqual([
      "2026-08-28",
      "842,50",
      "96",
    ]);
  });

  it("entfernt Leerraum um die Zellen", () => {
    expect(splitCsvLine(" 2026-08-28 ; 842,50 ; 96 ", ";")).toEqual([
      "2026-08-28",
      "842,50",
      "96",
    ]);
  });
});
