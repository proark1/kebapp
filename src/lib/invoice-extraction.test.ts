import { describe, expect, it } from "vitest";
import {
  centsToInputValue,
  extractInvoiceFields,
  guessCategory,
  parseGermanDate,
} from "@/lib/invoice-extraction";

describe("parseGermanDate", () => {
  it("liest Punktschreibweise", () => {
    expect(parseGermanDate("26.08.2026")).toBe("2026-08-26");
    expect(parseGermanDate("1.9.2026")).toBe("2026-09-01");
  });

  it("ergänzt zweistellige Jahre", () => {
    expect(parseGermanDate("26.08.26")).toBe("2026-08-26");
  });

  it("liest ISO-Datum", () => {
    expect(parseGermanDate("2026-08-26")).toBe("2026-08-26");
  });

  it("liest ausgeschriebene Monate", () => {
    expect(parseGermanDate("26. August 2026")).toBe("2026-08-26");
    expect(parseGermanDate("3. März 2026")).toBe("2026-03-03");
  });

  it("weist unmögliche Tage ab", () => {
    expect(parseGermanDate("31.02.2026")).toBeNull();
    expect(parseGermanDate("45.13.2026")).toBeNull();
  });

  it("weist Jahre außerhalb des Belegzeitraums ab", () => {
    expect(parseGermanDate("26.08.1899")).toBeNull();
  });

  it("liefert null ohne Datum", () => {
    expect(parseGermanDate("Rechnung")).toBeNull();
  });
});

describe("guessCategory", () => {
  it("erkennt die Warengruppen eines Dönerladens", () => {
    expect(guessCategory("2 Drehspieße Kalb 20 kg")).toBe("FLEISCH");
    expect(guessCategory("Tomaten Kiste, Salat")).toBe("GEMUESE");
    expect(guessCategory("Ayran 250 ml, Cola")).toBe("GETRAENKE");
    expect(guessCategory("Alufolie 30 cm, Servietten")).toBe("VERPACKUNG");
    expect(guessCategory("Bulgur 25 kg, Gewürzmischung")).toBe("TROCKEN");
  });

  it("liefert null ohne Treffer", () => {
    expect(guessCategory("Reparatur Kühlanlage")).toBeNull();
  });
});

// Ein typischer Lieferschein/Rechnungstext, wie ihn die Texterkennung
// aus einem Foto zurückgibt: Briefkopf, Positionen, Steuerblock.
const METZGEREI_BELEG = `
Anadolu Fleischhandel GmbH
Krefelder Straße 118
41065 Mönchengladbach

Rechnung
Rechnungsnummer: 2026-1002
Rechnungsdatum: 26.08.2026
Fällig am: 09.09.2026

Pos  Artikel                Menge   Preis     Summe
1    Drehspieß Kalb 20 kg   2       89,00     178,00
2    Hähnchenspieß 15 kg    1       33,00      33,00

Nettobetrag 7 %                                211,00
zzgl. 7 % MwSt                                  14,77
Gesamtbetrag                                   225,77
`;

describe("extractInvoiceFields — Fleischlieferant", () => {
  const result = extractInvoiceFields(METZGEREI_BELEG);

  it("erkennt den Lieferanten an der Rechtsform", () => {
    expect(result.supplierName).toBe("Anadolu Fleischhandel GmbH");
  });

  it("erkennt die Rechnungsnummer", () => {
    expect(result.invoiceNumber).toBe("2026-1002");
  });

  it("trennt Rechnungs- und Fälligkeitsdatum", () => {
    expect(result.documentDate).toBe("2026-08-26");
    expect(result.dueDate).toBe("2026-09-09");
  });

  it("nimmt die Bemessungsgrundlage, nicht den Steuerbetrag", () => {
    expect(result.netCents7).toBe(21_100);
    expect(result.netCents19).toBeNull();
  });

  it("erkennt den Bruttobetrag", () => {
    expect(result.grossCents).toBe(22_577);
  });

  it("schlägt die Warengruppe vor", () => {
    expect(result.category).toBe("FLEISCH");
  });

  it("meldet, welche Felder gefunden wurden", () => {
    expect(result.recognizedFields).toContain("supplierName");
    expect(result.recognizedFields).toContain("netCents7");
    expect(result.recognizedFields).not.toContain("netCents19");
  });
});

