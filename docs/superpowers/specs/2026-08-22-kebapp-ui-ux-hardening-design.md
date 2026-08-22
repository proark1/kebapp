# Kebapp – UI/UX-Härtung der öffentlichen Demo

**Stand:** 22. August 2026  
**Status:** In vier Abschnitten durch den Auftraggeber freigegebener Entwurf  
**Umgebung:** Öffentliche Hetzner-Demo mit `DEMO_MODE=true`

## 1. Ziel

Die bestehende Kebapp-Demo wird von einer betreuungsbedürftigen Produktvorschau
zu einer selbsterklärenden, mobilen und fehlertoleranten Demo weiterentwickelt.
Die visuelle Identität bleibt erhalten. Verbessert werden Einstieg,
Rollenverständnis, sichere Bestellfreigabe, Navigation, Ladenwebsite,
Website-Self-Service und Barrierefreiheit.

Der Durchlauf ist erfolgreich, wenn eine neue Testperson ohne separate
Einweisung eine Demo-Rolle auswählen, den Gruppeneinkauf verstehen, die
wichtigsten Ladenaufgaben ausführen und die öffentliche Ladenwebsite bearbeiten
kann, ohne Beispielwerte mit echten Bestellungen oder Produktivfunktionen zu
verwechseln.

## 2. Verbindlicher Umfang

Enthalten sind:

1. öffentliche Demo-Einstiegsseite statt sofortiger Login-Weiterleitung
2. Ein-Klick-Anmeldung für alle fünf vorbereiteten Demo-Rollen
3. konsistente Demo-Kennzeichnung und Entfernung lokaler Mailpit-Texte
4. mobile Priorisierung von Rollenwahl und Login
5. bereinigtes Dashboard ohne funktionslose Aktionen
6. zweistufige Freigabe eines Bedarfs mit vollständiger Zusammenfassung
7. funktionierende mobile Admin-Navigation und aktive Navigationszustände
8. erweiterter Website-Editor für Logo, Merkmale, Öffnungszeiten und Speisekarte
9. Demo-Oberfläche für Domainwunsch und Domainstatus
10. eigene Demo-Musterseiten für Impressum und Datenschutz
11. größere Touch-Ziele, ausreichende Kontraste und robuste Tastaturbedienung
12. automatisierte Tests, Produktionsabnahme und erneutes Live-Deployment

Nicht enthalten sind echte Domainregistrierung, Registrar-API, produktiver
E-Mail-Versand, Zahlung, echte Rechtstexte, individuelle Rechtsberatung,
Objektspeicher oder ein Lieferantenportal.

### 2.1 Umsetzungspakete

Der zusammenhängende Release wird intern in fünf überprüfbare Pakete zerlegt:

1. Demo-Einstieg, Ein-Klick-Anmeldung und konsistente Demo-Kommunikation
2. Dashboard, sichere Bestellfreigabe sowie Admin-/Supportnavigation
3. Datenmigration, Profilvalidierung und vollständiger Website-Editor
4. öffentliche Ladenwebsite, Domain-Demo, Muster-Rechtsseiten und Accessibility
5. Gesamtregression, Containerabnahme und Live-Deployment

Jedes Paket endet mit seinen relevanten Tests. Das nächste Paket darf auf dem
vorherigen Datenmodell aufbauen; die öffentliche Umschaltung erfolgt jedoch nur
einmal nach bestandener Gesamtabnahme.

## 3. Gestaltungsrichtung

Kebapp behält Dunkelgrün, warmes Papierweiß, gelbe Markierungen, die bestehende
Typografie und die sachliche Sprache. Die Anwendung soll wie ein regionales
Betriebswerkzeug wirken, nicht wie ein austauschbares SaaS-Dashboard.

Das charakteristische Element der neuen Einstiegsseite sind Rollenkarten in der
Anmutung nummerierter Bestellzettel beziehungsweise Betriebsausweise. Jede Karte
zeigt Rolle, Ladenkontext, mögliche Aufgaben und das eindeutige Ziel
„Demo als diese Rolle öffnen“. Dekoration bleibt gegenüber Verständlichkeit
nachgeordnet.

