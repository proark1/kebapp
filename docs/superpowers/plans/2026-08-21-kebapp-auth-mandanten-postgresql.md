# Kebapp: Implementierungsplan für Authentifizierung, Mandanten und PostgreSQL

**Stand:** 21. August 2026<br>
**Status:** Umsetzungsbereit nach freigegebener technischer Spezifikation<br>
**Grundlage:** docs/superpowers/specs/2026-08-21-kebapp-auth-mandanten-postgresql-design.md

## Ziel

Dieser Plan ersetzt die lokale Browser-Persistenz des Kebapp-Prototyps durch eine echte, lokal betreibbare Plattformgrundlage. Am Ende können sich Betreiber registrieren und verifizieren, einen Laden zur Freigabe einreichen, als Ladeninhaber oder Mitarbeiter arbeiten und strikt getrennte Einkaufs- und Website-Daten in PostgreSQL verwalten.

Die Umsetzung bleibt lokal. PostgreSQL und Mailpit laufen in Containern, die Next.js-Anwendung direkt auf dem Entwicklungsrechner. Es werden weder Hetzner noch INWX, echte Domains, produktiver E-Mail-Versand, Onlinebestellungen oder Zahlungen angebunden.

## Verbindlicher technischer Rahmen

- Next.js 16.3.1, React 19.2.8 und TypeScript 6
- Better Auth 1.7.1
- separater Better-Auth-Drizzle-Adapter 1.7.1
- eigenständig gepinnte Auth-CLI 1.7.1
- Drizzle ORM 0.45.2 und Drizzle Kit 0.31.10
- node-postgres als PostgreSQL-Treiber
- PostgreSQL mit fest gepinntem Major-Container-Image
- Mailpit als rein lokale SMTP-Testmailbox
- Nodemailer für die SMTP-Anbindung
- Zod für serverseitige Eingabe- und Umgebungsvalidierung
- Vitest für Einheiten-, Komponenten- und Datenbankintegrationstests
- Playwright für die vollständigen Browserabläufe

Die bei der Planung verwendeten Next.js-16-Leitfäden liegen im Repository unter:

- node_modules/next/dist/docs/01-app/02-guides/authentication.md
- node_modules/next/dist/docs/01-app/02-guides/forms.md
- node_modules/next/dist/docs/01-app/02-guides/server-actions.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
- node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
- node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
- node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md

Vor jeder späteren Codeänderung werden die für den jeweiligen Schritt zusätzlich relevanten lokalen Next.js-Dokumente erneut geprüft.

## Sicherheits- und Arbeitsregeln

1. Server Components bleiben der Standard. Client Components erhalten nur ausdrücklich freigegebene DTOs.
2. Jede Server Action wird wie ein öffentlich erreichbarer POST-Endpunkt behandelt und prüft Sitzung, Berechtigung und Eingaben selbst.
3. proxy.ts prüft höchstens optimistisch, ob ein Sitzungscookie vorhanden ist. Es führt keine Datenbankabfragen aus und ist keine Sicherheitsgrenze.
4. Die echte Autorisierung liegt in einer server-only Data-Access-Schicht unmittelbar vor der Datenbank.
5. Die Anwendung verbindet sich zur Laufzeit niemals als Datenbankbesitzer, Superuser oder Rolle mit BYPASSRLS.
6. Jede fachliche Mandantenabfrage läuft in einer Transaktion mit transaktionslokalem Benutzer- und Organisationskontext.
7. Vom Browser übermittelte IDs wählen nur ein Zielobjekt. Besitz, Mandant und Rolle werden erneut aus vertrauenswürdigen Daten ermittelt.
8. Authentifizierungstabellen werden durch Better Auth erzeugt. Kebapp-Rollen und Organisationen bleiben eigene Tabellen.
9. Jede sicherheitsrelevante Funktion beginnt mit einem fehlschlagenden Test. Nach der minimalen Implementierung muss dieser Test erfolgreich sein.
10. Nach jedem Aufgabenpaket laufen mindestens die betroffenen Tests, Lint und TypeScript beziehungsweise der Produktions-Build in angemessenem Umfang.
11. Lokale Seed-Zugangsdaten und Geheimnisse werden ausschließlich aus ignorierten Umgebungsdateien gelesen.
12. Echte Betreiber-, Mitarbeiter- oder Kundendaten werden weder als Seed noch als Testfixture eingecheckt.

## Aufgabe 1: Lokale Infrastruktur und reproduzierbare Konfiguration

### Dateien

Neu:

- compose.yaml
- infra/postgres/init/001-create-runtime-role.sh
- .gitattributes
- .env.example
- .env.db.example
- src/lib/env.ts
- src/lib/env.test.ts
- scripts/db-env.ts
- scripts/db-env.test.ts
- drizzle.config.ts

