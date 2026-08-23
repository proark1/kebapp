# Design: Hygiene/HACCP-Tagesdokumentation

**Datum:** 23. August 2026
 **Grundlage:** Roadmap Gesamtcheck (Spec 6.6); Freigabe durch Auftraggeber („weiter").

## Ziel

Tägliche Hygiene-Checkliste pro Laden: feste Prüfpunkte plus Kühltemperaturen, Mängel mit Begriffspflicht, 14-Tage-Historie auf einen Blick. Grundlage für Lebensmittelüberwachung und Rückverfolgung.

## Datenmodell (Migration 0014)

- `hygiene_entries`: unique(organization_id, entry_date), completed_by_user_id, note.
- `hygiene_items`: Composite-FK zum Beleg; `item_key` (aus fester Liste), `kind` ENUM(CHECK|TEMPERATURE), `status` ENUM(OK|MANGEL, nur CHECK), `celsius` numeric(4,1) (nur TEMPERATURE), `note` ≤300.
- FORCE-RLS über `can_edit_demand` (Muster Wareneingang).

Feste Tagespunkte (Code-Konstante `src/lib/hygiene-items.ts`, deutsch gelabelt): Händehygiene, Arbeitsflächen, Geräte sauber, Müll entsorgt, Arbeitskleidung — jeweils OK/Mangel; Kühlschrank (Ziel ≤ 4 °C, Warnung > 6 °C) und Tiefkühler (≤ −18 °C, Warnung > −15 °C).

## Regeln

- Inhaber:in und Mitarbeiter:innen erfassen gemeinsam; änderbar sind **heute und gestern**, ältere Tage nur lesbar (`HygieneDateLockedError`).
- Bei Status MANGEL ist eine Begriffsnotiz Pflicht (Validierung).
- Jedes Speichern auditiert `HYGIENE_ENTRY_SAVED`; Upsert idempotent (Zeilen werden ersetzt).

## UI

- `/app/hygiene`: Datums-Navigation (heute/gestern), Formular je Punkt (Radio OK/Mangel bzw. Temperaturfeld mit Warnfarbe bei Überschreitung), Notizenfeld, Summenzeile (Mängelzahl), Historie-Chips der letzten 14 Tage (grün/rot/leer).

## Tests

Integration: Speichern heute inkl. Mangel+Begriffspflicht, idempotentes Zweitspeichern, vorgestern abgelehnt, Fremd-Org leer, Audit. Verifikation + Deploy wie gehabt.
