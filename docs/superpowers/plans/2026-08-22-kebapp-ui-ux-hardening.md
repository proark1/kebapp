# Kebapp – Implementierungsplan für die UI/UX-Härtung

**Stand:** 22. August 2026  
**Grundlage:** `docs/superpowers/specs/2026-08-22-kebapp-ui-ux-hardening-design.md`

## Ziel

Die öffentliche Demo erhält einen selbsterklärenden Einstieg, sichere
Bestellfreigabe, vollständig mobile Navigation, einen erweiterten
Website-Editor, eine realistische Domain-Demo, Muster-Rechtsseiten und messbar
bessere Accessibility. Bestehende Rollen-, Mandanten-, Demo- und
Deploymentgrenzen bleiben erhalten.

## Task 1: Next-16-Regeln und Ausgangszustand sichern

### Dateien und Dokumentation

- relevante Dateien unter `node_modules/next/dist/docs/`
- bestehende Tests, Migrationsjournal und aktuelle Produktionskonfiguration

### Umsetzung

1. Lokale Next-16-Dokumentation zu App Router, Server Actions, Forms,
   Redirects, Cookies, Metadata, Images und Self-Hosting vollständig für die
   betroffenen APIs lesen.
2. Aktuelle Befehle und Testtrennung aus `package.json` erfassen.
3. Arbeitsbaum, Migrationen und Produktions-Seed auf einen reproduzierbaren
   Ausgangszustand prüfen.
4. Relevante bestehende Unit-, Integrations- und Komponententests als
   Baseline ausführen.

### Prüfung

```powershell
pnpm lint
pnpm test
pnpm exec tsc --noEmit
```

## Task 2: Storefront-Datenmodell und Validierung erweitern

### Dateien

Ändern:

- `src/server/db/schema/storefront.ts`
- `src/lib/types.ts`
- `src/server/storefront/validation.ts`
- `src/server/storefront/queries.ts`
- `src/server/storefront/mutations.ts`
- `scripts/seed-public-demo.ts`

Neu:

- nächste fortlaufende Drizzle-SQL-Migration und Metadaten
- Validierungs- und Integrationstests für die neuen Felder

### Umsetzung

1. `features`, `requested_domain`, `domain_request_status` und
   `domain_requested_at` vorwärtskompatibel ergänzen.
2. Profil-Schemaversion erhöhen und DTO-Mapping ohne Verlust bestehender Daten
   aktualisieren.
3. Validierungen für Logo-Data-URL, Feature-Allowlist, Öffnungszeiten,
   Menüreihenfolge und Domainwunsch implementieren.
4. Profilspeicherung und getrennte Domainvormerkung authentifizieren,
   autorisieren und transaktional speichern.
5. Demo-Seed idempotent um Merkmale und neue Profilform ergänzen.

### Prüfung

```powershell
pnpm test
pnpm test:integration
pnpm exec tsc --noEmit
```

### Commit

```text
feat: extend storefront profile for self service
```

## Task 3: Öffentlichen Demo-Einstieg und Ein-Klick-Anmeldung bauen

### Dateien

Neu oder ändern:

- `src/app/page.tsx`
- Demo-Landing-Komponenten und zugehörige Tests
- `src/app/(auth)/actions.ts`
- `src/app/(auth)/anmelden/page.tsx`
- `src/app/(auth)/registrieren/page.tsx`
- `src/app/(auth)/passwort-vergessen/page.tsx`
- `src/components/auth/auth-card.tsx`
- `src/server/demo/demo-mode.ts`
- `src/lib/env.ts`
- `src/app/globals.css`

### Umsetzung

1. Öffentliche Landingpage mit fünf serverseitig erlaubten Rollenkarten bauen.
2. Server Action für Demo-Anmeldung an den vorhandenen Better-Auth-Pfad
   anbinden; keine Zugangsdaten an den Client serialisieren.
3. Rollenabhängige Ziele und Fehlermeldungen testen.
4. Auth-Seiten im Demo-Modus auf Rollenauswahl verweisen und Mailpit-Texte
   vollständig entfernen.
5. Mobile Reihenfolge auf primäre Anmeldung vor Marketinginhalt ändern.

### Prüfung

```powershell
pnpm test
pnpm test:integration
pnpm exec tsc --noEmit
```

### Commit

```text
feat: add self service public demo entry
```

## Task 4: Betriebsshell, Dashboard und Bestellfreigabe härten

### Dateien

- `src/components/app-shell.tsx`
- `src/components/dashboard.tsx`
- `src/components/demand-planner.tsx`
- neue kleine Demo-Banner-/Dialogkomponenten
- Admin- und Supportlayouts beziehungsweise Navigationskomponenten
- `src/app/globals.css`
- zugehörige Komponenten- und Action-Tests

### Umsetzung

1. Globale Demo-Leiste in allen geschützten Rollenbereichen ergänzen.
2. Unfertige Module aus der primären Navigation entfernen und als nicht
   interaktive Roadmap darstellen.
3. Funktionslose Dashboard-Aktionen entfernen und Beispielwerte eindeutig
   kennzeichnen.
