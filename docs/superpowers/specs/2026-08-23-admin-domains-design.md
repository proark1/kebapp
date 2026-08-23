# Design: Admin-Domains (Freigabe-Workflow)

**Datum:** 23. August 2026
 **Grundlage:** Gesamtcheck-Restposten „Domain-Freigabe-Workflow"; Freigabe durch Auftraggeber („weiter").

## Ziel

Inhaber:innen merken Wunsch-Domains vor (`REVIEW_REQUESTED`). Bisher endete der Prozess dort. Neu: Admin-Bereich `/admin/domains` mit allen offenen Wünschen und zwei Entscheidungen:

- **Verbinden:** `store_profiles.custom_domain = requested_domain`, `domain_request_status = 'CONNECTED'`, Audit `STOREFRONT_DOMAIN_CONNECTED`. Die öffentliche Seite zeigt die Adresse danach als verbunden an (Editor nutzt `custom_domain` bereits).
- **Ablehnen:** Status zurück auf `NONE` (Wunsch bleibt als Text erhalten), Audit `STOREFRONT_DOMAIN_REJECTED` mit Begründungspflicht (≥10 Zeichen, Muster Anträge).

Keine Migration nötig (`domain_request_status` ist TEXT); echter DNS-/SSL-Vollzug bleibt wie gehabt der Demo-Ausgrenzung vorbehalten — der Workflow dokumentiert aber sauber jede Entscheidung.

## Umsetzung

Service `src/server/storefront/admin-domains.ts` mit `setAdminContext`/`setOrganizationContext` (Muster Anträge), zod-Validierung, Audit in derselben Transaktion. Integrationstest: Verbinden/Ablehnen inkl. Audit, Nicht-Admin abgelehnt.
