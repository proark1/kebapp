# Finaler UI/UX-Report: öffentliche Restaurantseite

**Datum:** 23. August 2026  
**Geprüfte Live-Seite:** https://178-105-107-243.sslip.io/laden/ocakbasi-rheydt  
**Umfang:** Öffentliche Restaurantseite, responsive Navigation, Kontakt- und Conversion-Elemente sowie der WhatsApp-Bestellablauf. Das interne Kebapp-Dashboard war nicht Teil dieses Abschlusschecks.

## Kurzurteil

Die öffentliche Restaurantseite ist für den Pilotbetrieb freigabefähig. Sie wirkt deutlich professioneller als ein typisches Baukasten-Template, transportiert das Produkt unmittelbar und führt Nutzer klar zu WhatsApp oder Telefon. Auf 390, 768 und 1280 Pixel Breite wurden keine Layout- oder Überlaufprobleme gefunden. Der Bestellablauf ist verständlich, funktioniert mit Abholung und Lieferung und behandelt fehlende Pflichtangaben nachvollziehbar.

**Orientierungswert:** 8,7 von 10.  
**Go-live-Blocker:** keine.

| Bereich | Bewertung | Kurzbegründung |
| --- | ---: | --- |
| Visuelle Wirkung | 9,2/10 | Starkes Food-Hero, klare Premium-Typografie und ruhige Farbwelt |
| Conversion | 9,0/10 | WhatsApp und Telefon sind sofort verständlich und mobil dauerhaft erreichbar |
| Responsive Design | 9,0/10 | Kein horizontaler Überlauf; saubere Umschaltung auf Tablet und Mobil |
| Bestellablauf | 8,8/10 | Gericht wird korrekt übernommen; gute Fehlerführung und Zusammenfassung |
| Barrierefreiheit | 8,1/10 | Gute Struktur und Fokusführung; drei kleinere semantische bzw. Touch-Ziel-Themen |
| Inhalt und Vertrauen | 8,0/10 | Professioneller Rahmen; reale Betriebsdetails und Social Proof fehlen in der Demo noch |

## Was bereits sehr gut funktioniert

- Das Hero-Bild zeigt das Kernprodukt unmittelbar und bietet ausreichend dunkle Fläche für gut lesbare Texte.
- Die visuelle Hierarchie ist eindeutig: Restaurantname, Nutzenversprechen, WhatsApp und Telefon werden ohne Suche verstanden.
- Auf Mobilgeräten bleibt eine 66 Pixel hohe Bestellleiste sichtbar. Die Seite reserviert dafür 67 Pixel plus Safe-Area und verhindert dadurch eine Überdeckung des Inhalts.
- Die Seite hat genau eine H1 sowie eine logische H2-/H3-Struktur. `header`, `nav`, `main` und `footer` sind vorhanden.
- Alle geprüften Bilder werden geladen. Das Hero-Bild ist als dekoratives Bild korrekt mit leerem Alternativtext eingebunden.
- Alle Sprunglinks führen zu vorhandenen Bereichen. Telefonnummern verwenden echte `tel:`-Links.
- Es wurden keine unbeschrifteten sichtbaren Links, Buttons oder Formularelemente gefunden.
- Die mobile Seite läuft bei 390 Pixel ohne horizontalen Überlauf; dasselbe gilt für Tablet und Desktop.
- Ein Klick auf ein konkretes Gericht übernimmt dieses korrekt in den Bestelldialog. Geprüft wurde unter anderem „Ocakbasi Teller · 13,90 €“.
- Der Bestelldialog sperrt den Seitenhintergrund, setzt den Fokus in das Formular und bleibt auf kleinen Displays intern scrollbar.
- Bei einer Lieferung ohne Adresse bleibt der Dialog geöffnet, fokussiert die Lieferadresse und verbindet die Fehlermeldung per `aria-describedby` und `aria-invalid` mit dem Feld.
- Die Bestellung wird nicht unbemerkt versendet. Der Nutzer öffnet die vorbereitete Nachricht selbst in WhatsApp und bestätigt sie dort.

## Priorisierte Verbesserungen

### P2 – vor breiterem Rollout empfohlen

#### 1. Kleine Utility- und CTA-Typografie vergrößern

Gemessen wurden unter anderem 10 Pixel für die Desktop-Navigation, 9 Pixel für den Header-CTA und die Menü-CTAs sowie 8 Pixel für den mobilen Header-CTA. Der mobile Button „Jetzt bestellen“ ist nur 38 Pixel hoch. Das passt optisch zur eleganten Richtung, ist aber für ältere Nutzer und schnelle Bedienung unnötig knapp.

**Empfehlung:** Buttons auf mindestens 44 Pixel Höhe bringen; Buttontexte auf 11–12 Pixel und Navigationslinks auf mindestens 11 Pixel erhöhen. Die große Hero-Typografie soll unverändert bleiben.

