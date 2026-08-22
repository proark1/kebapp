# Kebapp – Implementierungsplan für die öffentliche Hetzner-Demo

Stand: 22. August 2026

Ziel ist die im Entwurf
`docs/superpowers/specs/2026-08-22-kebapp-hetzner-demo-deployment-design.md`
freigegebene öffentliche Demo auf einem Hetzner CX23 in Nürnberg. Die
Implementierung bleibt in klar getrennte App-, Container-, Betriebs- und
Provisionierungsschritte zerlegt. Kostenpflichtige Hetzner-Ressourcen werden
erst erstellt, nachdem alle lokalen Prüfungen grün sind.

## Task 1: Expliziten Demo-Modus einführen

### Dateien

Neu:

- `src/server/demo/demo-mode.ts`
- `src/server/demo/demo-mode.test.ts`

Ändern:

- `src/lib/env.ts`
- `src/lib/env.test.ts`
- `src/lib/auth.ts`
- `src/app/(auth)/actions.ts`
- `src/app/(auth)/registrieren/page.tsx`
- `src/app/(auth)/passwort-vergessen/page.tsx`
- `src/app/(auth)/email-bestaetigen/page.tsx`
- `src/app/app/einstellungen/team/actions.ts`
- `src/app/app/einstellungen/team/page.tsx`
- betroffene Komponenten- und Action-Tests
- `.env.example`

### Umsetzung

1. `DEMO_MODE` als expliziten booleschen Runtime-Wert parsen; Standard bleibt
   `false`, damit lokale und spätere produktive Umgebungen ihr bisheriges
   Verhalten behalten.
2. SMTP-Werte nur außerhalb des Demo-Modus verpflichtend machen.
3. Einen zentralen serverseitigen Demo-Guard anlegen, der E-Mail- und
   Registrierungsaktionen mit einem typisierten Ergebnis ablehnt.
4. Registrierung, Verifizierungsversand, Passwort-Reset-Anforderung und neue
   Teameinladungen vor jeder Mutation und vor jedem Mailversand blockieren.
5. Die zugehörigen Seiten erhalten einen sichtbaren Demo-Hinweis und deaktivierte
   Bedienelemente; die Serverprüfung bleibt die verbindliche Grenze.
6. Anmeldung, bestehende Sitzungen, Rollen und alle Nicht-E-Mail-Funktionen
   bleiben unverändert.
7. Unit-Tests prüfen Env-Kombinationen, jeden blockierten Serverpfad und den
   unveränderten Nicht-Demo-Pfad.

### Prüfung

```powershell
pnpm lint
pnpm test
pnpm exec tsc --noEmit
```

### Commit

```text
feat: add explicit public demo mode
```

## Task 2: Idempotente öffentliche Demo-Daten bereitstellen

### Dateien

Neu:

- `scripts/production-env.ts`
- `scripts/production-env.test.ts`
- `scripts/migrate-production.ts`
- `scripts/seed-public-demo.ts`
- `scripts/seed-public-demo.integration.test.ts`
- `infra/postgres/init/002-create-production-runtime-role.sh`
- `.env.production.example`

Ändern:

- `package.json`
- bestehende Seed-Helfer nur soweit zur Vermeidung doppelter Logik nötig

### Umsetzung

1. Eine Produktions-Env-Struktur für Owner- und App-URL, Demo-Konten und
   öffentliche Basis-URL definieren, ohne Testdatenbankfelder vorauszusetzen.
2. Das Produktions-Init-Skript legt ausschließlich `kebapp_app` an, vergibt
   minimale Rechte und erstellt keine Testdatenbank.
3. Der Migrationsrunner verwendet ausschließlich die Owner-Verbindung und die
   versionierten Drizzle-Migrationen.
4. Der Demo-Seed erzeugt transaktional und idempotent bestätigte Konten für
   Admin, Support, Inhaber:in und Mitarbeiter:in sowie zwei aktive Läden,
   Supportzuweisung, offene Sammelrunden, getrennte Bedarfe und eine
   veröffentlichte Website.
5. Passwörter kommen ausschließlich aus der Server-Env. Der Seed gibt weder
   Passwörter noch Verbindungsstrings aus und überschreibt vorhandene
   Passwort-Hashes nicht ungefragt.
6. Integrationstests führen den Seed zweimal auf `_test` aus und beweisen
   gleichbleibende Datensatzanzahl, aktive Rollen und Mandantentrennung.

