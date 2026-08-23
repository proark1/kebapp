# Design: Zeiterfassung (Modul Personal, Stufe 1)

**Datum:** 23. August 2026
 **Grundlage:** Roadmap Gesamtcheck (Betriebsmodul Personal, Spec 6.5); Freigabe durch Auftraggeber („weiter mit modulen").

## Ziel

Laden-Mitarbeitende und Inhaber:innen erfassen Arbeitszeiten mit einem Klick; Inhaber:innen sehen das Team-Tagebuch, korrigieren Einträge und exportieren Monats-CSVs fürs Lohnbüro. Grundlage für den gesetzlichen Mindestlohn-Nachweis.

## Datenmodell (Migration 0013)

`time_entries`: organization_id, user_id, started_at, ended_at (null = laufende Schicht), note (≤300), corrected_by_user_id; CHECK `ended_at IS NULL OR ended_at > started_at`; Index (org, user, started_at).

RLS ohne neue Funktionen:
- SELECT/INSERT/UPDATE: `can_access_organization(org) AND (eigene Zeile ODER Owner-Membership ODER Plattform-Admin ODER aktiver Support)`; DELETE nur Owner/Admin/Support.
- FORCE RLS, Grants für `kebapp_app`.

## Regeln (Service-Layer)

- Ein:e Mitarbeiter:in hat höchstens eine offene Schicht (`TimeEntryAlreadyOpenError`, `NoOpenTimeEntryError`).
- Mitarbeiter:innen sehen/nur ihre eigenen Einträge; Inhaber:in (und Support mit Begründung) sieht alle, korrigiert beliebige Einträge (`TIME_ENTRY_CORRECTED` im Audit). Geschlossene Einträge können Mitarbeiter:innen nicht mehr ändern.
- Korrekturen validieren Ende > Start; Notiz dokumentiert den Anlass.

## UI

- Neuer Bereich `/app/zeit` (Nav „Zeit", Icon Uhr; Tabbar dynamisch ≤5 Items):
  - Status-Karte: „Arbeiten starten" bzw. laufender Timer mit „Schicht beenden".
  - Tabelle der letzten 14 Tage (Tag, Start–Ende, Dauer, Vermerk/Korrektur-Badge); Inhaber:in zusätzlich Teamfilter.
  - CSV-Export über `GET /api/app/zeit/export?von=&bis=&mitarbeiter=` (Session + Org-Auflösung wie Pages; Mitarbeiter:innen exportieren nur sich selbst).

## Tests

Integration: Stempeluhr-Flow, Doppel-Start abgelehnt, Korrektur durch Inhaber + Audit, RLS-Fremdzugriff leer, Export-Authentifizierung. Schema-/Isolationstests erweitert. Danach lint/unit/integration/build + Deploy.
