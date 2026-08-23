# Design: Admin-Lädedirectory und Ersparnis-Report

**Datum:** 23. August 2026
 **Grundlage:** Gesamtcheck-Report vom 23.08.2026, Abschnitt Plattform-Betreiber; Freigabe durch Auftraggeber („ja").

## Ziel

Plattform-Admins steuern den NRW-Piloten über zwei neue Erkenntnisquellen:

1. **Läden-Übersicht `/admin/laeden`** — Directory aller Organisationen (nicht nur Anträge): Name, Status (ACTIVE/SUSPENDED/PENDING/REJECTED), Mitgliederzahl, Website-Status mit Link, neueste Sammelrunde (Status/Bestellschluss), Freigabedatum.
2. **Ersparnis-Report je Region** — auf der Rundendetailseite (`/admin/runden/[id]`, ab Status CLOSED/SUBMITTED): bestätigte kg je Laden, Referenzpreis, aktive Preisstufe der Gruppe, Ersparnis in EUR je Laden; CSV-Download über den bestehenden Export-Endpunkt (`&report=savings`). Das liefert den Kernnachweis des Geschäftsmodells („5–10 % Ersparnis").

## Datenzugriff (RLS-konform)

Admin hat mit leerem Organisationskontext keinen SELECT auf `organizations`,
`store_profiles` o. Ä. — deshalb zwei neue SECURITY DEFINER Funktionen
(Besitzer `kebapp_policy_executor`, REVOKE PUBLIC, EXECUTE nur `kebapp_app`,
jeweils mit `is_platform_admin()`-Guard):

- `kebapp_private.admin_store_directory()` — eine Zeile je Organisation inkl. Aggregaten (Mitglieder, Website, letzte Runde).
- `kebapp_private.regional_savings_report(target_round_id uuid)` — eine Zeile je Laden derselben `regional_key`, dessen eigene Runde CLOSED/SUBMITTED ist; Gruppenmenge = Summe bestätigter KG der Region, aktive Stufe = höchste erreichte `pricing_tiers`-Stufe, Ersparnis = (Referenzpreis − Stufenpreis) × Laden-KG. Stück-Einheiten fließen nicht ein (konsistent zu `regional_confirmed_demand_kg`).

Neue Tabellen gibt es nicht; `schema.integration.test.ts` bleibt unverändert.
Benötigte Zusatzgrants für den Policy-Executor: `SELECT` auf `store_profiles`.

## UI

- Neuer Nav-Eintrag „Läden" im Prüftisch.
- Tabelle im bestehenden `request-file`-Look; leere Zustände wie gehabt; veröffentlichte Websites verlinkt (target _blank).
- Rundendetail: zweiter Abschnitt „Ersparnis je Laden" oberhalb des Bündels, plus CSV-Umschalter am Export-Link.

## Tests

Integrationstest `directory-savings.integration.test.ts`: Directory-Zeilen inkl. Aggregate, Savings-Mathematik (Stufensprung bei Gruppenmenge, Stück-Ausschluss, SUSPENDED-Laden erscheint), Denial ohne Admin-Kontext. Verifikation wie gehabt: lint, unit, integration, build; danach Deploy.