### Prüfung

```powershell
pnpm test
pnpm test:integration
pnpm exec tsc --noEmit
```

### Commit

```text
feat: add idempotent public demo provisioning
```

## Task 3: Next.js als schlankes Container-Image ausliefern

### Dateien

Neu:

- `Dockerfile`
- `.dockerignore`
- `compose.production.yaml`
- `deploy/Caddyfile`
- `src/app/api/health/route.ts`
- `src/app/api/health/route.test.ts`

Ändern:

- `next.config.ts`
- `package.json`
- `.gitignore`

### Umsetzung

1. Vor den Next.js-Änderungen die einschlägige lokale Next-16-Dokumentation zu
   Self-Hosting, Standalone-Ausgabe, Umgebungswerten und Healthchecks vollständig
   lesen.
2. `output: "standalone"` aktivieren und ein mehrstufiges, nicht als Root
   laufendes App-Image bauen.
3. Einen getrennten Tooling-Target für Migration und Seed bereitstellen, damit
   Buildwerkzeuge nicht in der App-Laufzeitstufe liegen.
4. Einen Health-Endpunkt implementieren, der Prozess und Datenbank prüft, keine
   internen Details ausgibt und bei fehlender DB mit 503 antwortet.
5. Die Produktions-Compose-Datei enthält PostgreSQL, Migration/Seed als
   explizite Einmal-Tasks, Kebapp und Caddy in einem internen Netz.
6. Nur Caddy veröffentlicht 80/443. PostgreSQL und App-Port bleiben intern.
7. Benannte Volumes halten PostgreSQL- und Caddy-Daten. Alle dauerhaften
   Container erhalten Healthchecks, Restart-Policy und begrenzte JSON-Logs.
8. Caddy erzwingt HTTPS für `${KEBAPP_HOST}` und leitet ausschließlich an eine
   gesunde App weiter.

### Prüfung

```powershell
docker compose --env-file .env.production.example -f compose.production.yaml config
docker build --target app -t kebapp:local .
pnpm lint
pnpm test
pnpm build
```

### Commit

```text
build: containerize the public demo
```

## Task 4: Provisionierung, Backup, Restore und Rollback automatisieren

### Dateien

Neu:

- `deploy/cloud-init.yaml.tmpl`
- `deploy/scripts/bootstrap-release.sh`
- `deploy/scripts/deploy.sh`
- `deploy/scripts/backup-postgres.sh`
- `deploy/scripts/restore-postgres.sh`
- `deploy/scripts/rollback.sh`
- `deploy/scripts/smoke-test.sh`
- `deploy/systemd/kebapp-backup.service`
- `deploy/systemd/kebapp-backup.timer`
- `docs/runbooks/hetzner-demo.md`

Ändern:

- `README.md`

### Umsetzung

1. Cloud-Init installiert Docker, legt `deploy` an, hinterlegt genau einen
   übergebenen SSH-Key, deaktiviert Passwort-/Root-SSH, richtet 2 GB Swap,
   automatische Sicherheitsupdates, Zeitzone und Logrotation ein.
2. `bootstrap-release.sh` legt die Verzeichnisstruktur und restriktive
   Dateirechte an, ohne Geheimnisse zu erzeugen oder auszugeben.
3. `deploy.sh` baut zuerst das neue Image, erstellt einen DB-Dump, führt
   Migration und Seed aus, aktualisiert App/Caddy und prüft Health sowie HTTPS.
4. Das vorherige Image-Tag wird erst nach erfolgreichem Smoke-Test verworfen.
5. Backup und Restore validieren Datenbankname und Ziel, verwenden temporäre
   Dateien sicher und geben keine Zugangsdaten aus.
6. Der Timer erzeugt täglich komprimierte Dumps und entfernt nur eindeutig
   aufgelöste alte Dumps im vorgesehenen Backup-Verzeichnis.
7. Das Runbook erklärt Status, Logs, Restore in eine Prüf-DB, App-Rollback,
   Hetzner-Backup-Restore, Firewall-IP-Wechsel und Hostnamenwechsel.
8. Shellskripte werden syntaktisch geprüft; destruktive Restore-Schritte
   erfordern einen expliziten Zielnamen und eine Bestätigung.

### Prüfung

```text
bash -n deploy/scripts/*.sh
docker compose --env-file .env.production.example -f compose.production.yaml config
```

### Commit

```text
ops: add hardened Hetzner demo deployment
```