#### 2. Gericht in den zugänglichen Buttonnamen aufnehmen

Alle drei Menü-Buttons heißen derzeit zugänglich identisch „Per WhatsApp bestellen“. Visuell ist der jeweilige Kontext klar, für Screenreader und Sprachsteuerung sind identische Namen jedoch mehrdeutig.

**Empfehlung:** zugängliche Namen wie „Döner im Fladenbrot per WhatsApp bestellen“ verwenden. Der sichtbare kurze Text kann bestehen bleiben.

#### 3. Lieferadresse auch als erforderlich kennzeichnen

Die eigene Validierung funktioniert korrekt und setzt nach einem Fehler `aria-invalid`. Vor dem Absenden fehlt dem Feld jedoch `required` beziehungsweise `aria-required="true"`. Dadurch erfährt assistive Software nicht frühzeitig, dass die Adresse für Lieferung zwingend ist.

**Empfehlung:** den Pflichtstatus abhängig von der ausgewählten Bestellart semantisch setzen und im sichtbaren Label mit „erforderlich“ kennzeichnen.

### P3 – Conversion-Optimierungen nach dem Pilotstart

#### 4. Doppelte Einleitungstexte vermeiden

Der Satz „Drehspieß, frisches Gemüse und Saucen aus eigener Küche – mitten in Rheydt.“ erscheint im Hero und im Abschnitt „Unser Laden“ wortgleich. Das wirkt bei genauerem Lesen noch wie Demo-Content.

**Empfehlung:** Im Hero kurz den Kaufgrund nennen; im Über-uns-Bereich Herkunft, Zubereitung oder Familiengeschichte erzählen.

#### 5. Operative Bestellinformationen früher zeigen

Liefergebiet, Mindestbestellwert, geschätzte Abhol-/Lieferzeit und akzeptierte Zahlungsarten fehlen. In einer Demo ist das vertretbar, im realen Betrieb erzeugt es Rückfragen in WhatsApp.

**Empfehlung:** Diese Angaben als optionale Felder im Website-Editor vorsehen und im Bestelldialog direkt unter der Bestellart anzeigen.

#### 6. Vertrauen mit echten Inhalten ergänzen

Die Seite hat eine gute gestalterische Basis, zeigt aber noch keine realen Bewertungen, Speisenfotos oder ein persönliches Element zum Betrieb.

**Empfehlung:** Für echte Kunden mindestens ein authentisches Laden-/Teamfoto, drei bis sechs echte Gerichtsfotos und optional eine verifizierbare Bewertungszusammenfassung verwenden. Keine erfundenen Bewertungen ausspielen.

#### 7. Kompakte Desktop-Navigation beim Scrollen testen

Die Hauptnavigation liegt vollständig im Hero und scrollt anschließend aus dem Sichtbereich. Die Menügerichte besitzen eigene Bestellbuttons, daher ist dies kein Blocker.

**Empfehlung:** In einem späteren A/B-Test einen kompakten Sticky-Header oder einen unaufdringlichen Desktop-Bestellbutton gegen den aktuellen Zustand testen.

## Technische Prüfergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| 390 px Mobil | Kein horizontaler Überlauf; Sticky-CTAs sichtbar |
| 768 px Tablet | Einspaltige Menüstruktur; Navigation sinnvoll reduziert |
| 1280 px Desktop | Volle Navigation und starke Hero-Hierarchie |
| Überschriften | Eine H1; logische H2-/H3-Abfolge |
| Landmarken | Header, Navigation, Main und Footer vorhanden |
| Sprunglinks | Keine fehlenden Ziele |
| Bedienelemente | Keine sichtbaren unbeschrifteten Elemente |
| Hero-Bild | Erfolgreich geladen |
| Bestellvorbelegung | Korrektes Gericht wird übernommen |
| Abholung/Lieferung | Beide Varianten vorhanden |
| Fehlerführung | Fokus und verständliche Live-Fehlermeldung vorhanden |
| Hintergrund bei Dialog | Scrollen korrekt gesperrt |

## Empfohlene Reihenfolge

1. Touch-Ziel und Schriftgröße des kleinen Header-Buttons korrigieren.
2. Gerichtsnamen in die zugänglichen Namen der Menü-Buttons aufnehmen.
3. Lieferadresse semantisch als Pflichtfeld kennzeichnen.
4. Beim ersten echten Restaurant die Demo-Texte durch individuelle Inhalte und reale Betriebsinformationen ersetzen.
5. Bewertungen, Speisenfotos und Sticky-Desktop-CTA erst anhand echter Nutzungsdaten priorisieren.

## Freigabeempfehlung

Die Seite kann in der aktuellen Form für Präsentationen und den ersten Pilotladen verwendet werden. Die drei P2-Punkte sind klein und lokal begrenzt; sie sollten vor einem größeren Rollout an viele Restaurants umgesetzt werden. Ein weiteres grundlegendes Redesign ist nicht erforderlich.
