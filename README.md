# Kebapp

Kebapp ist der lokale MVP für betreuten Gruppeneinkauf und ein digitales
Betriebssystem für unabhängige Dönerläden im NRW-Piloten. Der aktuelle Schnitt
umfasst:

- Registrierung mit E-Mail-Bestätigung und persönlich geprüftem Ladenantrag
- getrennte Rollen für Plattform-Admin, Support, Inhaber:in und Mitarbeiter:in
- Fleischbedarf je Laden und regionale Sammelrunden inkl. Admin-Rundenverwaltung
  (`/admin/runden`), automatischem Bestellschluss, Erinnerungs-E-Mails und
  Bündel-Export (CSV)
- Stammbedarf-Vorlagen je Laden zum Wiederverwenden in neuen Runden
- Einladungen für Mitarbeitende
- Website-Editor und veröffentlichbare Ladenwebsite
- Gäste mit Stempelkarte, Bestellhistorie und Plattformimport (`/app/gaeste`)
- PostgreSQL-Mandantentrennung mit Row Level Security und Auditereignissen

Die Ladenwebsite bleibt eine Informationsseite mit WhatsApp-Übergabe. Warenkorb,
Bezahlung und Domain-/SSL-Automation sind bewusst nicht enthalten. Neu ist, dass
die vorbereitete Bestellung auf ausdrücklichen Wunsch des Gastes zusätzlich als
Datensatz im Laden gespeichert wird; ohne gesetzten Haken entsteht wie bisher
kein Datensatz. Die Nachricht sendet der Gast weiterhin selbst in WhatsApp.

Die öffentliche Demo-Variante läuft ohne Registrierung, Passwort-E-Mails und
Teameinladungsversand. Sie verwendet ausschließlich vorbereitete, synthetische
Konten; Anmeldung und serverseitige Rollenprüfung bleiben aktiv.

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
passen. Für Commits empfiehlt sich zusätzlich der versionierte
Geheimnis-Scan-Hook (`pnpm hooks:install`, einmalig je Klonauscheck).
Anschließend sind erreichbar:

- Anwendung: [http://localhost:3000](http://localhost:3000)
- Mailpit: [http://localhost:8025](http://localhost:8025)
- PostgreSQL: `127.0.0.1:${POSTGRES_PORT}`

Die in `.env.db.local` konfigurierten Konten werden durch `pnpm db:seed`
angelegt. Der Admin prüft den vorbereiteten Pilotantrag unter `/admin/antraege`.
Nach der Freigabe kann sich das Betreiberkonto unter `/app` anmelden; der
Supportzugang sieht nur ausdrücklich zugewiesene Läden.

Beide Seeds füllen zusätzlich jede Betriebsansicht mit Beispieldaten
(`scripts/seed-demo-operations.ts`): Tagesumsätze bis einschließlich heute,
Hygieneprotokolle mit ausgefülltem Tages-Check, Arbeitszeiten mit Vermerken und
Korrekturen, Eingangsrechnungen mit Fälligkeiten, überfälligen Posten und einer
importierten XRechnung, Kalkulationen mit eigener Rezeptur je Gericht, zwei
abgeschlossene Runden — eine mit erfasstem Wareneingang, eine noch offene —,
Lieferantenzuschläge, Stammbedarf-Vorlage sowie Gäste mit Bestellhistorie,
Notizen und Stempelkarte.

Die öffentliche Demo legt darüber hinaus die Plattformdaten an
(`scripts/seed-demo-platform.ts`): Ladenanträge in allen Zuständen, ein
Ladenverzeichnis mit aktiven, pausierten und abgelehnten Betrieben, Domain-
Wünsche, Einladungen, Supporteinsätze und eine Auditspur. Sechs Nachbarläden
melden ihren Bedarf in dieselbe Sammelrunde — ohne sie bliebe die Gruppenmenge
bei den zwei Demo-Betrieben stehen und jede ausgewiesene Ersparnis wäre null
oder negativ.

Alle Kennungen sind fest, sodass ein erneuter Lauf die Daten auffrischt, statt
sie zu verdoppeln.

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

Die öffentliche Ladenseite hat keinen Mandantenkontext. Sie schreibt deshalb
ausschließlich über die eng geschnittene Definer-Funktion
`kebapp_private.record_storefront_order`. Diese löst den Laden über den
veröffentlichten Slug auf, prüft Bestellart, Gericht und Menge und entnimmt den
Preis dem gespeicherten Menü – nie der Anfrage. Ein Gast löschen darf nur die
Inhaberrolle; die Löschung entfernt Bestellungen, Positionen und Stempel per
`ON DELETE CASCADE` und wird als Auditereignis protokolliert.

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

Ohne Angabe erzwingt der Versand in der Produktionsumgebung STARTTLS. Mailpit
beherrscht das nicht, deshalb setzt `.env.example` und die E2E-Abnahme
`SMTP_REQUIRE_TLS=false`. Für einen echten Relay bleibt die Variable weg.

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
Datenschutzberatung. Die veröffentlichte Demo enthält deshalb keine echten
Kunden- oder Zahlungsdaten. Eine formale DSGVO-Prüfung ist für diesen
Demo-Schritt bewusst nicht Bestandteil der technischen Freigabe; vor echten
Kundendaten oder Auftragsverarbeitung bleibt sie separat nachzuholen.

Das gilt besonders für das Gästemodul: Es speichert Telefonnummer, Namen und
Bestellhistorie und ist technisch auf Einwilligung, Auskunft und Löschung
vorbereitet (Einwilligungszeitpunkt und -quelle je Gast, Löschung durch die
Inhaberrolle, Auditereignis `GUEST_DELETED`). Verzeichnis von
Verarbeitungstätigkeiten, Auftragsverarbeitungsvertrag, Aufbewahrungsfristen
und Datenschutzerklärung des Ladens sind damit **nicht** erledigt und müssen
vor dem ersten echten Gastdatensatz vorliegen.

## Öffentliche Demo betreiben

Die Produktionsvariante nutzt ein Standalone-App-Image, PostgreSQL und Caddy.
Nur Caddy veröffentlicht Ports; die Datenbank bleibt im internen
Compose-Netzwerk. `.env.production.example` dokumentiert die erforderlichen
Werte, darf aber nicht mit den Platzhaltern produktiv verwendet werden.

```bash
pnpm prod:env:create -- --host HOST \
  --output .env.kebapp-production \
  --access-output .env.kebapp-demo-access.txt
scp .env.kebapp-production deploy@SERVER:/opt/kebapp/shared/.env.production
# Anschließend auf dem Server:
docker compose --env-file /opt/kebapp/shared/.env.production \
  -f compose.production.yaml up -d
```

Der generierte lokale Dateiname wird von Next.js nicht automatisch geladen. Auf
dem Server wird dieselbe Datei mit Modus `0600` als
`/opt/kebapp/shared/.env.production` abgelegt.

Die Produktionsumgebung erzwingt eine bewusste Entscheidung zum Demo-Modus:
`compose.production.yaml` verlangt `DEMO_MODE` explizit, und die Anwendung
startet mit `DEMO_MODE=true` nur, wenn zusätzlich `ALLOW_PUBLIC_DEMO=true`
gesetzt ist. Für echten Betrieb mit echten Daten gelten beide Werte als
`false`; der Ein-Klick-Demo-Login (`src/app/demo-actions.ts`) ist damit
vollständig deaktiviert.

Provisionierung, Deployment, tägliche Dumps, Restore-Probe und Rollback sind im
[Hetzner-Demo-Runbook](docs/runbooks/hetzner-demo.md) beschrieben.

## Dokumentation

- Produkt- und Pilotentwurf: `docs/superpowers/specs/2026-08-20-kebapp-doenerladen-betriebssystem-design.md`
- Auth-/Mandantenentwurf: `docs/superpowers/specs/2026-08-21-kebapp-auth-mandanten-postgresql-design.md`
- MVP-Plan: `docs/superpowers/plans/2026-08-21-kebapp-mvp-vertical-slice.md`
- Auth-/Mandantenplan: `docs/superpowers/plans/2026-08-21-kebapp-auth-mandanten-postgresql.md`
- Hetzner-Demo-Runbook: `docs/runbooks/hetzner-demo.md`
