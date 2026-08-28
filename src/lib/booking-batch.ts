// Buchungsstapel aus Eingangsrechnungen.
//
// Eine Rechnung kann Positionen zu 7 % und zu 19 % enthalten - im Imbiss ist
// das der Normalfall, sobald Ware und Verpackung auf einem Beleg stehen.
// Frueher wurde daraus *eine* Zeile mit dem vollen Brutto und dem Schluessel
// `netCents19 > 0 ? "3" : "2"`, der 7-%-Anteil also mit 19 % verbucht. Deshalb
// entsteht ab jetzt je Steuersatz eine eigene Zeile.
//
// Reine Umrechnung ohne Serverbindung, damit sich die Steuerlogik ohne
// Datenbank pruefen laesst.

export type BookingSourceInvoice = {
  category: string | null;
  documentDate: string;
  invoiceNumber: string;
  netCents7: number;
  netCents19: number;
  supplierName: string;
};

export type BookingLine = {
  /** Brutto des Anteils zu diesem Steuersatz, in Cent. */
  grossCents: number;
  netCents: number;
  /** Belegdatum als `JJJJMMTT`. */
  bookingDate: string;
  invoiceNumber: string;
  category: string;
  supplierName: string;
  taxRatePercent: 7 | 19;
  /** DATEV-Steuerschluessel: 2 = 7 %, 3 = 19 %. */
  vatKey: "2" | "3";
};

const RATES = [
  { key: "2", percent: 7, factor: 1.07 },
  { key: "3", percent: 19, factor: 1.19 },
] as const;

/**
 * Zerlegt eine Rechnung in je eine Buchungszeile pro belegtem Steuersatz.
 * Eine Rechnung ohne Betraege ergibt keine Zeile.
 */
export function toBookingLines(invoice: BookingSourceInvoice): BookingLine[] {
  const netByRate = [invoice.netCents7, invoice.netCents19];

  return RATES.flatMap((rate, index) => {
    const netCents = netByRate[index] ?? 0;
    if (netCents <= 0) return [];
    return [
      {
        bookingDate: invoice.documentDate.replaceAll("-", ""),
        category: invoice.category ?? "",
        grossCents: Math.round(netCents * rate.factor),
        invoiceNumber: invoice.invoiceNumber,
        netCents,
        supplierName: invoice.supplierName,
        taxRatePercent: rate.percent,
        vatKey: rate.key,
      },
    ];
  });
}

/** Cent als deutscher Dezimalbetrag: `84250` -> `842,50`. */
export function centsToGermanAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
