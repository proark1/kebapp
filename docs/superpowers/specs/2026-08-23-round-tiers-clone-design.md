# Design: Preisstufen beim Runden-Anlegen und Runde klonen

**Datum:** 23. August 2026
 **Grundlage:** Fortsetzung von `2026-08-23-admin-directory-savings-design.md`; Freigabe durch Auftraggeber („ok weiter").

## Ziel

1. **Preisstufen pflegen:** Beim Anlegen einer Sammelrunde können Admins bis zu 8 Stufen erfassen (Label, Mindestmenge kg, Preis €/kg). Der Ersparnis-Report nutzt sie bereits — bisher wurden sie leer angelegt (`[]`) und nur der Richtpreis galt.
2. **Runde klonen:** Auf der Rundendetailseite kopiert „Runde klonen" Name (+„ · Folge runde"), Regions-Schlüssel, Zielmenge, Richtpreis und alle Preisstufen in das Anlegeformular (`/admin/runden?klon=<id>`). Datum bleiben bewusst leer (Bestellschluss/Lieferfenster müssen neu entschieden werden); Status wird PLANNING, es entsteht ein regulärer, auditierter Datensatz.

## Umsetzung

- `buyingRoundInputSchema` erhält optionales `pricingTiers`-Array (zod: Label 1–80 Zeichen, Mindestmenge ≥ 0, Preis > 0, max. 8 Stufen); der Service sortiert aufsteigend nach Mindestmenge und verwirft Duplikate der Mindestmenge nicht still, sondern lehnt duplizierte Schwellen mit klarer Meldung ab.
- Das Formular serialisiert die Zeilen als verstecktes JSON-Feld `pricingTiersJson` (kontrollierte State-Liste, Zeilen hinzufügen/entfernen, mindestens eine Zeile).
- Neuer Service `getRoundCloneTemplate` (Admin-Kontext) liefert die kopierbaren Felder einer Quellrunde; die Erzeugung läuft weiterhin durch `createBuyingRound` (ein Audit-Pfad).
- Kein Schema-/Migrationswechsel; bestehende Tests bleiben gültig, neue Fälle: Stufen werden sortiert gespeichert, doppelte Schwellen werden abgelehnt, Klon-Vorlage liefert Stufen.

## Tests

Erweiterung von `rounds.integration.test.ts`; Verifikation lint/unit/integration/build, danach Deploy wie gehabt.
