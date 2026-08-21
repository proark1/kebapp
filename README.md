# Kebapp

Kebapp ist ein Pilotprototyp für betreuten Gruppeneinkauf und ein digitales Betriebssystem für unabhängige Dönerläden. Der erste vertikale Schnitt verbindet drei testbare Bereiche:

- Betriebsübersicht unter `/app`
- Fleischbedarf und Sammelrunde unter `/app/einkauf`
- Website-Editor unter `/app/website`
- öffentliche Demo-Website unter `/laden/ocakbasi-rheydt`

Die öffentliche Website ist bewusst eine reine Informationsseite. Es gibt keinen Warenkorb, keine Endkundenbestellung und keine Bezahlung.

## Lokal starten

Voraussetzungen: Node.js 20.9 oder neuer, pnpm sowie Docker Compose oder Podman Compose.

```bash
pnpm install
cp .env.example .env.local
cp .env.db.example .env.db.local
pnpm infra:up
pnpm dev
```

Unter Windows PowerShell kann statt `cp` jeweils `Copy-Item` verwendet werden. Die Werte mit `change-me` sind ausschließlich lokale Platzhalter. Passwörter und die zugehörigen Datenbank-URLs müssen konsistent geändert werden.

Danach sind erreichbar:

- App: [http://localhost:3000/app](http://localhost:3000/app)
- Mailpit: [http://localhost:8025](http://localhost:8025)
- PostgreSQL: `127.0.0.1:${POSTGRES_PORT}` (standardmäßig Port `5432`)

Auf diesem Entwicklungsrechner wird Docker Compose verwendet. Die Compose-Datei bleibt Podman-kompatibel und kann alternativ so gestartet werden:

```bash
podman compose --env-file .env.db.local up -d
```

Die Next.js-Anwendung lädt nur `.env.local` mit der eingeschränkten Laufzeitverbindung. `.env.db.local` enthält die getrennte Besitzerverbindung und wird ausschließlich von Compose, Drizzle, Seeds und Integrationstests geladen. Beide Dateien sind ignoriert und dürfen nicht committed werden. Der Laufzeit-Rollenname `kebapp_app` ist Bestandteil der versionierten RLS-Richtlinien und bleibt fest; das Passwort wird pro Umgebung geändert.

## Qualitätsprüfungen

```bash
pnpm lint
pnpm test
pnpm test:integration
pnpm build
```

Die Infrastruktur lässt sich prüfen und stoppen mit:

```bash
pnpm infra:config
pnpm infra:down
```

PostgreSQL und die getrennten Datenbankrollen stehen lokal bereit. Bedarf und Website-Einstellungen werden im aktuellen UI-Prototyp trotzdem noch im lokalen Browserspeicher gehalten. Die folgenden Implementierungsschritte verbinden Authentifizierung, Mandanten und diese Fachdaten mit PostgreSQL; INWX- und Hetzner-Automation bleiben ein späterer Ausbauschritt.

## Dokumentation

- Produkt- und Pilotentwurf: `docs/superpowers/specs/2026-08-20-kebapp-doenerladen-betriebssystem-design.md`
- Technischer Entwurf für Authentifizierung und Mandanten: `docs/superpowers/specs/2026-08-21-kebapp-auth-mandanten-postgresql-design.md`
- Implementierungsplan des UI-Prototyps: `docs/superpowers/plans/2026-08-21-kebapp-mvp-vertical-slice.md`
- Implementierungsplan für Authentifizierung, Mandanten und PostgreSQL: `docs/superpowers/plans/2026-08-21-kebapp-auth-mandanten-postgresql.md`