Eine schmale Demo-Leiste in geschützten Bereichen verwendet die Formulierung:

> Öffentliche Demo · Beispieldaten · kein E-Mail-Versand

In einkaufsbezogenen Oberflächen kommt ergänzend der Hinweis hinzu, dass eine
Bestätigung nur Demo-Daten sperrt und keine reale Bestellung auslöst.

## 4. Demo-Einstieg und Authentifizierung

### 4.1 Öffentliche Startseite

`/` wird eine eigenständige öffentliche Seite und leitet nicht mehr automatisch
nach `/anmelden` weiter. Oberhalb der Falz stehen:

- das Nutzenversprechen „Gruppeneinkauf und digitales Betriebssystem für
  unabhängige Dönerläden“
- Region und Demo-Status
- Rollenkarten für Admin, Support, Inhaber:in A, Mitarbeiter:in A und
  Inhaber:in B
- ein kurzer Hinweis auf Beispieldaten, deaktivierte E-Mails und fehlende reale
  Bestellwirkung
- ein sekundärer Link zur klassischen Anmeldung

Auf kleinen Viewports erscheint die Rollenauswahl vor ausführlicher
Marketingkommunikation.

### 4.2 Ein-Klick-Anmeldung

Die Rollenkarten senden ausschließlich einen erlaubten Rollenbezeichner an eine
serverseitige Aktion. E-Mail-Adressen und Passwörter werden nicht in HTML,
Client-JavaScript, Query-Parametern oder Browser-Logs ausgegeben.

Die Aktion:

1. prüft serverseitig `DEMO_MODE=true`
2. akzeptiert nur eine feste Allowlist vorbereiteter Demo-Rollen
3. liest das zugehörige Konto und Passwort aus der produktiven Server-Env
4. meldet über den bestehenden Better-Auth-Pfad an, ohne Rollen- oder
   Mandantenprüfungen zu umgehen
5. leitet zum vorhandenen rollenabhängigen Ziel weiter
6. antwortet bei Rate-Limit, fehlender Demo-Konfiguration oder Anmeldefehler mit
   einer verständlichen neutralen Meldung

Außerhalb des Demo-Modus wird weder die Rollenauswahl angezeigt noch die Aktion
ausgeführt.

### 4.3 Klassische Auth-Seiten

`/anmelden` bleibt verfügbar. „Jetzt registrieren“ und „Passwort vergessen“
werden im Demo-Modus nicht als normale aktive Folgeaktionen beworben. Stattdessen
führt ein klarer Link zurück zu den Demo-Rollen.

Alle öffentlichen Auth-Seiten verwenden statt Mailpit-Hinweisen den Text
„Öffentliche Demo · E-Mail-Versand deaktiviert“. Der Produktions- und lokale
Nicht-Demo-Modus behalten ihre bestehenden E-Mail-Abläufe.

## 5. Ladenbereich und Dashboard

Die Hauptnavigation bleibt auf drei funktionsfähige Ziele begrenzt:

- Übersicht
- Einkauf
- Website für Inhaber:innen

„Waren“, „Belege“, „Hygiene“ und „Domain & Sicherheit“ verschwinden aus der
primären Navigation, solange sie nicht bedienbar sind. Geplante Module dürfen
auf der Übersicht in einem klar abgegrenzten Abschnitt „Als Nächstes“ genannt
werden, ohne Schaltflächenwirkung vorzutäuschen.

Das Dashboard unterscheidet echte Demo-Funktionen von Beispielvorschauen:

- Prognosen tragen immer „Beispiel“ beziehungsweise „Pilotvorschau“.
- „Später“ und „Rechnung öffnen“ werden entfernt.
- Aufgaben verlinken nur auf funktionsfähige Ziele.
- Synthetische Kennzahlen erhalten keine reale Betriebswirkung.
- Der Demo-Status ist ohne Scrollen erkennbar.

## 6. Sichere Bestellfreigabe

Die bestehende serverseitige Berechtigungs- und Sperrlogik bleibt maßgeblich.
Der direkte Bestätigungsbutton wird durch einen zweistufigen Ablauf ersetzt:

