# Kebapp – Umsetzungsplan für professionelle Ladenwebsite und Direktbestellung

**Designgrundlage:** `docs/superpowers/specs/2026-08-23-public-storefront-direct-ordering-design.md`

## Zielzustand

Die veröffentlichte Ladenwebsite verwendet ein eigenes Food-Hero-Motiv und
einen hochwertigen Restaurant-Look. Besucher:innen können pro Gericht einen
lokalen Bestellzettel ausfüllen und die fertige Nachricht in WhatsApp öffnen.
Ladeninhaber:innen pflegen Headerbild, WhatsApp-Nummer, Abholung und Lieferung
im bestehenden Website-Editor. Kebapp speichert oder sendet keine
Endkundenbestellung.

## Arbeitspaket 1 – Originales Hero-Asset

**Dateien:**

- neu: `public/images/storefront/kebapp-doener-hero.webp`

**Schritte:**

1. Mit dem eingebauten ImageGen-Werkzeug ein eigenes, fotorealistisches,
   horizontales Döner-Drehspießmotiv ohne Logos, Text oder erkennbare Personen
   erzeugen.
2. Komposition auf helle Typografie im mittleren beziehungsweise linken
   Bildbereich und responsiven Beschnitt ausrichten.
3. Ergebnis visuell prüfen, in das Repository übernehmen und als WebP für den
   Hero optimieren.
4. Sicherstellen, dass kein Bild der Referenzwebsite oder des Entwurf-
   Platzhalters übernommen wird.

## Arbeitspaket 2 – Profilversion 3 und Migration

**Dateien:**

- `src/lib/types.ts`
- `src/server/db/schema/storefront.ts`
- `src/server/storefront/validation.ts`
- `src/server/storefront/queries.ts`
- `src/server/storefront/mutations.ts`
- `drizzle/0008_*.sql`
- `drizzle/meta/*`
- `next.config.ts`
- `scripts/seed.ts`
- `scripts/seed-public-demo.ts`
- `src/test/fixtures/store-profile.ts`
- `e2e/fixtures/database.ts`

**Schritte:**

1. Zuerst Validierungs- und Integrationstests für Profilversion 3,
   Headerbildgrenze, WhatsApp-Nummer und Bestelloptionen ergänzen.
2. `StoreProfile` um `heroImageUrl`, `whatsappPhone`, `pickupEnabled` und
   `deliveryEnabled` erweitern; `schemaVersion` auf 3 erhöhen.
3. Drizzle-Schema erweitern und eine vorwärtsgerichtete Migration generieren.
4. Öffentliche PostgreSQL-Funktion und alle Query-/Mutation-Mappings um die
   neuen Felder ergänzen.
5. Defaults bewusst setzen: neue Entwürfe mit Abholung, ohne Lieferung und ohne
   WhatsApp; das Demo-Profil ausdrücklich mit beiden Bestellarten.
6. Server Actions gemäß lokaler Next.js-16-Dokumentation auf 3 MiB begrenzen,
   damit Logo und Hero-Data-URL gemeinsam gespeichert werden können.
7. Migration und Mandanten-/Publikationsregeln über Integrationstests prüfen.

## Arbeitspaket 3 – Reine Bestelllogik

**Dateien:**

- neu: `src/lib/storefront-order.ts`
- neu: `src/lib/storefront-order.test.ts`

**Schritte:**

1. Tests für deutsche und internationale Telefonnummern-Normalisierung
   schreiben.
2. Tests für strukturierte WhatsApp-Nachrichten bei Abholung und Lieferung
   schreiben.
3. Tests für Menge 1–20, Pflichtadresse, unbekannte Gerichte und deaktivierte
   Bestellarten schreiben.
4. Kleine, reine Funktionen für Validierung, Preisberechnung, Nachricht und
   `wa.me`-URL implementieren.
5. Keine Browser- oder Server-Abhängigkeiten in dieses Modul aufnehmen.

## Arbeitspaket 4 – Zugänglicher Bestellzettel

**Dateien:**

- neu: `src/components/storefront-order-sheet.tsx`
- neu: `src/components/storefront-order-sheet.test.tsx`

**Schritte:**

1. Komponententests für Öffnen pro Gericht, globale Gerichtsauswahl,
   Mengenänderung, Abholung, Lieferung und Fehlermeldungen schreiben.
2. Dialog als kleine Client Component implementieren; nur notwendige
   Profildaten serialisieren.
3. Fokus beim Öffnen setzen, innerhalb des Dialogs halten, mit Escape schließen
   und an den Auslöser zurückgeben.
4. WhatsApp-Link erst nach erfolgreicher lokaler Validierung erzeugen.
5. Im Vorschaumodus externe Navigation vollständig unterdrücken.

## Arbeitspaket 5 – Öffentliche Website neu gestalten

**Dateien:**

