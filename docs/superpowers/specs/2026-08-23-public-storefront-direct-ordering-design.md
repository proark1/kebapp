# Kebapp – Professionelle Ladenwebsite mit Direktbestellung

**Stand:** 23. August 2026

**Status:** In mehreren Abschnitten durch den Auftraggeber freigegebener Entwurf

**Vorbild:** hochwertige, bildgeführte Restaurantauftritte wie Sürer Döner; keine Übernahme von Marke, Texten oder Bildmaterial

## 1. Ziel

Die öffentliche Website jedes Dönerladens wird zu einem professionellen,
mobilen Direktbestell-Einstieg. Ein echtes Döner-Food-Motiv ersetzt die
spielerische Illustration. Besucher:innen sollen in wenigen Sekunden erkennen,
welcher Laden angeboten wird, was es zu essen gibt und wie sie per WhatsApp oder
Telefon bestellen können.

Die Bestellung bleibt bewusst schlank: Kebapp nimmt weder Bestellungen noch
Zahlungen entgegen. Die Seite hilft beim Zusammenstellen einer strukturierten
Bestellnachricht und öffnet anschließend WhatsApp. Der Kunde prüft und sendet
die Nachricht selbst direkt an den Laden.

Der Durchlauf ist erfolgreich, wenn eine mobile Testperson ohne Erklärung ein
Gericht auswählen, Abholung oder Lieferung angeben und die fertige Bestellung
in WhatsApp öffnen kann. Telefon, Route, Speisekarte, Öffnungszeiten und
rechtliche Musterseiten bleiben erreichbar.

## 2. Verbindlicher Umfang

Enthalten sind:

1. neue bildgeführte Gestaltung der öffentlichen Ladenwebsite
2. eigenes Headerbild pro Laden und professionelles Standardmotiv als Ersatz
3. WhatsApp als primäre und Telefon als sekundäre mobile Bestellaktion
4. eigener WhatsApp-Bestellknopf an jedem Gericht
5. schlanker Bestellzettel für Gericht, Menge, Abholung/Lieferung, Name,
   Lieferadresse und Anmerkung
6. konfigurierbare WhatsApp-Nummer sowie Abhol- und Lieferoptionen
7. mobile, dauerhaft erreichbare Bestellleiste
8. Anpassung der Editor-Livevorschau
9. Datenmigration, Validierung und automatisierte Tests
10. Backup, Produktionsmigration, Deployment und Live-Smoke-Test

Nicht enthalten sind Zahlung, Warenkorb über mehrere Gerichte, Konto für
Endkund:innen, serverseitige Bestellspeicherung, Bestellstatus, Liefergebiete,
Mindestbestellwert, Liefergebühr, automatische Verfügbarkeitsprüfung,
Küchendisplay, WhatsApp Business API oder automatisches Versenden von
Nachrichten.

## 3. Gestaltungsrichtung

Die Website wirkt wie der digitale Auftritt eines etablierten Restaurants,
nicht wie eine spielerische Landingpage oder ein generisches SaaS-Template.

Verbindliche Prinzipien:

- ein vollflächiges, professionelles Foto von Dönerfleisch am Drehspieß führt
  den Header
- eine dunkle Bildüberlagerung stellt die Lesbarkeit von Navigation und Text
  sicher
- hochwertige, kontrastreiche Serifentypografie prägt große Überschriften;
  sachliche Sans-Serif-Typografie bleibt für Navigation, Preise und Formulare
- die Grundfarben sind Anthrazit, Warmweiß und ein zurückhaltender warmer
  Metallton; WhatsApp-Grün erscheint nur für Bestellaktionen
- dünne Linien, geringe Radien und großzügige Abstände ersetzen Illustrationen,
  Stempel, Laufbänder und dekorative Karten
- das Essen steht visuell im Mittelpunkt; Texte bleiben kurz und glaubwürdig
- es werden keine fremden Bilder, Texte, Markenmerkmale oder Layoutdetails der
  Referenz kopiert

Für das Standardmotiv wird ein eigenes Bild erzeugt und als optimiertes lokales
WebP-Asset ausgeliefert. Hochgeladene Betreiberbilder werden nur auf der
zugehörigen Ladenwebsite verwendet.