1. „Bedarf prüfen und bestätigen“ öffnet einen modalen Prüfbeleg.
2. Der Prüfbeleg zeigt Sammelrunde, Produkte, Spezifikationen, Einzelmengen,
   Gesamtgewicht, Lieferdatum, Lieferfenster und geschätzten Betrag.
3. Der Text erklärt, dass die Positionen nach Bestätigung gesperrt werden und
   in die regionale Demo-Gruppenmenge einfließen.
4. Ein sichtbarer Demo-Hinweis erklärt, dass keine Bestellung an einen
   Lieferanten gesendet wird.
5. Erst „Jetzt für die Demo-Gruppenmenge bestätigen“ sendet die bestehende
   Serveraktion.

Der Dialog besitzt Fokusfalle, Escape-/Abbrechen-Funktion, sichtbaren Fokus und
gibt den Fokus nach dem Schließen an den Auslöser zurück. Mitarbeiter:innen
können weiterhin Mengen vorbereiten, erhalten aber keine Bestätigungsaktion.
Doppelte oder verspätete Bestätigungen bleiben serverseitig abgewiesen.

## 7. Admin- und Supportnavigation

Die Admin-Seitenleiste wird auf kleinen Viewports nicht ersatzlos entfernt.
Ein fokussierbarer Menübutton öffnet eine mobile Navigation mit Übersicht,
Ladenanträgen, Supporteinsätzen und Auditprotokoll. Der aktive Bereich wird über
Text, Farbe und `aria-current="page"` markiert.

Die Admin-Navigation wird in eine kleine Client-Komponente isoliert; Daten und
Seiten bleiben Server Components. Dadurch wird kein unnötiger Admin-Inhalt an
den Client verschoben.

Support behält die feste Sicherheitskommunikation. „Meine Läden“ erhält einen
aktiven Zustand. Tabellen und mehrspaltige Arbeitsflächen werden unterhalb ihrer
Breakpoints als Karten beziehungsweise einspaltige Formulare dargestellt.

## 8. Website-Editor

### 8.1 Profil und Logo

Bearbeitbar sind Ladenname, Kurzname, Eyebrow, Tagline, Beschreibung,
Akzentfarbe, Telefon, Adresse und Veröffentlichungsstatus.

Zusätzlich kann eine Inhaberin oder ein Inhaber ein PNG-, JPEG- oder WebP-Logo
auswählen, direkt in der Vorschau sehen und wieder entfernen. Für diese kleine
Demo wird das Bild als größenbegrenzte Data-URL im bestehenden Feld `logo_url`
gespeichert. Zulässig sind höchstens 350 KiB Binärdaten und sichere Bildtypen.
SVG wird nicht angenommen. Serverseitige Prüfung ist verbindlich; Clientprüfung
dient nur dem schnellen Feedback. Ein späterer Wechsel zu Objektspeicher bleibt
eine interne Implementierungsänderung.

### 8.2 Merkmale

Die bisher fest eingebauten Aussagen werden zu einer begrenzten Merkmalsliste:

- Halal
- frisches Gemüse
- hausgemachte Saucen
- vor Ort zubereitet

Nur aktivierte Merkmale erscheinen auf der öffentlichen Website. Das Profil
erhält dafür ein validiertes JSON-Array mit fester Allowlist.

### 8.3 Öffnungszeiten

Öffnungszeiten werden im Editor als geordnete Zeilen mit Tagesbezeichnung und
Zeitangabe bearbeitet. Zeilen können hinzugefügt, entfernt und umsortiert
werden. Mindestens eine vollständige Zeile ist für eine Veröffentlichung
erforderlich; maximal 14 Zeilen sind zulässig.

### 8.4 Speisekarte

Jedes Gericht enthält Name, Kategorie, Beschreibung und Preis. Der Editor
ermöglicht Hinzufügen, Löschen sowie Verschieben nach oben und unten. Er
unterstützt höchstens 40 Gerichte und verwendet stabile IDs. Eine
Veröffentlichung benötigt mindestens ein vollständiges Gericht. Alle Aktionen
aktualisieren die bestehende Live-Vorschau sofort, werden aber erst durch
„Änderungen speichern“ persistiert.

