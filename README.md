# Kebapp

Kebapp ist der lokale MVP für betreuten Gruppeneinkauf und ein digitales
Betriebssystem für unabhängige Dönerläden im NRW-Piloten. Der aktuelle Schnitt
umfasst:

- Registrierung mit E-Mail-Bestätigung und persönlich geprüftem Ladenantrag
- getrennte Rollen für Plattform-Admin, Support, Inhaber:in und Mitarbeiter:in
- Fleischbedarf je Laden und regionale Sammelrunden
- Einladungen für Mitarbeitende
- Website-Editor und veröffentlichbare Ladenwebsite
- PostgreSQL-Mandantentrennung mit Row Level Security und Auditereignissen

Die Ladenwebsite ist eine reine Informationsseite. Warenkorb, Onlinebestellung,
Zahlung sowie Domain-/SSL-Automation sind bewusst noch nicht enthalten.

## Lokal starten

Voraussetzungen sind Node.js 20.9 oder neuer, pnpm und Docker Compose. Unter
Windows PowerShell:

```powershell
pnpm install
Copy-Item .env.example .env.local
Copy-Item .env.db.example .env.db.local
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Vor dem ersten Start müssen alle `change-me`-Werte ersetzt werden. Passwörter
und die zugehörigen PostgreSQL-URLs in beiden Env-Dateien müssen zueinander
passen. Anschließend sind erreichbar:

- Anwendung: [http://localhost:3000](http://localhost:3000)
- Mailpit: [http://localhost:8025](http://localhost:8025)
- PostgreSQL: `127.0.0.1:${POSTGRES_PORT}`

Die in `.env.db.local` konfigurierten Konten werden durch `pnpm db:seed`
angelegt. Der Admin prüft den vorbereiteten Pilotantrag unter `/admin/antraege`.
Nach der Freigabe kann sich das Betreiberkonto unter `/app` anmelden; der
Supportzugang sieht nur ausdrücklich zugewiesene Läden.

Alternativ bleibt die Compose-Datei mit Podman nutzbar:

```powershell
podman compose --env-file .env.db.local up -d
```

## Datenbank und Sicherheitsgrenze

`.env.local` enthält ausschließlich die eingeschränkte Laufzeitverbindung.
`.env.db.local` enthält zusätzlich die Besitzerverbindung für Migrationen,
Seeds und Tests. Beide lokalen Dateien sind ignoriert und dürfen nicht
committed werden.

Der feste Laufzeit-Rollenname `kebapp_app` ist Bestandteil der versionierten
RLS-Richtlinien. Eine App-Abfrage setzt Benutzer und ausgewählte Organisation
transaktionslokal; PostgreSQL filtert Daten anderer Läden zusätzlich zur
serverseitigen Rollenprüfung.

Neue Migrationen werden so erstellt und eingespielt:

```powershell
pnpm db:generate
pnpm db:migrate
```

Der E2E- und Integrationstest-Reset verweigert destruktive Änderungen, wenn der
Datenbankname nicht auf `_test` endet. `pnpm test:integration` und
`pnpm test:e2e` setzen ausschließlich die konfigurierte Testdatenbank zurück.

Für einen vollständigen, bewusst destruktiven Reset der lokalen
Entwicklungsdatenbank werden nur die Volumes dieses Compose-Projekts entfernt:

```powershell
docker compose --env-file .env.db.local down --volumes
pnpm infra:up
pnpm db:migrate
pnpm db:seed
```

## Authentifizierung und Mailpit

Better Auth speichert Benutzer, Konten und Sitzungen in PostgreSQL. Vor der
ersten Anmeldung muss die E-Mail-Adresse bestätigt sein. Mailpit fängt lokal
Verifizierungs-, Passwort-Reset- und Einladungsnachrichten ab und versendet
nichts ins Internet.

Verifizierungslinks gelten 60 Minuten, Passwort-Reset-Links 30 Minuten und
Teameinladungen 72 Stunden. Ein erfolgreicher Passwort-Reset widerruft alle
bestehenden Sitzungen des Kontos. Auth- und Rollenentscheidungen werden immer
serverseitig geprüft; ein Sitzungscookie allein erteilt keinen Zugriff.

## Tests

Unit- und Komponententests laufen in jsdom. Integrationstests laufen getrennt
in Node.js gegen PostgreSQL. Die E2E-Abnahme baut die Produktionsvariante,
startet sie auf Port 3100 und nutzt eine eigene `_test`-Datenbank sowie Mailpit.

```powershell
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Die Browser-Abnahme deckt Registrierung bis Admin-Freigabe, Einladung und
Mitarbeiterrechte, zwei getrennte Ladenkonten, eine direkte RLS-Abfrage sowie
die öffentliche Website auf Desktop-Chromium, schmalem Android-Chromium und
mobilem WebKit ab. Ausstehende oder pausierte Läden liefern öffentlich 404; die
aktive Website enthält keine Bestell- oder Bezahlaktion.

Infrastrukturstatus und Logs:

```powershell
pnpm infra:config
pnpm infra:logs
pnpm infra:down
```

## Abhängigkeiten und Freigabehinweise

Geprüft am 22. August 2026:

```powershell
pnpm licenses list --prod
pnpm audit --prod
```

Der Lizenzbestand besteht überwiegend aus MIT-, Apache-, BSD-, ISC-, MPL- und
OFL-Lizenzen. Die Windows-Binärdistribution von Sharp wird als
`Apache-2.0 AND LGPL-3.0-or-later` ausgewiesen und muss vor einer kommerziellen
Distribution zusammen mit den übrigen Drittanbieterhinweisen fachkundig
geprüft werden.

`pnpm audit --prod` meldet derzeit eine moderate Schwachstelle
(`GHSA-67mh-4wv8-2f99`) in `esbuild@0.18.20`. Sie liegt transitiv in
`better-auth > drizzle-kit > @esbuild-kit/esm-loader` und betrifft den
esbuild-Entwicklungsserver, nicht den Next.js-Produktionsserver. Vor einem
Release muss diese Kette regulär aktualisiert und der Audit erneut ausgeführt
werden; ein ungetesteter Zwangs-Override ist nicht eingecheckt.

Diese technische Prüfung ersetzt weder eine Lizenz- noch eine
Datenschutzberatung. Vor Hetzner-Hosting, echten Kundendaten, Domainregistrierung
oder Auftragsverarbeitung sind insbesondere AV-Verträge, Löschkonzept,
Datenschutzerklärung, TOMs, Backup/Restore und Drittanbietertexte fachkundig zu
prüfen.

## Dokumentation

- Produkt- und Pilotentwurf: `docs/superpowers/specs/2026-08-20-kebapp-doenerladen-betriebssystem-design.md`
- Auth-/Mandantenentwurf: `docs/superpowers/specs/2026-08-21-kebapp-auth-mandanten-postgresql-design.md`
- MVP-Plan: `docs/superpowers/plans/2026-08-21-kebapp-mvp-vertical-slice.md`
- Auth-/Mandantenplan: `docs/superpowers/plans/2026-08-21-kebapp-auth-mandanten-postgresql.md`
