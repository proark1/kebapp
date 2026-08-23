# Design: Wareneingang und Fehlmengen

**Datum:** 23. August 2026
 **Grundlage:** Roadmap aus dem Gesamtcheck (Punkt 3); Freigabe durch Auftraggeber („weiter").

## Ziel

Nach einer abgeschlossenen Sammelrunde (Status CLOSED oder SUBMITTED, Lieferfenster vorbei bzw. abgeschlossen) dokumentiert der Laden, **was tatsächlich angekommen ist**:

- Eine Zeile je bestätigter Bedarfsposition: Produkt, Spezifikation, Einheit, **bestellte Menge** (Snapshot aus dem bestätigten Bedarf), **erhaltene Menge**, **Grund bei Fehlmenge** (SHORTAGE / QUALITY / WRONG_ITEM / OTHER) plus freie Bemerkung je Position und eine Gesamtbemerkung.
- Fehlmenge wird clientseitig als `max(0, bestellt − erhalten)` angezeigt und pro Position zusammengefasst; Überlieferungen sind erlaubt (Fehlmenge 0).
- Zweck: Vertrauensbasis im Gruppeneinkauf, Grundlage für Nachforderungen des Einkaufsteams, späterer Baustein für Lager/Statistik. Keine automatische Gutschrift/Rechnungslogik in diesem Schritt.

## Datenmodell (Migration 0012)

- `goods_receipts`: ein Beleg je Laden × Runde (`unique(organization_id, buying_round_id)`), `note`, `saved_by_user_id`, Timestamps.
- `goods_receipt_items`: gehört zum Beleg (Composite-FK wie Vorlagen), Snapshot-Felder `product_name`, `specification`, `unit`, `ordered_quantity`, Eingaben `received_quantity` (≥ 0, CHECK), `missing_reason` (Enum, leer erlaubt), `reason_note` (≤ 300).
- Beide Tabellen ENABLE+FORCE RLS, Policies über `kebapp_private.can_edit_demand(organization_id)` (Muster Vorlagen); Grants für `kebapp_app`.

Keine SECURITY DEFINER Funktionen nötig — Zugriff immer mit Tenant-Kontext.

## Rechte & Ablauf

OWNER und EMPLOYEE mit Bedarfsrecht erfassen/anpassen; Support nur mit Begründung (bestehendes Muster `authorizeOperationalMutation`). Jedes Speichern schreibt `GOODS_RECEIPT_SAVED` ins Audit (inkl. Denials später analog Rundenmodul — hier SUCCESS-Pfad). Speichern ersetzt die Positionszeilen komplett (idempotentes Upsert des Belegs).

## UI

- Neuer Nav-Eintrag „Wareneingang" (`/app/eingang`) für Inhaber:in und Mitarbeiter:in; mobile Tabbar wird auf 4 Spalten verallgemeinert.
- Übersicht: abgeschlossene Runden des Ladens mit Erfassungsstatus („Offen" / „Erfasst am …").
- Erfassungsansicht: Tabelle mit Live-Berechnung der Fehlmengen, Summenzeile, Gesamtbemerkung, Speichern mit Pending-Zustand und deutschen Meldungscodes (gespeichert/ungueltig/gesperrt).

## Tests

Integration `receipts.integration.test.ts`: Erfassen durch Employee, idempotentes Zweitspeichern, fremde Runde abgewiesen, PLANNING-Runde abgewiesen, Audit-Eintrag. Schema-/Isolationstests um neue Tabellen/FKs ergänzt. Verifikation lint/unit/integration/build + Deploy.