- `src/components/storefront.tsx`
- `src/components/storefront.test.tsx`
- `src/components/storefront-legal-page.tsx`
- `src/app/globals.css`
- gegebenenfalls `src/app/layout.tsx` und Font-Abhängigkeiten

**Schritte:**

1. Bestehende Storefront-Tests auf neue, glaubwürdige Texte und Aktionen
   umstellen; Fallback ohne WhatsApp abdecken.
2. Illustrativen Drehspieß und Laufband entfernen.
3. Hero mit echtem Bild, kontraststarkem Overlay, hochwertiger Typografie,
   transparenter Navigation und zwei klaren Aktionen aufbauen.
4. Speisekarte in ruhiger Restauranttypografie darstellen und jeden Eintrag
   mit dem Bestellzettel verbinden.
5. Kontakt und Öffnungszeiten neu ordnen, ohne bestehende Daten zu erfinden.
6. Mobile feste Bestellleiste mit Safe-Area-Unterstützung ergänzen.
7. Rechtsseiten und Editor-Vorschau an die neue visuelle Sprache anpassen.
8. Überflüssige Dekoration entfernen und Fokus-, Hover- sowie Reduced-Motion-
   Zustände vollständig gestalten.

## Arbeitspaket 6 – Website-Editor erweitern

**Dateien:**

- `src/components/website-editor.tsx`
- `src/components/website-editor.test.tsx`
- `src/app/app/website/actions.ts`
- `src/app/support/laeden/[organizationId]/actions.ts`
- `src/app/globals.css`

**Schritte:**

1. Tests für Headerbildformat, 1-MiB-Grenze, Entfernen und unveränderten Zustand
   bei Fehlern schreiben.
2. Headerbild-Vorschau und Upload ergänzen.
3. WhatsApp-Nummer, „Telefonnummer übernehmen“, Abholung und Lieferung in den
   Kontaktabschnitt integrieren.
4. Zusammenhängende Editorfehler direkt am Feld anzeigen.
5. Sicherstellen, dass das versteckte JSON-Profil und beide Serveraktionen
   Profilversion 3 unverändert autorisieren und validieren.

## Arbeitspaket 7 – Integration und E2E

**Dateien:**

- `src/server/storefront/storefront.integration.test.ts`
- `src/server/db/schema/schema.integration.test.ts`
- `src/server/db/tenant-isolation.integration.test.ts`
- `scripts/seed-public-demo.integration.test.ts`
- `e2e/public-storefront.spec.ts`

**Schritte:**

1. Speicherung, erneutes Laden und öffentliche Projektion aller neuen Felder
   testen.
2. Veröffentlichung mit inkonsistenter WhatsApp-Konfiguration ablehnen.
3. Mandantentrennung und unveröffentlichte Seiten erneut prüfen.
4. WhatsApp-Ziel im Browser abfangen und Inhalt kontrollieren, ohne WhatsApp
   aufzurufen oder eine Nachricht zu senden.
5. Desktop-Chromium, Mobile-Chromium und Mobile-WebKit ausführen.

## Arbeitspaket 8 – Visuelle und technische Abnahme

**Prüfungen:**

1. öffentliche Seite und Editor bei 390, 768 und 1280 CSS-Pixeln aufnehmen
2. Zuschnitt des Standardbilds und eines hochgeladenen Testbilds prüfen
3. Kontrast, Fokus, Tastaturablauf, Safe Area und horizontalen Überlauf prüfen
4. Texte und Aktionen auf erfundene Aussagen oder tote Ziele kontrollieren
5. `pnpm lint`, `pnpm test`, `pnpm test:integration`, TypeScript,
   Produktionsbuild und `pnpm test:e2e` ausführen
6. Arbeitsbaum prüfen und die Implementierung in nachvollziehbaren Commits
   festhalten

## Arbeitspaket 9 – Backup und Live-Deployment

**Schritte:**

1. Produktionszustand und verfügbaren Speicher prüfen.
2. Frischen PostgreSQL-Dump erzeugen und lesbar verifizieren.
3. Neues Image bauen, Migration und idempotenten Demo-Seed ausführen.
4. Versioniert umschalten und Containerzustand sowie Logs kontrollieren.
5. HTTPS, öffentliche Ladenroute, Hero, WhatsApp-Bestellzettel, Telefon,
   Editor und Demo-Rollen live prüfen.
6. Bei Fehlern vorheriges Image aktivieren; den erzeugten Dump unangetastet
   aufbewahren.

## Fertigdefinition

Alle Abnahmekriterien der Designspezifikation sind erfüllt, sämtliche
automatisierten Prüfungen sind grün, die Produktionswebsite läuft gesund und
die Live-Bestellung erzeugt ausschließlich eine lokal vorbereitete
WhatsApp-Nachricht ohne serverseitige Speicherung oder Versand.