4. Bestätigungsdialog mit Zusammenfassung, Fokusführung und bestehender
   Serveraktion implementieren.
5. Admin-Mobile-Menü sowie aktive Admin-/Supportnavigation ergänzen.
6. Responsive Kartenlayouts und Touch-Ziele anpassen.

### Prüfung

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm lint
```

### Commit

```text
feat: harden core demo workflows and navigation
```

## Task 5: Website-Editor und Domain-Demo vervollständigen

### Dateien

- `src/components/website-editor.tsx`
- `src/app/app/website/actions.ts`
- neue isolierte Editor-Unterkomponenten nur bei klarer Verantwortung
- `src/app/globals.css`
- Komponenten-, Validierungs- und Integrationstests

### Umsetzung

1. Logo wählen, clientseitig vorprüfen, als Data-URL vorschauen und entfernen.
2. Merkmalsauswahl mit fester Allowlist einbauen.
3. Öffnungszeiten hinzufügen, entfernen und sortieren.
4. Gerichte vollständig bearbeiten, hinzufügen, entfernen und sortieren.
5. Dirty-State und `beforeunload`-Warnung erhalten.
6. Domainstatus, Plattformadresse, SSL-Zustand und getrennte Domainvormerkung
   darstellen.
7. Editor in fokussierte Unterkomponenten zerlegen, ohne unnötige
   Client-Bundles oder duplizierte Zustände zu erzeugen.

### Prüfung

```powershell
pnpm test
pnpm test:integration
pnpm exec tsc --noEmit
```

### Commit

```text
feat: complete the demo storefront editor
```

## Task 6: Öffentliche Ladenwebsite und Muster-Rechtsseiten verbessern

### Dateien

- `src/components/storefront.tsx`
- `src/app/laden/[slug]/page.tsx`
- neue Routen unter `src/app/laden/[slug]/impressum` und `datenschutz`
- gemeinsame Storefront-Rechtsseitenkomponente
- `src/app/globals.css`
- öffentliche Seiten- und Accessibility-Tests

### Umsetzung

1. Logo beziehungsweise Initialenfallback und ausgewählte Merkmale rendern.
2. Fest codierte Ladenbehauptungen entfernen.
3. Mobile Abstände und alle Touch-Ziele korrigieren.
4. Footer auf echte Muster-Rechtsrouten verlinken.
5. Seiten als Demo-Muster kennzeichnen und keine Betreiberangaben erfinden.
6. Metadata, Nicht-Veröffentlichungsfall und Information-only-Grenze erhalten.

### Prüfung

```powershell
pnpm test
pnpm build
pnpm exec tsc --noEmit
```

### Commit

```text
feat: improve public demo storefront accessibility
```

## Task 7: Browser- und Gesamtregression

### Dateien

- vorhandene Playwright-Konfiguration
- neue oder erweiterte E2E-Spezifikationen
- Produktions-Rollensmoke nur soweit neue Einstiegsziele betroffen sind

### Umsetzung

1. Desktop-Chromium, Mobile-Chromium und Mobile-WebKit testen.
2. Ein-Klick-Anmeldung aller fünf Rollen und ihre Zugriffsgrenzen prüfen.
3. Bestätigungsdialog, Abbruch, Freigabe und Mitarbeitergrenze prüfen.
4. Admin-Mobile-Navigation und aktive Zustände prüfen.
5. Website-Editor einschließlich Logo, Features, Stunden, Menü und
   Domainvormerkung prüfen.
6. Öffentliche Website, Muster-Rechtsseiten, 404, Touch-Ziele, Kontrast,
   Fokus und Overflow prüfen.
7. Browserkonsole auf neue Fehler untersuchen.

### Qualitätskette

```powershell
pnpm lint
pnpm test
pnpm test:integration
pnpm exec tsc --noEmit
pnpm build
pnpm test:e2e
pnpm audit --prod
git diff --check
```

### Commit

```text
test: cover the complete demo UI UX release
```

## Task 8: Produktionsabnahme und Live-Deployment

### Umsetzung

1. Produktions-Compose lokal mit getrennten Testdaten starten.
2. Migration und Seed mehrfach ausführen und Persistenz nach Neustart prüfen.
3. Produktionsimage als Nicht-Root-Benutzer und Healthcheck prüfen.
4. Backup erstellen und in eine getrennte Prüfdatenbank restaurieren.
5. Getesteten Commit über den bestehenden versionierten Deploy-Ablauf auf den
   Kebapp-Hetzner-Server bringen.
6. Nach Deployment Rollen, öffentliche Seiten, Domain-Demo, HTTPS,
   Containerzustand und Logs prüfen.
7. Kontrollierten Neustart durchführen und Datenpersistenz bestätigen.
8. Arbeitsbaum sauber hinterlassen und Zugangsdaten weiterhin ausschließlich
   in den ignorierten lokalen/Server-Env-Dateien halten.

### Abnahme

- alle Kriterien aus Abschnitt 15 der Spezifikation erfüllt
- bestehender Backup-Timer aktiv
- öffentliche URL liefert gültiges HTTPS
- App, Caddy und PostgreSQL gesund
- keine neuen ungeklärten Fehler in App- oder Browserlogs

