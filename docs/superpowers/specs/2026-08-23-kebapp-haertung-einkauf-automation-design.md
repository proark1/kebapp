# Design: Härtung, Einkaufs-Automatisierung und UX-Nachbesserung

**Datum:** 23. August 2026
 **Grundlage:** `docs/reports/2026-08-23-kebapp-gesamtcheck-ui-ux-sicherheit-automation.md` (vom Auftraggeber freigegeben: „alles umsetzen")
 **Umfang dieses Specs:** Sprint 0 (Sicherheit), Quick Wins 1–3 (Einkaufszyklus), UI-Maßnahmen U1–U12 sowie umsetzbare Teile von Sprint 2. Bewusst ausgegrenzt: Dark Mode/Token-Migration, Shell-Konsolidierung, Betriebsmodul Wareneingang, MFA, DSGVO-Prüfung, Credential-Rotation auf dem Server.

## 1. Sicherheit

### 1.1 Demo-/Produktions-Trennung (H1)
- `compose.production.yaml`: `DEMO_MODE` wird Pflicht (`${DEMO_MODE:?...}`) statt Default `true`.
- Neuer optionaler Env-Wert `ALLOW_PUBLIC_DEMO` (enum `true|false`, Default `false`). `parseRuntimeEnv` wirft beim Start einen klaren Fehler, wenn `NODE_ENV=production` und `DEMO_MODE=true` ohne `ALLOW_PUBLIC_DEMO=true`. Die öffentliche Demo setzt beide Werte explizit; E2E-Prod-Build erhält sie über das Test-Env.
- `.env.production.example`, Runbook und README werden aktualisiert.

### 1.2 Security-Header (H3)
- `next.config.ts` globale Header: HSTS (nur Prod), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`.
- CSP pragmatisch: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' (+ 'unsafe-eval' nur dev); font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
- Caddyfile ergänzt HSTS als zweite Schicht; CSP bleibt im App-Layer (eine Wahrheit).

### 1.3 SMTP-TLS (M1)
- `createMailer`: Port 465 → `secure:true`, sonst STARTTLS mit `requireTLS` ab `NODE_ENV=production`; lokal/Test (Mailpit, kein STARTTLS-Garantie) bleibt funktionsfähig. Neu optionaler Env-Wert nicht erforderlich.

### 1.4 Secret-Scan (H2)
- `scripts/check-secrets.mjs` scannt Stagediffs (PEM, Key=Value-Muster, Postgres-URLs mit Passwort, lange Hex-Secrets); Platzhalter wie `change-me` sind allowlisted. Einbindung als `"check:secrets"`-Skript + versionierter Pre-Commit-Hook via `core.hooksPath scripts/git-hooks`.

### 1.5 Audit-Denials (M3)
- Neuer Helfer `writeDeniedAuditEvent` (result `DENIED`).
- Wichtige Erkenntnis aus der Umsetzung: Denials, die im selben Transaction-
  Context wie der abgelehnte Vorgang geschrieben werden, fallen dessen
  Rollback zum Opfer. Das Runden-Modul schreibt Denied-Einträge daher in einer
  eigenen Folgetransaktion (`transitionBuyingRound` signalisiert den Denial
  statt zu werfen, auditiert danach separat und wirft erst dann). Für
  `authorizeOperationalMutation` (Support-Mutationen) bleibt ein gleichartiges
  Refactoring offen, da es elf Action-Aufrufstellen anfasst; bis dahin
  protokolliert nur das Rundenmodul Denials.
- Login-Failures (Better-Auth-intern) bleiben außen vor.

## 2. Sammelrunden-Lebenszyklus (QW1)

- Migration (drizzle-kit + manuelle RLS-Ergänzung im selben File):
  - `buying_rounds.reminder_sent_at timestamptz null`
  - Tabellen `demand_templates` / `demand_template_items` (je `enableRLS()`), Policies analog Fachtabellen via `kebapp_private.can_edit_demand(organization_id)`
  - Neue Policy `buying_rounds_select` zusätzlich mit `OR kebapp_private.is_platform_admin()` (Muster aus `registration_requests_select`, Migration 0002)
- Neuer Service `src/server/procurement/rounds.ts` (Admin): Liste, Anlegen (zod-validiert, closesAt < Lieferfenster), Übergänge OPEN→CLOSED→SUBMITTED bzw. CANCELLED, jeweils Audit-Event. Kontext: `setAdminContext` + `setOrganizationContext` gemäß bestehendem Muster.
- Scheduler via `src/instrumentation.ts register()`: Intervall 60 s — setzt überfällige `OPEN`-Runden auf `CLOSED`, versendet einmalig (Spalte `reminder_sent_at`) Erinnerungsmails für Runden mit Bestellschluss < 48 h an aktive Mitglieder der Runden-Organisation. Demo-Modus: Übergänge laufen, Mailversand entfällt.
- Mailvorlage `roundReminderEmail` im bestehenden Shell-Design.

## 3. Admin-Rundenverwaltung + Bündel-Export (QW1/QW2)

- `/admin/runden`: Liste (Status, Bestellschluss, Region, Zielmenge) mit Filter nach Status, Formular „Runde anlegen", Zeilenaktionen je Status.
- `/admin/runden/[roundId]`: Fakten, Bündeltabelle (bestätigte Positionen gruppiert nach Produkt/Spezifikation/Einheit mit Summe und beitragenden Läden), CSV-Download.
- Export als Route Handler `GET /api/admin/runden/export?round=<uuid>`: Session + Plattform-Admin geprüft, Aggregation serverseitig, Antwort als `text/csv` mit `Content-Disposition`.

## 4. Stammbedarf-Vorlagen (QW3)

- Eine Vorlage pro Laden („Stammbedarf"). Speichern überschreibt sie mit den Positionen des aktuellen Entwurfs; Übernehmen fügt sie als Positionen in den offenen Entwurf ein (Preisreferenz der Runde).
- Rechte: OWNER/EMPLOYEE mit Bedarfsrecht (`authorizeOperationalMutation`), Support mit Begründung wie gehabt.

## 5. UX-Maßnahmen

- **U1/U7:** Mobile Vorschau bleibt sichtbar (angedockt unter dem Formular, ~60 vh); Bestellschluss-Badge nicht mehr per `display:none` entfernt, sondern umbricht unter den Titel.
- **Vorschau-Umschalter:** Toolbar-Buttons Desktop/Mobil (aria-pressed), Mobil = 390 px Container.
- **U2:** `global-error.tsx` (eigene html/body), `error.tsx` je Bereich (App/Admin/Support) mit deutschem Fallback + „Erneut versuchen" (`retry`-Prop dieser Next-Version), `loading.tsx` mit Skeleton-Panels.
- **U3:** +/- und Entfernen nutzen Quiet-Server-Actions (Rückgabe statt Redirect) + `useOptimistic`/`startTransition` + `router.refresh()`; Zahlenfeld-Speichern bleibt Formular mit Pending-Zustand.
- **U4:** Website- und Bedarfsformular wechseln auf `useActionState`; Validierungsfehler werden als feldbezogene deutsche Label-Liste (`role="alert"`) am Panel-Fuß gerendert — die Aussage „Prüfe die markierten Felder" wird wahr.
- **U5/U6:** Schriftgrößen: Tabbar 9→12 px, Eyebrow/Feldlabels 10/11→11/12 px, Preview-Toolbar ≥12 px, Inputs 13→16 px (iOS-Zoom). Kontrast: Kupfer-Textfarbe über neues Token `--store-copper-ink` (#7d5f33) auf hellem Grund; `.round-facts p` dunkler.
- **U11/U12/Dynamik:** Öffnungszeiten-Key auf Index; mobiler Drawer bekommt Escape/Fokus-Rückgabe/Scroll-Lock; Dashboard- und Admin-Grußformeln dynamisch (Uhrzeit/Wochentag via Intl, Europe/Berlin).
- **Farbwelt-Chips:** Sechs kuratierte Akzentfarben als Chips + nativer Color-Picker als erweiterte Option.

## 6. Fehlerbehandlung & Tests

- Expected Errors bleiben Rückgabewerte (kein try/catch-Throw); uncaught errors landen in den neuen Boundaries.
- Unit-Tests für neue Services (Berechnungen, Validierung), Integrationstests für Runden-Service/Policies/Vorlagen gegen die `_test`-Datenbank; bestehende Suites müssen grün bleiben. Verifikation: `pnpm lint && pnpm test && pnpm test:integration && pnpm build`.