## 4. Informationsarchitektur

### 4.1 Kopf und Hero

Der Hero ist auf Desktop mindestens eine große Bildschirmsektion und auf Mobil
so hoch, dass Bild, Nutzenversprechen und beide Aktionen ohne visuelle Enge
erscheinen.

Er enthält:

- Ladenname beziehungsweise Logo
- Desktop-Navigation zu Speisekarte, Über uns beziehungsweise Beschreibung,
  Öffnungszeiten und Kontakt
- Eyebrow aus dem Profil
- Hauptüberschrift und Kurzbeschreibung aus dem Profil
- primäre Aktion „Über WhatsApp bestellen“, sofern eine WhatsApp-Nummer
  gepflegt ist
- sekundäre Aktion „Jetzt anrufen“
- sachliche Kurzinformationen zu Direktbestellung, Abholung/Lieferung und Ort

Das Headerfoto wird als echtes Bild mit sinnvoller Alternativtext-Strategie und
responsiven Größen ausgeliefert, nicht als unzugängliche CSS-Information. Eine
dunkle, nicht interaktive Overlay-Ebene verbessert den Kontrast.

### 4.2 Speisekarte

Die Speisekarte folgt unmittelbar nach einer kurzen Laden- beziehungsweise
Leistungsdarstellung. Jedes Gericht zeigt Kategorie, Name, Beschreibung, Preis
und – bei aktivem WhatsApp-Kanal – „Per WhatsApp bestellen“.

Die vorhandene Reihenfolge aus dem Editor bleibt maßgeblich. Es werden keine
„beliebten“ Gerichte behauptet, solange dafür kein eigenes Profilmerkmal
existiert. Die Überschrift lautet daher neutral „Unsere Speisekarte“ oder
„Unsere Auswahl“.

### 4.3 Kontakt und Öffnungszeiten

Adresse, Kartenroute, Telefonnummer und Öffnungszeiten bleiben eigenständige,
leicht auffindbare Bereiche. Auf Mobilgeräten liegt eine feste Aktionsleiste
über dem sicheren unteren Rand. Sie zeigt WhatsApp primär und Telefon sekundär;
bei fehlendem WhatsApp-Kanal nimmt Telefon den verfügbaren Platz ein.

Footer sowie Impressum- und Datenschutz-Musterseiten bleiben erhalten und
werden visuell an den neuen Auftritt angepasst. Die Demo-Kennzeichnung bleibt
sichtbar, wird aber ruhig in die Seite integriert.

## 5. Direktbestellablauf

### 5.1 Einstieg

Ein Gerichtsknopf öffnet einen modalen Bestellzettel. Die globale
WhatsApp-Aktion im Hero beziehungsweise in der mobilen Leiste öffnet denselben
Bestellzettel zunächst mit einer Gerichtsauswahl. Wird der Dialog von einem
Gericht gestartet, ist dieses Gericht vorausgewählt.

### 5.2 Felder

Der Bestellzettel enthält:

- Gericht: erforderlich; aus der aktuellen Speisekarte
- Menge: Ganzzahl von 1 bis 20, Standard 1
- Bestellart: Abholung oder Lieferung; nur aktivierte Möglichkeiten
- Name: optional
- Lieferadresse: nur bei Lieferung sichtbar und dann erforderlich
- Anmerkung: optional, maximal 300 Zeichen

Der angezeigte Gesamtpreis ist `Einzelpreis × Menge` und dient als
Zusammenfassung. Er wird nicht als Zahlungsforderung oder verbindliche
Preisgarantie formuliert.

### 5.3 WhatsApp-Übergabe

„In WhatsApp öffnen“ validiert den Clientzustand und erstellt eine klar
strukturierte Nachricht, beispielsweise:

```text
Hallo Ocakbasi Rheydt,
ich möchte gerne bestellen:

2 × Döner im Fladenbrot (7,50 €)
Bestellart: Abholung
Name: Max
Anmerkung: Ohne Zwiebeln

Angezeigter Gesamtpreis: 15,00 €
```