describe("extractInvoiceFields — beide Steuersätze", () => {
  const result = extractInvoiceFields(`
Getränke Yildiz e.K.
Rechnungs-Nr. R-99120
Datum 21.08.2026

Zwischensumme 7 % netto        120,00
Zwischensumme 19 % netto       480,00
7 % Umsatzsteuer                 8,40
19 % Umsatzsteuer               91,20
Rechnungsbetrag                699,60
`);

  it("trennt die beiden Bemessungsgrundlagen", () => {
    expect(result.netCents7).toBe(12_000);
    expect(result.netCents19).toBe(48_000);
  });

  it("erkennt eine Rechnungsnummer mit Bindestrich", () => {
    expect(result.invoiceNumber).toBe("R-99120");
  });

  it("erkennt den Lieferanten mit e.K.", () => {
    expect(result.supplierName).toBe("Getränke Yildiz e.K.");
  });
});

describe("extractInvoiceFields — nur Steuerbetrag ausgewiesen", () => {
  it("rechnet vom Steuerbetrag auf das Netto zurück", () => {
    const result = extractInvoiceFields(`
Rheinland Gemüse GmbH & Co. KG
Beleg-Nr.: 20260871
Belegdatum: 24.08.2026
enthaltene MwSt 7 %              21,00
`);
    // 21,00 EUR Steuer bei 7 % entsprechen 300,00 EUR netto.
    expect(result.netCents7).toBe(30_000);
    expect(result.invoiceNumber).toBe("20260871");
  });
});

describe("extractInvoiceFields — Kassenbon ohne Nettozeile", () => {
  it("löst einen einzelnen Steuersatz über den Bruttobetrag auf", () => {
    const result = extractInvoiceFields(`
Handelshof Mönchengladbach
Rechnung Nr. 884412
Datum: 20.08.2026
Ware 19 %
Zu zahlen                        119,00
`);
    expect(result.netCents19).toBe(10_000);
    expect(result.netCents7).toBeNull();
  });

  it("rät nicht, wenn beide Steuersätze auftauchen", () => {
    const result = extractInvoiceFields(`
Grosshandel Nord
Rechnung Nr. 5511
Datum: 20.08.2026
Ware 7 % und 19 %
Zu zahlen                        119,00
`);
    expect(result.netCents7).toBeNull();
    expect(result.netCents19).toBeNull();
  });
});

describe("extractInvoiceFields — Randfälle", () => {
  it("liefert leere Felder für leeren Text", () => {
    const result = extractInvoiceFields("   \n  \n ");
    expect(result.recognizedFields).toEqual([]);
    expect(result.supplierName).toBeNull();
  });

  it("hält ein Datum nicht für eine Rechnungsnummer", () => {
    const result = extractInvoiceFields("Rechnung Nr. 26.08.2026\nDatum 26.08.2026");
    expect(result.invoiceNumber).toBeNull();
  });

  it("übernimmt das Fälligkeitsdatum nicht doppelt", () => {
    const result = extractInvoiceFields(`
Musterlieferant GmbH
Rechnungsdatum: 26.08.2026
Nettobetrag 19 %     100,00
`);
    expect(result.documentDate).toBe("2026-08-26");
    expect(result.dueDate).toBeNull();
  });

  it("nimmt keine Anschrift als Lieferantennamen", () => {
    const result = extractInvoiceFields(`
Krefelder Straße 118
41065 Mönchengladbach
Frischwerk Handels GmbH
Rechnungsdatum: 26.08.2026
`);
    expect(result.supplierName).toBe("Frischwerk Handels GmbH");
  });

  it("erkennt Fälligkeit auch in Umschrift ohne Umlaut", () => {
    // So kommt es aus der Texterkennung eines fotografierten Belegs.
    const result = extractInvoiceFields(`
Anadolu Fleischhandel GmbH
Rechnungsdatum: 26.08.2026
Faellig am: 09.09.2026
Nettobetrag 7 % 211,00
`);
    expect(result.dueDate).toBe("2026-09-09");
  });

  it("nimmt eine ausdrückliche Lieferantenzeile vorrangig", () => {
    const result = extractInvoiceFields(`
Sammelrechnung
Lieferant: Fleischwerk Rheinland
Rechnungsdatum: 26.08.2026
`);
    expect(result.supplierName).toBe("Fleischwerk Rheinland");
  });

  it("überschreitet die Feldlängen der Datenbank nicht", () => {
    const long = "A".repeat(400);
    const result = extractInvoiceFields(`${long}\nRechnungsnummer: ${long}`);
    expect(result.supplierName?.length ?? 0).toBeLessThanOrEqual(180);
    expect(result.invoiceNumber?.length ?? 0).toBeLessThanOrEqual(80);
  });
});

describe("centsToInputValue", () => {
  it("schreibt Cent als Dezimalwert für ein Zahlenfeld", () => {
    expect(centsToInputValue(21_100)).toBe("211.00");
    expect(centsToInputValue(700)).toBe("7.00");
  });

  it("liefert einen leeren Wert für null", () => {
    expect(centsToInputValue(null)).toBe("");
  });
});
