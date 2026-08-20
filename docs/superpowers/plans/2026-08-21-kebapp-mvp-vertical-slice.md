# Kebapp MVP – Implementierungsplan für den ersten vertikalen Schnitt

**Stand:** 21. August 2026
**Grundlage:** `docs/superpowers/specs/2026-08-20-kebapp-doenerladen-betriebssystem-design.md`

## Ziel

Der erste Schnitt macht die Kernidee in einem Browser testbar: Ein Ladenbetreiber sieht seinen betrieblichen Überblick, trägt Fleischbedarf für eine Sammelrunde ein und kann eine automatisch erzeugte öffentliche Informationswebsite bearbeiten und öffnen. Endkundenbestellungen, Kundenkonten und Onlinezahlung bleiben vollständig außen vor.

Dieser Schnitt ist ein Pilotprototyp mit realistischen Demodaten und lokaler Browser-Persistenz. Er validiert Informationsarchitektur, Bedienbarkeit und den roten Faden zwischen Gruppeneinkauf und kostenloser Website. Authentifizierung, PostgreSQL-Persistenz, Lieferantenportal und produktive Domainregistrierung folgen nach dieser UI-Validierung hinter klaren Schnittstellen.

## Technischer Ansatz

- Next.js mit App Router, React und TypeScript
- Server Components als Standard; Client Components nur für interaktive Formulare und lokale Speicherung
- lokale, versionierte Browserdaten für den Testbetrieb
- reine Domänenfunktionen für Mengen, Bündelungsfortschritt und Ersparnisberechnung
- CSS-Tokens und eigenständige responsive Komponenten ohne schweres UI-Framework
- lokale Schriftdateien über Fontsource statt externer Font-Aufrufe
- Vitest für Domänenlogik und React-Komponenten

## Visuelles System

Die Betreiberoberfläche orientiert sich an den Arbeitsmitteln eines Imbissbetriebs: kompakte Auftragszettel, klare Mengen und starke Statusfarben. Sie verwendet Tinten-Schwarzgrün (`#132019`), helles Arbeitsflächen-Grau (`#F3F5EF`), Paprikarot (`#D9432F`), Senfgelb (`#F3B83F`) und Kräutergrün (`#1F6B4F`). Eine schmale, kondensierte Displayschrift kennzeichnet Mengen und Überschriften; eine ruhige Grotesk-Schrift trägt Fließtext und Formulare.

Das charakteristische Element ist der „Spießmeter“: Eine geschichtete Mengenanzeige zeigt sofort, wie nah die regionale Sammelrunde am nächsten Preisziel liegt. Sie ist fachlich begründet und wird nicht als bloße Dekoration eingesetzt.

## Routen und Funktionen

### `/app`

- Tagesüberblick mit offenen Aufgaben, Einkaufsstatus, Ersparnis und Website-Status
- kompakte Navigation zu Einkauf und Website
- deutlich sichtbare nächste Handlung

### `/app/einkauf`

- aktuelle Sammelrunde mit Bestellschluss und regionaler Gesamtmenge
- eigener Bedarf nach Produkt, Menge, Einheit und Liefertermin
- Bedarf hinzufügen, Menge ändern und Position entfernen
- sofort aktualisierte Bündelungs- und Ersparnisanzeige
- verständliche Leer-, Erfolgs- und Validierungszustände

### `/app/website`

- Logo-Kürzel, Ladenname, Farben, Öffnungszeiten, Telefon, Adresse und Speisekarte bearbeiten
- responsive Live-Vorschau der Informationswebsite
- lokales Speichern mit eindeutigem Bestätigungsstatus
- Link zur öffentlichen Laden-Website

### `/laden/ocakbasi-rheydt`

- öffentliche, mobiloptimierte Informationswebsite
- Speisekarte, Preise, Öffnungszeiten, Adresse, Anruf- und Routenlink
- Impressum- und Datenschutzhinweise als sichtbare Einstiege
- kein Warenkorb, kein Bestellformular und kein Checkout

## Datenmodell des Prototyps

- `StoreProfile`: Name, Kürzel, Kontaktdaten, Adresse, Öffnungszeiten, Farben
- `MenuItem`: Name, Beschreibung, Preis, Kategorie, Allergenhinweis
- `DemandItem`: Produkt, Spezifikation, Menge, Einheit, Liefertermin
- `BuyingRound`: Bestellschluss, Zielmenge, Gesamtmenge, Preisstufen
- `DashboardMetric`: Wert, Status, Handlung

Alle lokalen Daten erhalten eine Schemaversion. Ungültige oder veraltete Browserdaten fallen kontrolliert auf Demodaten zurück.

## Fehlerbehandlung

- Mengen müssen positiv und innerhalb plausibler Pilotgrenzen liegen.
- Ein leerer Bedarf zeigt eine konkrete Einladung zum Hinzufügen statt einer leeren Tabelle.
- Lokale Speicherfehler verändern den sichtbaren Stand nicht und werden verständlich gemeldet.
- Fehlende Profildaten werden in der Vorschau markiert; eine Veröffentlichung wird im Prototyp nur simuliert.
- Browserdaten werden defensiv gelesen und niemals ungeprüft als gültige Domänenobjekte verwendet.

## Tests und Abnahme

1. Domänentests prüfen Mengenaggregation, Preisstufen, Ersparnis und Validierung.
2. Komponententests prüfen Bedarf hinzufügen/ändern/löschen sowie Website-Speicherung.
3. Lint und Produktions-Build müssen ohne Fehler durchlaufen.
4. Die vier Routen werden bei Desktop- und Mobilbreite visuell geprüft.
5. Tastaturnavigation, sichtbare Fokuszustände und reduzierte Bewegung werden kontrolliert.
6. Auf der öffentlichen Website darf kein Bestell- oder Zahlungsaufruf erscheinen.

## Bewusst später

- Login, Rollen und echte Mandantentrennung
- PostgreSQL und produktive API
- Lieferantenangebote, Vergabe und Reklamationen
- INWX-Registrierung und Let’s-Encrypt-Automation
- POS-, DATEV-, Bank- und E-Rechnungsimporte
- weitere Betriebsmodule in voller Tiefe
- Onlinebestellung und Onlinezahlung

## Umsetzungsschritte

1. Projektgrundlage, Qualitätswerkzeuge und Design-Tokens anlegen.
2. Domänentypen, Demodaten, Berechnungen und versionierte lokale Speicherung implementieren.
3. App-Shell und Dashboard bauen.
4. interaktive Bedarfserfassung mit Spießmeter bauen.
5. Website-Editor und öffentliche Laden-Website bauen.
6. automatisierte Tests ergänzen und alle Qualitätsprüfungen ausführen.
7. App lokal starten, visuell prüfen und gefundene Probleme korrigieren.