Bei Lieferung wird die Adresse ergänzt. Leere optionale Felder werden nicht
ausgegeben. Ladenname, Gerichtsdaten und Preis stammen ausschließlich aus dem
serverseitig gelieferten Profil. Die Zieladresse wird als
`https://wa.me/<normalisierte-nummer>?text=<url-kodierte-nachricht>` erzeugt und
in einem neuen Browserkontext geöffnet.

Kebapp sendet die Nachricht nicht selbst, speichert keine Eingaben und erhält
keine Sendebestätigung. Diese Grenze wird direkt unter der Absendeaktion kurz
erklärt.

## 6. Fehler- und Ausweichverhalten

- Ohne gültige WhatsApp-Nummer erscheinen weder WhatsApp-Aktionen noch
  Bestellzettel; Telefon wird Hauptaktion.
- Sind weder Abholung noch Lieferung aktiviert, wird die WhatsApp-Funktion im
  öffentlichen Auftritt deaktiviert und das Profil darf so nicht veröffentlicht
  werden, wenn eine WhatsApp-Nummer hinterlegt ist.
- Bei Lieferung ohne Adresse bleibt der Dialog offen, fokussiert das Feld und
  zeigt eine verständliche Fehlermeldung.
- Eine ungültige Menge oder nicht mehr vorhandene Gericht-ID verhindert den
  WhatsApp-Übergang.
- Blockiert der Browser das neue Fenster, bleibt ein normaler fokussierbarer
  WhatsApp-Link als Ausweichaktion sichtbar.
- Telefonnummern werden für `tel:` und `wa.me` normalisiert; die sichtbare
  Schreibweise bleibt unverändert.
- Fehlt ein eigenes Headerbild, wird ohne Layoutsprung das lokale Standardmotiv
  verwendet.
- Bildfehler im Editor verändern das bisher gespeicherte Bild nicht.

## 7. Editor

Der Abschnitt „Auftritt“ erhält einen separaten Headerbild-Editor mit Vorschau,
Dateiauswahl und Entfernen-Funktion. Unterstützt werden PNG, JPEG und WebP. SVG
wird nicht akzeptiert. Empfohlen wird ein breites Foto mit ausreichend freier
Fläche für helle Texte.

Der Abschnitt „Kontakt“ erhält:

- WhatsApp-Nummer
- Hilfsaktion „Telefonnummer übernehmen“
- Schalter „Abholung anbieten“
- Schalter „Lieferung anbieten“

Die Telefonnummer bleibt unabhängig davon erforderlich. Eine leere
WhatsApp-Nummer bedeutet bewusst, dass keine WhatsApp-Bestellung angeboten
wird. Es erfolgt keine stille automatische Aktivierung.

Alle Änderungen erscheinen sofort in der vorhandenen Livevorschau. Die
Vorschau darf den eigentlichen WhatsApp- oder Telefonaufruf nicht starten;
Aktionen sind dort als Vorschau gekennzeichnet beziehungsweise unterdrückt.

## 8. Komponenten und Zuständigkeiten

Die öffentliche Route bleibt eine Server Component und lädt das veröffentlichte
Profil mandantenneutral über die bestehende Datenbankfunktion.

Die Darstellung wird aufgeteilt in:

- `Storefront`: serverseitige Seitenstruktur, Hero, Menü, Kontakt,
  Öffnungszeiten und Footer
- `StorefrontOrderSheet`: kleine Client Component für Dialogzustand,
  Feldervalidierung, Preiszusammenfassung und WhatsApp-Link
- gemeinsame reine Hilfsfunktionen für Telefonnummern-Normalisierung,
  Geldformatierung und Nachrichtenerzeugung
- `WebsiteEditor`: bestehende Client Component, erweitert um Bild- und
  Bestellkanalpflege

Nur der Bestellzettel und der ohnehin interaktive Editor werden hydratisiert.
Profilabfrage, Publikationsprüfung und öffentliche Seitenstruktur bleiben auf
dem Server.

## 9. Datenmodell und Migration

`StoreProfile` wird auf `schemaVersion: 3` angehoben und erhält:

- `heroImageUrl: string`
- `whatsappPhone: string`
- `pickupEnabled: boolean`
- `deliveryEnabled: boolean`

Die Tabelle `store_profiles` erhält entsprechend:

- `hero_image_url` als optionalen Text
- `whatsapp_phone` als optionale Zeichenkette bis 40 Zeichen
- `pickup_enabled` als nicht-null Boolean mit Standard `true`
- `delivery_enabled` als nicht-null Boolean mit Standard `false`

Bestehende Profile erhalten kein still aktiviertes WhatsApp. Das veröffentlichte
Demo-Profil wird über den idempotenten Demo-Seed ausdrücklich mit seiner
Demo-Telefonnummer als WhatsApp-Nummer sowie Abholung und Lieferung versehen.
Neue Entwürfe starten mit Abholung aktiv und Lieferung inaktiv.

Für die aktuelle Ein-Server-Demo wird das Headerbild wie das Logo als streng
größenbegrenzte Data-URL in PostgreSQL gespeichert. Maximal zulässig sind 1 MiB
Binärdaten. Wegen Base64-Kodierung, Logo und JSON-Profil wird das dokumentierte
Next.js-Limit für Server-Actions kontrolliert auf 3 MiB gesetzt. Ein späterer
Wechsel zu S3-kompatiblem Objektspeicher verändert das öffentliche Profilformat
nicht zwingend, weil `heroImageUrl` auch eine interne HTTPS-URL aufnehmen kann.

Die öffentliche Datenbankfunktion, Query-DTOs, RLS-Tests, Seeds und Fixtures
werden gemeinsam mit der Migration aktualisiert. Die Migration verändert keine
Authentifizierungs-, Einkaufs- oder Mandantenzuordnungen.

## 10. Validierung und Sicherheit

- Headerbilder akzeptieren ausschließlich korrekt aufgebaute PNG-, JPEG- oder
  WebP-Data-URLs bis 1 MiB Binärgröße.
- Serverseitige Validierung ist verbindlich; Clientprüfung dient schnellem
  Feedback.
- Die WhatsApp-Nummer darf lesbar gespeichert werden, muss für `wa.me` aber zu
  8 bis 15 Ziffern normalisierbar sein. Ein führendes `+` wird entfernt;
  internationale Schreibweise ist erforderlich.
- Mengen, Gerichtsauswahl und Bestellart werden vor der Linkerzeugung gegen das
  aktuelle Profil geprüft.
- Kundeneingaben werden ausschließlich über `URLSearchParams` beziehungsweise
  `encodeURIComponent` kodiert und niemals als HTML interpretiert.
- Es gibt keinen neuen öffentlichen Schreibendpunkt und keine Bestelldaten in
  Logs, Analytics oder Datenbank.
- Editor-Aktionen behalten vorhandene Authentifizierung, OWNER-/Support-
  Autorisierung, Mandantenkontext und Auditprotokoll.
- Die bestehende Veröffentlichungsprüfung verlangt weiterhin Name, Inhalte,
  Telefon, Adresse, Öffnungszeiten und Menü. Zusätzlich prüft sie konsistente
  WhatsApp- und Bestelloptionen.

## 11. Barrierefreiheit und Responsive Design

- Der Bestellzettel verwendet ein semantisches Dialogelement beziehungsweise
  äquivalente Dialogsemantik mit Fokusfalle, Escape-Schließen und Fokusrückgabe.
- Jedes Feld besitzt ein sichtbares Label; Fehler sind mit dem betroffenen Feld
  verbunden und werden angekündigt.
- Headertext erreicht auf allen Bildern mindestens 4,5:1 Kontrast. Das dunkle
  Overlay ist unabhängig vom Betreiberbild stark genug.
- Primäre mobile Aktionen besitzen mindestens 44 CSS-Pixel Zielhöhe.
- Die feste mobile Leiste berücksichtigt `env(safe-area-inset-bottom)` und
  verdeckt weder Footer noch Dialoginhalt.
- Der Inhalt funktioniert bei 390, 768 und 1280 CSS-Pixel Breite ohne
  horizontalen Überlauf.