Ändern:

- package.json
- pnpm-lock.yaml
- .gitignore
- README.md

### Schritte

1. Fehlschlagende Tests für die Laufzeit- und CLI-Umgebungsvalidierung anlegen. Sie prüfen fehlende URLs, ein zu kurzes Better-Auth-Geheimnis und identische Laufzeit- und Besitzerverbindungen.
2. Better Auth, den separaten Drizzle-Adapter, Drizzle ORM, pg, Nodemailer, Zod und server-only als Laufzeitabhängigkeiten installieren.
3. Drizzle Kit, die eigenständige Auth-CLI, tsx, dotenv, Typdefinitionen für pg und Nodemailer sowie Playwright als Entwicklungsabhängigkeiten installieren. Alle Versionen werden durch pnpm-lock.yaml festgehalten; es werden keine latest-Aufrufe in Projektskripten verwendet.
4. compose.yaml mit PostgreSQL und Mailpit anlegen. Beide Dienste erhalten Healthchecks und benannte Volumes. Das PostgreSQL-Image wird auf einen Major-Stand gepinnt, Mailpit auf eine konkrete Version.
5. Das PostgreSQL-Initialisierungsskript erstellt eine eingeschränkte Laufzeitrolle aus lokalen Container-Umgebungsvariablen. Die Besitzerrolle wird ausschließlich für Migration und Seed verwendet.
6. .gitattributes erzwingt für Shell-Skripte LF-Zeilenenden, damit das Linux-Init-Skript auch aus einem Windows-Checkout zuverlässig startet.
7. .env.example dokumentiert ausschließlich die vom Next.js-Laufzeitprozess benötigten Werte: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, SMTP_HOST, SMTP_PORT und SMTP_FROM.
8. .env.db.example dokumentiert DATABASE_OWNER_URL, Containerrollen, Testdatenbank und lokale Seed-Benutzer. Die reale .env.db.local wird nur von Compose, Migrationen, Seed und Integrationstests explizit geladen; Next.js lädt sie nicht.
9. src/lib/env.ts validiert nur die Laufzeitvariablen. scripts/db-env.ts lädt und validiert getrennt die CLI- und Besitzerwerte. Geheimnisse werden nicht mit NEXT_PUBLIC_ gekennzeichnet.
10. package.json erhält reproduzierbare Skripte für Infrastrukturstart, Migration, Seed, Integrationstests und E2E-Tests.
11. README.md erklärt Podman als bevorzugten Weg und nennt die kompatible Docker-Compose-Alternative.

### Prüfung

    pnpm test src/lib/env.test.ts scripts/db-env.test.ts
    podman compose config
    podman compose up -d
    podman compose ps

PostgreSQL muss gesund sein. Mailpit muss lokal erreichbar sein und darf keine Nachricht nach außen senden.

### Commit

    chore: add local postgres and mail infrastructure

## Aufgabe 2: Drizzle-Schema und erste Migration

### Dateien

Neu:

- src/server/db/client.ts
- src/server/db/schema/auth.ts
- src/server/db/schema/platform.ts
- src/server/db/schema/procurement.ts
- src/server/db/schema/storefront.ts
- src/server/db/schema/index.ts
- src/server/db/schema/schema.integration.test.ts
- drizzle/*

Ändern:

- drizzle.config.ts
- package.json

### Schritte

1. Einen Integrationstest anlegen, der auf leerer Testdatenbank die erwarteten Tabellen, Fremdschlüssel, eindeutigen Schlüssel und Statuswerte verlangt.
2. Die Better-Auth-Konfiguration minimal vorbereiten und mit der im Projekt gepinnten Auth-CLI das Drizzle-Schema nach src/server/db/schema/auth.ts generieren. Die Datei wird eingecheckt und bei Better-Auth-Upgrades bewusst neu erzeugt und geprüft.
3. Die Auth-Tabellen user, session, account, verification und die für datenbankgestützte Rate-Limits nötige Tabelle in das gemeinsame Schema aufnehmen.
4. In platform.ts folgende Kebapp-Tabellen definieren:
   - user_profiles
   - platform_roles
   - organizations
   - memberships
   - registration_requests
   - invitations
   - support_assignments
   - audit_events
5. In procurement.ts buying_rounds, demand_submissions und demand_items definieren. demand_submissions bildet den Status DRAFT oder CONFIRMED je Laden und Sammelrunde ab.
6. In storefront.ts store_profiles definieren. Öffnungszeiten und Speisekarte bleiben für diesen Schnitt validierte JSONB-Felder und werden erst bei fachlicher Erweiterung normalisiert.
7. Kebapp-IDs als UUID, Zeitpunkte als timestamptz und Geld- beziehungsweise Mengenwerte als exakte PostgreSQL-Zahlenwerte modellieren.
8. Datenbankconstraints ergänzen:
   - eindeutiger Organisations-Slug
   - höchstens eine Mitgliedschaft je Benutzer und Organisation
   - höchstens eine Einreichung je Organisation und Sammelrunde
   - eindeutige aktive Einladung je Organisation, E-Mail und Rolle
   - gültige positive Mengen
   - zulässige Status- und Rollenwerte
9. Drizzle-Migration erzeugen und mit der Besitzerverbindung auf eine leere lokale Testdatenbank anwenden.

### Prüfung

    pnpm db:generate
    pnpm db:migrate
    pnpm test:integration -- schema.integration.test.ts

Der Test muss außerdem bestätigen, dass die Migration von einer komplett leeren Datenbank reproduzierbar ist.

### Commit

    feat: add postgres schema and migrations

## Aufgabe 3: Datenbankrollen, Row-Level Security und Mandantenkontext

### Dateien

Neu:

- drizzle/*_tenant_security.sql
- src/server/db/tenant-context.ts
- src/server/auth/abilities.ts
- src/server/auth/authorization.ts
- src/server/auth/authorization.test.ts
- src/server/db/tenant-isolation.integration.test.ts
- src/server/testing/database.ts

Ändern:

- src/server/db/client.ts
- src/server/db/schema/platform.ts
- src/server/db/schema/procurement.ts
- src/server/db/schema/storefront.ts

### Schritte

1. Fehlschlagende Autorisierungstests für OWNER, EMPLOYEE, nicht zugewiesenen SUPPORT, zugewiesenen SUPPORT und ADMIN schreiben.
2. Einen fehlschlagenden Datenbanktest schreiben, in dem Laden A versucht, demand_items und store_profiles von Laden B direkt über die Laufzeitrolle zu lesen und zu verändern.
3. Die Fähigkeiten als explizite serverseitige Regeln modellieren. Rollenstrings werden nicht an beliebigen Stellen verglichen.
4. PostgreSQL-Hilfsfunktionen in einem privaten Schema anlegen:
   - aktuellen Benutzer aus einer transaktionslokalen Einstellung lesen
   - aktuelle Organisation aus einer transaktionslokalen Einstellung lesen
   - aktive Mitgliedschaft prüfen
   - Plattform-Admin prüfen
   - aktive Supportzuweisung prüfen
5. Die Suchpfade von SECURITY-DEFINER-Funktionen festsetzen und öffentliche Ausführungsrechte entfernen. Nur die ausdrücklich benötigten Funktionen werden der Laufzeitrolle freigegeben.
6. Row-Level Security für alle Kebapp-Tabellen aktivieren und erzwingen. Auth-Tabellen bleiben außerhalb der Mandanten-RLS, erhalten aber nur die für Better Auth nötigen Laufzeitrechte.
7. Richtlinien nach Zugriffstyp trennen:
   - Eigene Profildaten nur für den aktuellen Benutzer
   - Organisationsdaten nur bei aktiver Mitgliedschaft oder zulässigem Plattformzugriff
   - betriebliche Daten nur für die gesetzte Organisation
   - Schreibzugriffe zusätzlich nach Fähigkeit
   - Admin- und Supportzugriffe ohne allgemeinen RLS-Bypass
8. withTenantContext implementieren. Die server-only Funktion erwartet einen bereits serverseitig ermittelten Akteur, validiert dessen Benutzer-ID und Zielorganisation gegen die Datenbank, startet eine Drizzle-Transaktion, setzt Benutzer und Organisation mit SET LOCAL beziehungsweise set_config und führt den Callback in derselben Transaktion aus. Die Auflösung der Better-Auth-Sitzung wird in Aufgabe 4 davor geschaltet.
9. Tests ergänzen, die eine Pool-Verbindung wiederverwenden und beweisen, dass der Kontext nach Transaktionsende nicht weiterlebt.
10. Der Testdatenbank-Helfer darf nur Datenbanken mit eindeutigem Testnamen zurücksetzen. Vor jedem destruktiven Testschritt wird dieser Name geprüft.

### Prüfung

    pnpm test src/server/auth/authorization.test.ts
    pnpm test:integration -- tenant-isolation.integration.test.ts

Erwartet wird Default-Deny: Fehlt Sitzung, Organisationskontext oder passende Berechtigung, liefert PostgreSQL keine fremde Zeile und erlaubt keine Mutation.

### Commit

    feat: enforce tenant isolation with postgres rls

## Aufgabe 4: Better Auth, Sitzungen und lokale E-Mails

### Dateien

Neu:

- src/lib/auth.ts
- src/lib/auth-client.ts
- src/app/api/auth/[...all]/route.ts
- src/server/auth/session.ts
- src/server/email/mailer.ts
- src/server/email/templates.ts
- src/server/auth/auth.integration.test.ts
- src/proxy.ts

Ändern:

- next.config.ts
- src/server/db/client.ts
- src/server/db/schema/auth.ts

### Schritte

1. Integrationstests für Registrierung, erforderliche E-Mail-Verifizierung, Anmeldung, Abmeldung, Passwort-Zurücksetzen, widerrufene Sitzungen und neutrale Antworten bei unbekannter E-Mail schreiben.
2. Better Auth mit dem Drizzle-Adapter und dem vollständigen Auth-Schema konfigurieren.
3. E-Mail/Passwort aktivieren und mindestens folgende Optionen festlegen:
   - Mindestlänge 12 Zeichen
   - E-Mail-Verifizierung erforderlich
   - Verifizierungsnachricht direkt nach Registrierung
   - zeitlich begrenzte Verifizierungs- und Reset-Links
   - Widerruf bestehender Sitzungen nach Passwort-Reset
4. Datenbankgestützte Rate-Limits auch lokal aktivieren. Für Anmeldung, Registrierung, Verifizierung und Passwort-Reset gelten strengere, dokumentierte Regeln.
5. Nach der vollständigen Auth-Konfiguration das Better-Auth-Drizzle-Schema mit der gepinnten CLI erneut erzeugen, den Diff prüfen und die zusätzliche Rate-Limit-Migration über Drizzle Kit erstellen.
6. Nodemailer ausschließlich gegen Mailpit konfigurieren. Der Absender ist lokal erkennbar und keine echte Unternehmensadresse.
7. nextCookies als letzten Better-Auth-Plugin-Schritt konfigurieren, wenn Better-Auth-Serverfunktionen aus Server Actions aufgerufen werden.
8. Den offiziellen Next.js-Handler unter /api/auth/[...all] bereitstellen.
9. requireSession als gecachte server-only Funktion implementieren. Sie validiert die Datenbanksitzung mit den Request-Headern und gibt nur Benutzer-ID, Verifikationsstatus und minimale Profildaten zurück. Dieser Akteur wird anschließend an withTenantContext übergeben.
10. src/proxy.ts prüft auf geschützten Routen nur optimistisch das Vorhandensein des Better-Auth-Cookies und leitet offensichtlich nicht angemeldete Benutzer weiter. Jede Seite, Query und Server Action bleibt unabhängig davon geschützt.
11. Keine Sitzung, kein Token und kein Passwort darf in Logs oder Fehlerrückgaben erscheinen.

### Prüfung

    pnpm test:integration -- auth.integration.test.ts
    pnpm lint

Zusätzlich wird in Mailpit geprüft, dass Verifizierungs- und Reset-Links auf die lokalen Kebapp-Routen zeigen.

### Commit

    feat: add better auth and local email flows

## Aufgabe 5: Anmelde-, Registrierungs- und Reset-Oberflächen

### Dateien

Neu:

- src/app/(auth)/layout.tsx
- src/app/(auth)/anmelden/page.tsx
- src/app/(auth)/registrieren/page.tsx
- src/app/(auth)/email-bestaetigen/page.tsx
- src/app/(auth)/passwort-vergessen/page.tsx
- src/app/(auth)/passwort-zuruecksetzen/page.tsx
- src/app/(auth)/actions.ts
- src/components/auth/auth-card.tsx
- src/components/auth/login-form.tsx
- src/components/auth/registration-form.tsx
- src/components/auth/password-reset-form.tsx
- src/components/auth/auth-forms.test.tsx

Ändern:

- src/app/globals.css
- src/app/page.tsx

### Schritte

1. Komponententests für Feldvalidierung, Pending-Zustände, verständliche Fehler und neutrale Erfolgsmeldungen anlegen.
2. Server Actions mit Zod-Schemas für Anmeldung, Registrierung, erneute Verifizierung und Passwort-Reset erstellen.
3. Jede Action behandelt Eingaben als unvertrauenswürdig und gibt ausschließlich kleine Formzustände zurück.
4. Formulare mit useActionState umsetzen. Browservalidierung ergänzt, ersetzt aber nicht die Servervalidierung.
5. Nach Registrierung erscheint die Aufforderung zur E-Mail-Bestätigung. Nach bestätigter Anmeldung wird abhängig vom Kebapp-Status zu Antrag, Statusseite, Ladenauswahl, App, Admin oder Support weitergeleitet.
6. Fehlermeldungen verraten nicht, ob eine E-Mail bereits existiert.
7. Die Oberfläche übernimmt das bestehende Kebapp-Designsystem, bleibt tastaturbedienbar und besitzt aria-live-Meldungen.

### Prüfung

    pnpm test src/components/auth/auth-forms.test.tsx
    pnpm lint
    pnpm build

### Commit

    feat: build authentication screens

## Aufgabe 6: Öffentlicher Ladenantrag und Admin-Freigabe

### Dateien

Neu:

- src/app/antrag/page.tsx
- src/app/antrag/actions.ts
- src/app/status/page.tsx
- src/app/admin/layout.tsx
- src/app/admin/page.tsx
- src/app/admin/antraege/page.tsx
- src/app/admin/antraege/[requestId]/page.tsx
- src/app/admin/antraege/actions.ts
- src/server/organizations/registration.ts
- src/server/organizations/admin.ts
- src/server/audit/write-audit-event.ts
- src/server/organizations/registration.integration.test.ts
- scripts/seed.ts

Ändern:

- package.json
- src/app/globals.css
- src/server/db/schema/platform.ts

### Schritte

1. Integrationstests für einen verifizierten Antragsteller, einen nicht verifizierten Benutzer, doppelte offene Anträge, Adminfreigabe, Ablehnung und Sperrung schreiben.
2. Das Antragsformular auf die für den Pilot nötigen Laden- und Unternehmensgrunddaten begrenzen.
3. Das Einreichen atomar ausführen: PENDING-Organisation, PENDING-Registrierungsantrag und noch nicht aktive OWNER-Mitgliedschaft entstehen gemeinsam.
4. RLS erlaubt den eng begrenzten Self-Onboarding-Vorgang nur für den aktuellen verifizierten Benutzer und nur mit PENDING-Werten.
5. Die Statusseite zeigt PENDING, REJECTED oder SUSPENDED ohne betriebliche Daten.
6. Den Adminbereich mit sicherer serverseitiger Plattformrollenprüfung schützen.
7. Genehmigung aktiviert Organisation und OWNER-Mitgliedschaft in einer Transaktion und erzeugt ein Audit-Ereignis.
8. Ablehnung und Sperrung erzeugen ebenfalls Audit-Ereignisse mit Admin und Begründung.
9. Einen idempotenten Seed erstellen. Er legt über Better Auth gehashte Konten und über die ausschließlich offline verwendete Besitzerverbindung Plattformrolle und synthetische Demodaten an.
10. Seed-Passwörter aus lokalen Variablen lesen und niemals ausgeben.

### Prüfung

    pnpm db:seed
    pnpm test:integration -- registration.integration.test.ts

Ein noch nicht genehmigter Betreiber darf keine Route unter /app mit Betriebsdaten öffnen.

### Commit

    feat: add store applications and admin approval

## Aufgabe 7: Aktive Organisation, geschützte App-Shell und Rollen

### Dateien

Neu:

- src/app/app/organisation-waehlen/page.tsx
- src/app/app/organisation-waehlen/actions.ts
- src/server/organizations/active-organization.ts
- src/server/organizations/organization-dto.ts
- src/server/organizations/active-organization.test.ts
- src/components/account-menu.tsx

Ändern:

- src/app/app/layout.tsx
- src/components/app-shell.tsx
- src/app/app/page.tsx
- src/app/globals.css

### Schritte

1. Tests für genau eine Organisation, mehrere Organisationen, ungültige Auswahl, entfernte Mitgliedschaft und gesperrte Organisation schreiben.
2. Die aktive Organisation aus einer serverseitig validierten Auswahl bestimmen. Ein Cookie darf die Auswahl merken, aber keine Berechtigung verleihen.
3. Bei genau einer aktiven Mitgliedschaft automatisch diesen Laden wählen. Bei mehreren Mitgliedschaften die Auswahlseite zeigen.
4. Das Cookie nur in einer Server Action setzen; HttpOnly, SameSite und in HTTPS-Umgebungen Secure konfigurieren.
5. AppShell erhält Ladenname, Kürzel, Benutzername und Rolle als kleine Props. Die bislang fest eingebauten Ocakbaşı- und Cem-Daten entfernen.
6. Abmeldung in das Account-Menü integrieren.
7. EMPLOYEE sieht keine Team-, Domain- oder Sicherheitseinstellungen. OWNER sieht die vorgesehenen Verwaltungslinks.
8. Das Layout darf eine frühe Weiterleitung auslösen, bleibt aber nicht die einzige Sicherheitsprüfung. Jede Datenfunktion prüft den Kontext erneut.

### Prüfung

    pnpm test src/server/organizations/active-organization.test.ts
    pnpm build

### Commit

    feat: protect app shell with active organization

## Aufgabe 8: Einladungen und Teamverwaltung

### Dateien

Neu:

- src/app/app/einstellungen/team/page.tsx
- src/app/app/einstellungen/team/actions.ts
- src/app/einladung/[token]/page.tsx
- src/app/einladung/[token]/actions.ts
- src/server/invitations/service.ts
- src/server/invitations/tokens.ts
- src/server/invitations/invitations.integration.test.ts
- src/components/team/invitation-form.tsx
- src/components/team/member-list.tsx

Ändern:

- src/components/app-shell.tsx
- src/server/email/templates.ts
- src/server/db/schema/platform.ts
- next.config.ts

### Schritte

1. Tests für OWNER-Einladung, EMPLOYEE-Verbot, Ablauf, Widerruf, Wiederverwendung, falsche E-Mail und bereits vorhandene Mitgliedschaft schreiben.
2. Einladungstoken kryptografisch erzeugen, ausschließlich gehasht speichern und standardmäßig nach 72 Stunden ablaufen lassen. Die Frist bleibt konfigurierbar.
3. Raw-Token weder loggen noch auditieren. Audit-Ereignisse enthalten nur Einladung-ID, Organisation, Ziel-E-Mail und Status.
4. OWNER darf ausschließlich EMPLOYEE für die eigene aktive Organisation einladen und offene Einladungen widerrufen.
5. Der Empfänger muss mit derselben normalisierten und verifizierten E-Mail angemeldet sein.
6. Annahme und Tokenverbrauch atomar ausführen. Wiederholte Annahme darf keine zweite Mitgliedschaft erzeugen.
7. Teamseite zeigt aktive Mitglieder und offene Einladungen, aber keine Authkonten außerhalb des eigenen Ladens.
8. Sicherheitsheader verhindern, dass eine Einladungs-URL als Referrer an externe Ziele weitergegeben wird.

### Prüfung

    pnpm test:integration -- invitations.integration.test.ts
    pnpm lint

### Commit

    feat: add employee invitations and team management

## Aufgabe 9: Einkauf aus Local Storage nach PostgreSQL migrieren

### Dateien

Neu:

- src/server/procurement/queries.ts
- src/server/procurement/mutations.ts
- src/server/procurement/validation.ts
- src/server/procurement/procurement.integration.test.ts
- src/app/app/einkauf/actions.ts

Ändern:

- src/app/app/einkauf/page.tsx
- src/components/demand-planner.tsx
- src/components/demand-planner.test.tsx
- src/components/dashboard.tsx
- src/lib/types.ts
- src/lib/calculations.ts
- src/lib/calculations.test.ts

### Schritte

1. Integrationstests für Laden A und Laden B, Mitarbeiterrechte, Inhaberbestätigung, geschlossene Sammelrunde und aggregierte Gruppenmenge schreiben.
2. Die Einkaufsseite lädt Sammelrunde, eigene Einreichung und eigene Bedarfspositionen im Server Component über den geprüften Mandantenkontext.
3. DemandPlanner erhält initiale DTOs und ruft für Hinzufügen, Mengenänderung, Löschen und Bestätigen getrennte Server Actions auf.
4. Jede Mutation validiert IDs und Werte, lädt Organisation und Besitz erneut und läuft in withTenantContext.
5. EMPLOYEE darf einen Entwurf pflegen, aber nicht verbindlich bestätigen. OWNER darf bestätigen. Nach Bestellschluss sind Änderungen gesperrt.
6. Die regionale Gruppenmenge wird über eine eng begrenzte Datenbankfunktion oder aggregierte Serverquery bereitgestellt. Sie gibt niemals einzelne Mengen oder Ladenidentitäten anderer Organisationen zurück.
7. Optimistische UI ist nur zulässig, wenn ein Fehler den vorherigen Zustand zuverlässig wiederherstellt. Für die erste sichere Fassung ist ein klarer Pending-Zustand ausreichend.
8. Die bisherigen Local-Storage-Tests werden auf injizierte Anfangsdaten und gemockte Actions umgestellt.
9. Dashboard und Spießmeter verwenden echte eigene Mengen und die freigegebene Aggregation. Noch nicht persistente Kennzahlen werden sichtbar als Pilotvorschau gekennzeichnet.

### Prüfung

    pnpm test src/components/demand-planner.test.tsx src/lib/calculations.test.ts
    pnpm test:integration -- procurement.integration.test.ts

Der Integrationstest muss zusätzlich direkt über die Laufzeitrolle beweisen, dass einzelne Bedarfe anderer Läden verborgen bleiben.

### Commit

    feat: persist tenant demand planning in postgres

## Aufgabe 10: Website-Editor und öffentliche Ladenroute migrieren

### Dateien

Neu:

- src/server/storefront/queries.ts
- src/server/storefront/mutations.ts
- src/server/storefront/validation.ts
- src/server/storefront/storefront.integration.test.ts
- src/app/app/website/actions.ts
- src/app/laden/[slug]/page.tsx
- src/app/laden/[slug]/not-found.tsx

Entfernen:

- src/app/laden/ocakbasi-rheydt/page.tsx

Ändern:

- src/app/app/website/page.tsx
- src/components/website-editor.tsx
- src/components/website-editor.test.tsx
- src/components/storefront.tsx
- src/lib/types.ts
- src/lib/demo-data.ts
- src/components/dashboard.tsx

### Schritte

1. Tests für OWNER-Bearbeitung, EMPLOYEE-Verbot, organisationsfremde Mutation, Veröffentlichungsstatus und unsichtbare PENDING-, SUSPENDED- oder REJECTED-Läden schreiben.
2. Die Website-Seite lädt das eigene Profil serverseitig und übergibt einen validierten Editor-DTO.
3. WebsiteEditor behält die Live-Vorschau als Clientzustand, speichert aber ausschließlich über eine autorisierte Server Action.
4. Storefront zu einer reinen Darstellungskomponente ohne Local-Storage-Effekt machen.
5. Die öffentliche Route dynamisch als /laden/[slug] umsetzen. params wird gemäß Next.js 16 asynchron gelesen.
6. Die öffentliche Query gibt ausschließlich ausdrücklich freigegebene Felder zurück und verlangt ACTIVE plus published.
7. generateMetadata verwendet denselben öffentlichen DTO und erzeugt keine zweite, abweichende Freigabelogik.
8. Nicht freigegebene oder unbekannte Slugs liefern eine generische 404-Seite.
9. Die bestehende Informationsseite bleibt ohne Warenkorb, Bestellformular, Kundenkonto und Zahlung.
10. Links in Dashboard und Editor aus dem echten Organisations-Slug erzeugen.

### Prüfung

    pnpm test src/components/website-editor.test.tsx
    pnpm test:integration -- storefront.integration.test.ts
    pnpm build

### Commit

    feat: serve tenant websites from postgres

## Aufgabe 11: Zugewiesener Support und Audit-Ansicht

### Dateien

Neu:

- src/app/admin/support/page.tsx
- src/app/admin/support/actions.ts
- src/app/admin/audit/page.tsx
- src/app/support/layout.tsx
- src/app/support/page.tsx
- src/app/support/laeden/[organizationId]/page.tsx
- src/app/support/laeden/[organizationId]/actions.ts
- src/server/support/service.ts
- src/server/support/support.integration.test.ts
- src/server/audit/queries.ts

Ändern:

- src/server/auth/authorization.ts
- src/server/db/schema/platform.ts
- src/server/procurement/mutations.ts
- src/server/storefront/mutations.ts

### Schritte

1. Tests für nicht zugewiesenen Support, aktive Zuweisung, abgelaufene Zuweisung, Zugriff auf einen zweiten Laden und fehlende Änderungsbegründung schreiben.
2. ADMIN darf Support einer Organisation mit Zweck und optionalem Ablaufdatum zuweisen und entziehen.
3. SUPPORT sieht ausschließlich aktive Zuweisungen.
4. Support arbeitet ohne Benutzer-Imitation. Die Oberfläche zeigt dauerhaft, dass die Aktion als Support ausgeführt wird.
5. Jede Supportmutation verlangt eine nicht leere Begründung und schreibt Aktion, Organisation, Zielobjekt, Ergebnis und Begründung in audit_events.
6. Support darf keine Registrierungsanträge genehmigen, Rollen verändern, Administratoren ernennen oder Sitzungen verwalten.
7. Die Admin-Auditansicht gibt nur notwendige Metadaten aus und unterstützt Filter nach Organisation, Akteur und Aktion.

### Prüfung

    pnpm test:integration -- support.integration.test.ts

Der Test muss zeigen, dass eine UI-Manipulation ohne Zuweisung sowohl an der Autorisierung als auch an RLS scheitert.

### Commit

    feat: add assigned support and audit trail

## Aufgabe 12: End-to-End-Abnahme, Bereinigung und Dokumentation

### Dateien

Neu:

- playwright.config.ts
- e2e/auth-registration.spec.ts
- e2e/invitation-and-roles.spec.ts
- e2e/tenant-isolation.spec.ts
- e2e/public-storefront.spec.ts
- e2e/fixtures/database.ts
- vitest.integration.config.ts

Entfernen:

- src/lib/storage.ts

Ändern:

- package.json
- vitest.config.ts
- vitest.setup.ts
- README.md
- .gitignore
- src/lib/demo-data.ts
- gegebenenfalls bestehende Komponenten- und Bibliothekstests

### Schritte

1. Vitest-Unit- und Integrationstests sauber trennen. Async Server Components werden gemäß Next.js-Empfehlung über E2E statt über jsdom getestet.
2. Playwright gegen eine eigene Testdatenbank und laufende Mailpit-Instanz konfigurieren. Fixtures dürfen ausschließlich die explizit benannte Testdatenbank bereinigen.
3. Den vollständigen Betreiberablauf automatisieren:
   - registrieren
   - Mailpit-Link öffnen
   - Ladenantrag stellen
   - als ADMIN genehmigen
   - als OWNER anmelden
   - Mitarbeiter einladen
   - Einladung annehmen
4. Rollenablauf prüfen: EMPLOYEE erfasst Bedarf, kann aber weder bestätigen noch Benutzer verwalten.
5. Mandantentrennung mit zwei Browserkontexten und zusätzlich per direkter Laufzeitrollen-Abfrage prüfen.
6. Öffentliche Website prüfen: ACTIVE und published sichtbar; PENDING und SUSPENDED unsichtbar; keine Bestellung und keine Zahlung.
7. Desktop-, schmales Android-Viewport und mobiles WebKit-Viewport testen.
8. src/lib/storage.ts und alle verbleibenden produktiven Local-Storage-Zugriffe entfernen. Synthetische demo-data bleiben nur für Seed oder reine Präsentationstests.
9. README mit lokalen Start-, Migrations-, Seed-, Mailpit-, Test- und Resetbefehlen aktualisieren.
10. Produktionsabhängigkeiten mit pnpm licenses list und pnpm audit prüfen. Ergebnisse mit Handlungsbedarf werden dokumentiert; ein automatischer destruktiver Upgrade wird nicht durchgeführt.
11. Abschließend sicherstellen, dass git status nur die beabsichtigten Änderungen enthält.

### Vollständige Qualitätsprüfung

    pnpm lint
    pnpm test
    pnpm test:integration
    pnpm build
    pnpm test:e2e
    pnpm licenses list --prod
    pnpm audit --prod

### Commit

    test: verify auth roles and tenant isolation end to end

## Definition of Done

Die lokale Ausbaustufe ist abgeschlossen, wenn alle folgenden Aussagen nachweislich stimmen:

1. Ein neuer Betreiber kann sich mit E-Mail und Passwort registrieren und muss die E-Mail bestätigen.
2. Der Betreiber erhält vor manueller Freigabe keinen Zugriff auf Betriebsdaten.
3. Ein Plattformadministrator kann den Antrag nachvollziehbar genehmigen, ablehnen und einen aktiven Laden sperren.
4. Ein Ladeninhaber kann Mitarbeiter zeitlich begrenzt einladen.
5. Ein Mitarbeiter kann Bedarf pflegen, aber keine Benutzer verwalten oder Bedarf verbindlich bestätigen.
6. Zwei Läden bleiben sowohl in der Anwendung als auch bei direkter Abfrage über die Laufzeitdatenbankrolle getrennt.
7. Support sieht nur zugewiesene Läden und jede Supportänderung besitzt eine Audit-Begründung.
8. Einkauf und Website werden aus PostgreSQL geladen und dort gespeichert; produktive Local-Storage-Persistenz existiert nicht mehr.
9. Nur aktive, ausdrücklich veröffentlichte Ladenprofile sind öffentlich erreichbar.
10. Verifizierungs-, Einladungs- und Reset-Mails landen lokal in Mailpit.
11. Migration und Seed sind aus einer leeren lokalen Datenbank reproduzierbar.
12. Lint, Unit-, Integrations-, Build- und E2E-Prüfungen laufen erfolgreich.
13. Die Anwendung enthält weiterhin keine Endkundenbestellung und keine Zahlungsfunktion.

## Danach

Erst nach dieser lokalen Abnahme wird ein eigener Produktionsentwurf für Hetzner erstellt. Er umfasst Serverhärtung, Reverse Proxy, TLS, Backups, Monitoring, produktiven E-Mail-Versand, AV-Verträge, Geheimnisverwaltung, Admin-/Support-MFA und Wiederherstellungstests. INWX und die automatische Domainbereitstellung folgen als getrennt prüfbares Paket.