## Task 5: Lokale Gesamtfreigabe

### Umsetzung

1. Unit-, Integration- und E2E-Trennung erneut prüfen.
2. Produktions-Compose lokal mit separater Test-Env hochfahren.
3. Migration und Demo-Seed zweimal ausführen.
4. HTTPS lokal mit einer für die Prüfung geeigneten Caddy-Konfiguration oder
   Container-internem HTTP prüfen; öffentliches Let's Encrypt wird erst auf der
   echten IP getestet.
5. Alle Rollen anmelden, Demo-Blockaden und öffentliche Website prüfen.
6. Image-Neustart und PostgreSQL-Persistenz prüfen.
7. Backup erzeugen und in eine getrennte Prüfdatenbank zurückspielen.
8. Lizenzinventar und Audit erneut ausführen und neue Befunde dokumentieren.
9. `git diff --check` und sauberen Arbeitsbaum sicherstellen.

### Qualitätskette

```powershell
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm licenses list --prod
pnpm audit --prod
```

## Task 6: Hetzner-Ressourcen erstellen

### Externe Schritte

1. In der Hetzner Cloud Console ein Projekt `kebapp-demo` auswählen oder
   erstellen.
2. Vor der kostenpflichtigen Erstellung die sichtbare Zusammenfassung mit dem
   Nutzer prüfen: CX23, NBG1, Ubuntu 24.04, IPv4, IPv6, Backups.
3. Vorhandenen SSH-Public-Key verwenden oder lokal einen eigenen
   `kebapp-demo`-Key erzeugen; private Schlüssel niemals hochladen oder
   anzeigen.
4. Cloud-Firewall `kebapp-demo` mit 80/443 öffentlich und 22 ausschließlich von
   der aktuellen Admin-IP anlegen.
5. Cloud-Init aus der geprüften Vorlage einfügen und den Server erstellen.
6. Bereitstellung abwarten, Backupstatus, IPs, Firewall und SSH-Key-Zuordnung
   kontrollieren.
7. Temporären Hostnamen aus der IPv4 als `<ip-mit-bindestrichen>.sslip.io`
   bilden und DNS-Auflösung prüfen.

Der Serverkauf ist die erste kostenpflichtige externe Mutation und wird nicht
mit Codeänderungen oder anderen unbestätigten Käufen gebündelt.

## Task 7: Geheimnisse setzen und öffentlich deployen

### Externe Schritte

1. Zufällige Datenbankpasswörter, Better-Auth-Secret und Demo-Passwörter lokal
   erzeugen, ohne sie in Terminalausgaben zu schreiben.
2. Die Env-Datei über SSH mit Modus 600 auf dem Server anlegen.
3. Getesteten Commit und Deploymentdateien übertragen.
4. Produktions-Compose starten, Migration und Seed ausführen.
5. Caddy-Zertifikatsausstellung abwarten und HTTPS prüfen.
6. Einmalige Demo-Zugangsdaten sicher an den Nutzer übergeben.
7. Keine Geheimnisse in Git, Chatantwort, Prozessliste oder Logs aufnehmen.

## Task 8: Live-Abnahme und Abschluss

### Prüfung

1. HTTP leitet auf HTTPS um; Zertifikat und Hostname sind gültig.
2. Aktive öffentliche Website liefert 200, ausstehende/pausierte Websites 404.
3. Keine Bestell- oder Bezahlfunktion ist vorhanden.
4. Admin, Support, Inhaber:in und Mitarbeiter:in besitzen exakt ihre Rechte.
5. Direkte und UI-basierte Mandantentrennung bleibt aktiv.
6. Registrierung, Passwort-E-Mail und Einladungsversand sind sichtbar und
   serverseitig blockiert.
7. Externer Portscan zeigt nur 22 aus zugelassener Quelle sowie 80/443.
8. Container sind gesund und starten nach einem kontrollierten Serverneustart.
9. Manueller Dump und Restore in eine getrennte Prüfdatenbank funktionieren.
10. Hetzner zeigt aktive Backups.
11. Öffentliche URL, Server-ID, Betriebshinweise und nächster Domain-/SMTP-Schritt
    werden ohne Geheimnisse dokumentiert.

### Abschluss

Der Arbeitsbaum muss sauber sein. Code- und Betriebsänderungen sind committed;
serverindividuelle IPs und Zugangsdaten bleiben außerhalb des Repositorys.