- Animationen sind kurz, funktional und bei `prefers-reduced-motion` reduziert.
- Bilder definieren feste Größen beziehungsweise Seitenverhältnisse, um
  Layoutsprünge zu vermeiden.
- Der Hero bleibt bei großen Textskalierungen lesbar und seine Aktionen bleiben
  erreichbar.

## 12. Performance

- Das lokale Standardmotiv wird als passend dimensioniertes WebP mit
  responsiver Auslieferung und Priorität nur im sichtbaren Hero geladen.
- Hochgeladene Data-URLs werden nicht zusätzlich über externe Bilddienste
  geleitet.
- Unterhalb des sichtbaren Bereichs bleiben unnötige Client-Bundles vermieden.
- Der Bestellzettel erhält nur Menü, Kanaloptionen und Ladenname als Props.
- Es wird kein Slider, Video-Hintergrund oder Drittanbieter-Widget eingebaut.

## 13. Tests

Mindestens erforderlich sind:

1. Unit-Tests für Telefonnummern-Normalisierung, Nachrichtentext, Preis und
   Feldvalidierung
2. Komponententests für geöffneten Bestellzettel, vorausgewähltes Gericht,
   Mengenänderung, Abholung, Lieferung, Pflichtadresse, Schließen und Fokus
3. Komponententests für WhatsApp-/Telefon-Fallback und Vorschauunterdrückung
4. Editor-Tests für Headerbildformat, Größenlimit, Entfernen, WhatsApp-Nummer
   und Bestellart-Schalter
5. Integrationstests für Migration, Profilversion 3, Publikationsregeln,
   öffentliche Datenbankfunktion und Mandantentrennung
6. E2E-Test der veröffentlichten Ladenwebsite auf Desktop-Chromium,
   Mobile-Chromium und Mobile-WebKit
7. E2E-Prüfung des erzeugten WhatsApp-Ziels ohne externe Nachricht zu senden
8. visuelle Browserabnahme bei 390, 768 und 1280 CSS-Pixel Breite
9. Lint, TypeScript, Produktionsbuild sowie vollständige Unit-, Integrations-
   und E2E-Suite

## 14. Deployment und Rückfall

Vor dem Deployment wird ein frischer PostgreSQL-Dump erzeugt und dessen
Lesbarkeit geprüft. Danach laufen Migration, idempotenter Demo-Seed,
Containerbuild und die bestehende versionierte Umschaltung.

Nach der Umschaltung werden geprüft:

- HTTPS und öffentliche Ladenroute
- neues Headerbild und responsiver Zuschnitt
- WhatsApp- und Telefonlinks
- Bestellzettel für Abholung und Lieferung
- Website-Editor sowie Speichern und erneutes Laden
- Demo-Rollen, Mandantengrenzen, Containerzustand und Fehlerlogs

Bei einem Anwendungsfehler wird das vorherige Image aktiviert. Für
Datenprobleme steht der unmittelbar zuvor erzeugte Dump bereit. Eine
WhatsApp-Nachricht wird auch im Smoke-Test nicht tatsächlich gesendet.

## 15. Abnahmekriterien

Der Durchlauf ist abgeschlossen, wenn:

- die Seite visuell wie ein professioneller Restaurantauftritt wirkt und das
  Dönerprodukt im Hero klar im Mittelpunkt steht
- fremdes Referenzmaterial weder ausgeliefert noch in das Repository übernommen
  wird
- Betreiber:innen Headerbild, WhatsApp-Kanal, Abholung und Lieferung im Editor
  pflegen können
- jedes Gericht eine korrekte WhatsApp-Bestellung vorbereiten kann
- Lieferung ohne Adresse verhindert wird
- bei fehlendem WhatsApp-Kanal Telefon als eindeutige Hauptaktion funktioniert
- Kebapp keinerlei Endkunden-Bestelldaten speichert oder versendet
- öffentliche Seite, Vorschau und Editor auf Mobil und Desktop vollständig
  bedienbar sind
- bestehende Rollen-, Mandanten-, Rechtsseiten-, Backup- und Deploymentprüfungen
  weiterhin bestehen