### 8.5 Ungespeicherte Änderungen

Der vorhandene Dirty-Status bleibt sichtbar. Bei einem Browser-Neuladen oder
Verlassen mit ungespeicherten Änderungen wird die native
`beforeunload`-Warnung aktiviert. Innerhalb des Editors bleiben Fehler am
betroffenen Abschnitt sichtbar und die Vorschau nutzbar.

## 9. Domain-Demo

`custom_domain` bleibt ausschließlich einer tatsächlich verbundenen Domain
vorbehalten. Ein Domainwunsch darf deshalb nicht in diesem Feld gespeichert
werden.

Das Datenmodell erhält getrennt:

- `requested_domain`
- `domain_request_status` mit den Zuständen `NONE` und `REVIEW_REQUESTED`
- `domain_requested_at`

Der Editor zeigt Plattformadresse, HTTPS-Status und gegebenenfalls verbundene
Domain. Eine Inhaberin oder ein Inhaber kann einen syntaktisch gültigen
Domainwunsch eingeben und „Zur Prüfung vormerken“. Die Oberfläche verspricht
weder Verfügbarkeit noch Registrierung und erklärt, dass Registrar,
Inhaberdaten und Verfügbarkeit später geprüft werden. Eine erneute Eingabe
ersetzt den eigenen vorgemerkten Wunsch nachvollziehbar.

Es findet kein DNS-, Registrar- oder Zahlungsaufruf statt.

## 10. Öffentliche Ladenwebsite

Die öffentliche Seite bleibt eine Informationswebsite ohne Onlinebestellung.
Sie zeigt das hochgeladene Logo, andernfalls den bisherigen Initialen-Ersatz.
Nur aktivierte Ladenmerkmale werden dargestellt.

Für kleine Viewports werden vertikale Abstände reduziert, ohne die
charakteristische Typografie aufzugeben. Alle Links, Buttons und
`summary`-Elemente erhalten mindestens 24 CSS-Pixel Zielgröße; primäre mobile
Aktionen zielen auf 44 CSS-Pixel. Telefonnummer, Route und Speisekarte bleiben
die wichtigsten Handlungen.

Impressum und Datenschutz werden zu eigenen Routen unter dem jeweiligen
Ladenpfad. Sie verwenden die Ladenidentität, tragen deutlich die Kennzeichnung
„Demo-Muster – keine rechtliche Produktivfassung“ und enthalten keine
erfundenen Betreiberangaben. Die Fußzeile verlinkt auf diese Seiten statt
Platzhalter-Akkordeons zu öffnen.

Statische Behauptungen über Halal, Herstellung oder Zutaten werden aus dem
Template entfernt. Keine Karte, kein Tracking und kein Endkundenkonto werden
ergänzt.

## 11. Datenmodell und Migration

Die bestehende Tabelle `store_profiles` wird vorwärtskompatibel erweitert um:

- `features` als nicht-null JSON-Array mit leerem Standardwert
- `requested_domain` als optionalen Domainnamen
- `domain_request_status` als nicht-null Textwert mit Standard `NONE` und
  Datenbank-Check auf die erlaubten Zustände
- `domain_requested_at` als optionalen Zeitstempel

`logo_url` speichert in dieser Demo entweder `null` oder eine validierte
Bild-Data-URL. `custom_domain` bleibt semantisch unverändert.

Die Migration setzt vorhandene Demo-Merkmale bewusst für den veröffentlichten
Ocakbasi-Laden, ohne Auth-, Mandanten- oder Einkaufsdaten zu verändern. Seed und
Migration bleiben idempotent. `schema_version` des Profil-DTO wird erhöht und
alte Datensätze werden beim Lesen beziehungsweise Migrieren eindeutig auf die
neue Form gebracht.

## 12. Validierung und Fehlerverhalten

- Demo-Rollen werden über eine feste serverseitige Allowlist validiert.
- Logoformat, MIME-Typ, Data-URL-Struktur und Größe werden serverseitig geprüft.
- Domainwünsche werden kleingeschrieben, ohne Schema oder Pfad angenommen und
  auf DNS-konforme Labels begrenzt.
