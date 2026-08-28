import "server-only";

// Die Definer-Funktionen werden ueber transaction.execute() aufgerufen. Der
// Treiber liefert deren Spalten als Text zurueck, nicht als typisierte Werte.
// Zeitstempel kommen deshalb als "2026-09-01 20:58:19.748+00" an - Date
// versteht diese Form nicht und Intl.DateTimeFormat wirft dann
// "Invalid time value" mitten in der Seite.
export function toDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;

  const isoish = value
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/([+-]\d{2})$/, "$1:00");

  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
