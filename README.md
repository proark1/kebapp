# Kebapp

Kebapp ist ein Pilotprototyp für betreuten Gruppeneinkauf und ein digitales Betriebssystem für unabhängige Dönerläden. Der erste vertikale Schnitt verbindet drei testbare Bereiche:

- Betriebsübersicht unter `/app`
- Fleischbedarf und Sammelrunde unter `/app/einkauf`
- Website-Editor unter `/app/website`
- öffentliche Demo-Website unter `/laden/ocakbasi-rheydt`

Die öffentliche Website ist bewusst eine reine Informationsseite. Es gibt keinen Warenkorb, keine Endkundenbestellung und keine Bezahlung.

## Lokal starten

Voraussetzungen: Node.js 20.9 oder neuer und pnpm.

```bash
pnpm install
pnpm dev
```

Danach ist die App unter [http://localhost:3000/app](http://localhost:3000/app) erreichbar.

## Qualitätsprüfungen

```bash
pnpm lint
pnpm test
pnpm build
```

Bedarf und Website-Einstellungen werden für den Pilotprototyp versioniert im lokalen Browserspeicher gehalten. Das ist absichtlich noch keine Produktionspersistenz. Authentifizierung, PostgreSQL, echte Mandantentrennung sowie INWX- und Hetzner-Automation folgen im nächsten technischen Schnitt.

## Dokumentation

- Produkt- und Pilotentwurf: `docs/superpowers/specs/2026-08-20-kebapp-doenerladen-betriebssystem-design.md`
- Technischer Entwurf für Authentifizierung und Mandanten: `docs/superpowers/specs/2026-08-21-kebapp-auth-mandanten-postgresql-design.md`
- Implementierungsplan des UI-Prototyps: `docs/superpowers/plans/2026-08-21-kebapp-mvp-vertical-slice.md`
- Implementierungsplan für Authentifizierung, Mandanten und PostgreSQL: `docs/superpowers/plans/2026-08-21-kebapp-auth-mandanten-postgresql.md`