- Merkmale akzeptieren nur bekannte Werte.
- Menü und Öffnungszeiten besitzen Anzahl-, Längen- und Wertebegrenzungen.
- Eine unvollständige Veröffentlichung bleibt gesperrt; Entwürfe dürfen
  unvollständig gespeichert werden, soweit die Grundschemas gültig bleiben.
- Erfolgs- und Fehlermeldungen werden mit `role="status"` beziehungsweise
  `role="alert"` ausgegeben.
- Fehlgeschlagene Aktionen verändern keine vorhandenen Daten teilweise.
- Serveraktionen authentifizieren und autorisieren weiterhin wie API-Endpunkte.

## 13. Barrierefreiheit und responsive Abnahme

Verbindliche Qualitätsgrenzen:

- logische Überschriften und Landmarken
- sichtbare Skip-Links und Fokusrahmen
- programmatische Labels und sinnvolle Autocomplete-Werte
- `aria-current` für aktive Navigation
- Fokusführung und Escape-Verhalten im Bestätigungsdialog
- mindestens 4,5:1 Kontrast für normalen Text
- kein horizontaler Seitenüberlauf bei 390, 768 und 1280 CSS-Pixel Breite
- mindestens 24 CSS-Pixel für alle interaktiven Ziele und 44 CSS-Pixel für
  primäre mobile Aktionen
- Unterstützung von `prefers-reduced-motion`
- Admin-, Support- und Laden-Navigation bleiben auf Mobile vollständig nutzbar

## 14. Test- und Deploymentstrategie

Vor dem Live-Deployment werden mindestens geprüft:

1. Unit-Tests für Demo-Rollenmapping, Domain-, Logo-, Profil- und
   Bestätigungsvalidierung
2. Integrationstests für Migration, Mandantentrennung, Domainwunsch,
   Profilspeicherung und doppelte Bestätigung
3. Komponententests für Rollenkarten, Bestätigungsdialog, Website-Editor und
   mobile Navigation
4. End-to-End-Tests auf Desktop-Chromium, Mobile-Chromium und Mobile-WebKit
5. Ein-Klick-Anmeldung aller fünf Demo-Rollen und deren Ziel-/Zugriffsgrenzen
6. Tastaturbedienung der kritischen Flüsse
7. veröffentlichte und unveröffentlichte Ladenwebsite einschließlich
   Muster-Rechtsseiten
8. Lint, TypeScript, Produktionsbuild, Unit-, Integrations- und E2E-Suite
9. Containerbuild und Produktions-Smoke-Test
10. Datenbankdump vor Deployment und Restore-Test
11. Live-Prüfung von HTTPS, Rollen, Ports, Logs und automatischem Neustart

Das Deployment verwendet den bestehenden versionierten Ablauf. Die Migration
läuft vor Seed und App-Umschaltung. Bei einem App-Fehler wird das vorherige
Image aktiviert; bei Datenproblemen steht der unmittelbar vor dem Deployment
erzeugte Dump zur Verfügung.

## 15. Abnahmekriterien

Der Durchlauf ist abgeschlossen, wenn:

- eine neue Person jede Demo-Rolle ohne Kenntnis eines Passworts öffnen kann
- keine öffentliche Produktionsseite Mailpit erwähnt
- mobile Login- und Rollenauswahl ohne Suche erreichbar sind
- keine sichtbare Schaltfläche eine absichtlich leere Aktion ausführt
- eine Bedarfsbestätigung immer den Prüfbeleg durchläuft
- Admin und Support auf Mobile navigierbar bleiben
- Websiteinhalt, Logo, Merkmale, Öffnungszeiten und Menü vollständig im Editor
  gepflegt werden können
- Domainwunsch klar als unverbindliche Demo-Vormerkung erscheint
- öffentliche Muster-Rechtsseiten erreichbar und eindeutig gekennzeichnet sind
- definierte Kontrast-, Touch- und Overflow-Grenzen eingehalten werden
- bestehende Rollen-, Mandanten-, Backup- und Deploymentprüfungen weiterhin
  bestehen
