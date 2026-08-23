# Finaler UI/UX-Report: Kebapp-Gesamtprodukt

**Datum:** 23. August 2026  
**Live-System:** https://178-105-107-243.sslip.io  
**Status der Prüfung:** Produktweiter Abschlusscheck ohne Datenänderungen  
**Ersetzt als Gesamturteil:** Der Storefront-Report bleibt als Detailprüfung der öffentlichen Restaurantseite bestehen, ist aber nicht mehr das Gesamtprodukt-Urteil.

## 1. Executive Summary

Kebapp besitzt bereits eine eigenständige, professionelle Produktsprache und erklärt den betreuten Gruppeneinkauf besser als ein typisches generisches SaaS-Dashboard. Inhaber-, Mitarbeiter-, Support- und Adminbereiche sind visuell klar getrennt, bleiben aber erkennbar Teil derselben Marke. Der wichtigste Kernablauf – Fleischbedarf erfassen und durch den Inhaber verbindlich bestätigen – ist verständlich und sicher gestaltet. Die öffentliche Restaurantseite ist conversion-stark und der Supportbereich kommuniziert seine eingeschränkten Rechte vorbildlich.

Das Gesamtprodukt ist **für geführte Präsentationen und moderierte Pilotgespräche geeignet**. Für einen unbeaufsichtigten Pilotbetrieb sollten zuerst die P1-Punkte behoben werden. Besonders relevant sind der Tablet-Überlauf im Einkauf, die nicht auffindbare Teamverwaltung, fehlende Abmeldemöglichkeiten in Admin und Support sowie der sehr lange Website-Editor mit einer für assistive Technik nicht isolierten Vorschau.

**Gesamtbewertung:** 8,0 von 10.  
**Geführte Produktdemo:** freigabefähig.  
**Unbeaufsichtigter Pilot mit echten Betrieben:** nach P1-Korrekturen.  
**Vollständiges digitales Betriebssystem gemäß Langfristvision:** noch nicht erreicht; mehrere Module sind bewusst nicht Teil des aktuellen technischen Kerns.

| Bereich | Bewertung | Kurzurteil |
| --- | ---: | --- |
| Visuelle Produktsprache | 8,9/10 | Eigenständig, konsistent und deutlich über Standard-SaaS-Niveau |
| Inhaber-Dashboard | 8,6/10 | Klare Entscheidungen statt Funktionsfriedhof |
| Gruppeneinkauf | 8,5/10 | Verständlicher Kernablauf mit guter verbindlicher Bestätigung |
| Website und Storefront | 8,1/10 | Sehr starke öffentliche Seite; Editor benötigt strukturelle Straffung |
| Mitarbeiterrollen | 8,0/10 | Berechtigungen funktionieren; fehlende Erklärung für Inhaberaktionen |
| Support | 8,6/10 | Ausgezeichnete Sicherheits- und Rollenkommunikation |
| Administration | 7,6/10 | Klar aufgebaut, aber Demo-Daten und Kontomenü fehlen |
| Responsive Design | 7,9/10 | Mobil überwiegend sehr gut; Tablet-Fehler im Einkauf |
| Barrierefreiheit | 7,6/10 | Gute Grundlagen; Preview-Semantik und eindeutige Buttonnamen offen |
| Onboarding und Demo-Funnel | 7,0/10 | Attraktiv, aber primäre Aktionen mobil zu spät und echter Interessentenweg unklar |

## 2. Geprüfter Umfang

### Öffentliche und Auth-Seiten

- Produktdemo `/`
- Anmeldung `/anmelden`
- Registrierung `/registrieren`
- Ladenantrag `/antrag`
- Status-Weiterleitung `/status`
- Öffentliche Restaurantseite `/laden/ocakbasi-rheydt`
- Impressum und Datenschutz der Restaurantseite aus der Storefront-Detailprüfung

### Inhaber- und Mitarbeiterbereich

- Übersicht `/app`
- Gruppeneinkauf `/app/einkauf`
- Website-Editor `/app/website`
- Teamverwaltung `/app/einstellungen/team`
- Zweiter Beispielbetrieb zur visuellen Prüfung der Mandantendarstellung
- Unterschiede zwischen Inhaber- und Mitarbeiterzugang

### Plattformrollen

- Adminübersicht `/admin`
- Ladenanträge `/admin/antraege`
- Supporteinsätze `/admin/support`
- Auditprotokoll `/admin/audit`
- Supportübersicht `/support`
- Support-Ladendetail `/support/laeden/...`

### Viewports und Interaktionen

- Desktop mit 1280 px Breite
- Tablet mit 768 px Breite
- Mobil mit 390 px Breite
- Mobile Navigationen
- Bedarfsposition-Dialog
- Verbindlicher Bestätigungsdialog
- WhatsApp-Bestelldialog der Restaurantseite
- Fehlende Lieferadresse und Fokusführung
- Rollenwechsel über alle fünf öffentlichen Demo-Perspektiven

Es wurden keine realen Bestellungen, Supportänderungen, Einladungen, Anträge oder Domainwünsche abgesendet.

## 3. Was produktweit bereits sehr gut funktioniert

### Klare Produkthierarchie

Der Inhaberbereich zeigt zuerst Entscheidungen und wirtschaftliche Signale: Gruppenmenge, Zielpreis, Lieferung, Einsparung und konkrete Aufgaben. Das entspricht der Produktausrichtung besser als eine Navigation voller noch nicht fertiger Module.

### Starker Gruppeneinkaufsablauf

- Gruppenmenge, Zielmenge und Zielpreis werden sofort verstanden.
- Eigener Anteil und aktueller Gruppenpreis sind klar voneinander getrennt.
- Positionen lassen sich pro Produkt und Lieferdatum bearbeiten.
- Die verbindliche Freigabe besitzt einen eigenen Prüfdialog.
- Gesamtmenge, Warenwert, Lieferfenster und einzelne Positionen werden vor der Bestätigung wiederholt.
- Die Demo weist mehrfach darauf hin, dass keine reale Lieferantenbestellung entsteht.
- Mitarbeiter können Bedarfe pflegen, aber nicht verbindlich bestätigen.

### Sehr gute Sicherheitskommunikation im Support

Der Supportbereich erklärt dauerhaft, dass die Supportperson nicht als Ladeninhaber handelt. Änderungen verlangen Begründungen, Bestätigungen bleiben beim Inhaber und die eigene Supportidentität bleibt sichtbar. Diese Kommunikation ist besser als bei vielen realen B2B-Backoffices.

### Konsistente Rollenwelten

Inhaber, Mitarbeiter, Support und Admin haben unterschiedliche Informationsdichten und Navigationsmodelle, ohne dass die Marke auseinanderfällt. Die zweite Inhaber-Demo zeigt den anderen Betrieb klar mit eigenem Namen und Kürzel.

### Gute mobile Grundarchitektur

- Inhaber und Mitarbeiter erhalten eine klare Drei-Punkt-Tabbar.
- Das mobile Menü besitzt verständliche Öffnen-/Schließen-Namen und einen Scrim.
- Einkauf, Dashboard, Admin und Support brechen bei 390 px ohne horizontalen Überlauf um.
- Primäre mobile Aktionen sind groß genug und visuell eindeutig.
- Die öffentliche Restaurantseite hält WhatsApp und Telefon dauerhaft erreichbar.

### Gute Accessibility-Basis

- Skiplinks sind in den wesentlichen Shells vorhanden.
- Normalerweise gibt es genau eine H1 und eine logische H2-/H3-Struktur.
- Hauptnavigationen besitzen zugängliche Namen und aktive Seiten nutzen `aria-current`.
- Sichtbare Iconbuttons besitzen überwiegend konkrete Namen.
- Dialoge sind benannt, sperren den Hintergrund und führen den Fokus sinnvoll.
- In den geprüften Browserzuständen traten keine Konsolenfehler auf.

## 4. P1 – vor einem unbeaufsichtigten Pilotbetrieb beheben

### P1.1 Horizontaler Überlauf im Einkauf bei 768 px

Auf 768 px beträgt die Dokumentbreite 831 px. Die Bedarfstabelle reicht bis 852 px und erzeugt einen sichtbaren horizontalen Seiten-Scrollbar. Bei 390 px wird die Tabelle korrekt in mobile Karten umgebaut; der aktuelle Umschaltpunkt bei 760 px greift für kleine Tablets jedoch zu spät.

**Auswirkung:** Der wichtigste Produktablauf wirkt auf Tablets beschädigt und die Löschen-Aktion liegt teilweise außerhalb des sichtbaren Bereichs.

**Empfehlung:** Den Karten-Breakpoint der Bedarfstabelle auf mindestens 840 px, besser passend zur vorhandenen 920-px-Shell-Umschaltung, erhöhen. Alternativ muss der Tabellencontainer lokal horizontal scrollen, ohne die gesamte Seite zu verbreitern.

### P1.2 Teamverwaltung ist über die Oberfläche nicht erreichbar

Die Teamseite unter `/app/einstellungen/team` ist fertig gestaltet und funktioniert bei direktem Aufruf. Weder Desktop-Sidebar, mobile Tabbar, Account-Menü noch Dashboard enthalten jedoch einen Link dorthin.

**Auswirkung:** Inhaber können die vorhandene Funktion ohne Kenntnis der URL nicht entdecken oder benutzen.

**Empfehlung:** „Team & Zugriff“ als Inhaber-Navigation ergänzen oder im Account-Menü unter Einstellungen verlinken. Für Mobilgeräte kann der Punkt im Hamburger-Menü liegen, auch wenn die Drei-Punkt-Tabbar unverändert bleibt.

### P1.3 Admin und Support besitzen keine Abmeldung

Die Inhaber-/Mitarbeiter-Shell enthält ein Account-Menü mit „Abmelden“. Admin- und Supportnavigation zeigen lediglich „Angemeldet als …“, bieten aber weder ein Kontomenü noch eine Abmeldeaktion – auch nicht im mobilen Menü.

**Auswirkung:** Interne Nutzer können ihre Sitzung nicht kontrolliert beenden. Auf gemeinsam genutzten Geräten ist das ein Sicherheits- und Vertrauensproblem.

**Empfehlung:** Ein einheitliches Kontomenü mit Name, Rolle und „Abmelden“ in beide Shells aufnehmen. Mobil gehört die Aktion ans Ende des geöffneten Menüs.

### P1.4 Website-Editor ist zu lang und speichert zu spät

Der Editor ist auf Desktop etwa 4.659 px und mobil etwa 5.789 px hoch. Der einzige Button „Änderungen speichern“ liegt auf Desktop erst bei ungefähr 3.313 px und mobil bei ungefähr 4.883 px. Nutzer können am Seitenanfang Veröffentlichung, Logo oder Headerbild ändern und müssen anschließend mehrere Bildschirmhöhen bis zur einzigen Speicheraktion scrollen.

**Auswirkung:** Hohe Gefahr von Unsicherheit, vergessenen Änderungen und unnötigem Scrollen. Auf Mobilgeräten ist der Editor der schwächste Kernbereich.

**Empfehlung:** Sticky Save Bar mit Status „Ungespeicherte Änderungen / Gespeichert“, Abschnittsnavigation und einklappbare Gruppen einführen. Die Vorschau sollte auf Mobil über einen separaten „Vorschau öffnen“-Modus erscheinen.

### P1.5 Vorschau verdoppelt die Dokumentstruktur im Website-Editor

Die Restaurantvorschau wird im selben Dokument als vollständige zweite Storefront gerendert. Dadurch enthält der Editor zwei H1, zwei `main`-Landmarken, mehrere zusätzliche Navigationen sowie erneut interaktive Bestell- und Kontaktaktionen. Die Vorschau ist weder `aria-hidden` noch `inert`.

**Auswirkung:** Screenreader-Nutzer erleben nach dem eigentlichen Editor praktisch eine zweite Website und eine uneindeutige Dokumentstruktur.

**Empfehlung:** Die Vorschau bevorzugt in ein benanntes `iframe` auslagern. Falls sie rein visuell bleibt, den Preview-Container `inert` und `aria-hidden="true"` setzen und eine separate zugängliche Aktion „Öffentliche Website öffnen“ anbieten.

### P1.6 Datum und Begrüßung wirken nicht vertrauenswürdig

Die Live-Prüfung fand am 23. August in der Zeitzone Europe/Berlin statt; das Inhaber-Dashboard zeigte „Samstag, 22. August“. Die Tagesanzeige nutzt serverseitig keine festgelegte Berliner Zeitzone. „Guten Morgen“ ist unabhängig von der Uhrzeit fest im Dashboard hinterlegt; die Adminseite zeigt sogar statisch „Freitag“ und „Guten Abend“.

**Auswirkung:** Schon in der ersten Überschrift entsteht der Eindruck von Beispieldaten oder einer falsch konfigurierten Anwendung, obwohl der Rest live wirkt.

**Empfehlung:** Datum und Begrüßung konsistent in `Europe/Berlin` berechnen oder zeitunabhängige Formulierungen wie „Hallo, Meral“ und „Aktueller Prüflauf“ verwenden.

## 5. P2 – hohe Wirkung nach den P1-Korrekturen

### P2.1 Demo- und Interessenten-CTA zu spät

Auf 390 px liegt der erste Button zum Öffnen einer Demo-Rolle bei ungefähr 1.741 px und damit mehr als zwei Bildschirmhöhen unter dem Seitenanfang. Im ersten Viewport ist nur „Klassisch anmelden“ sichtbar. Gleichzeitig gibt es keinen klaren CTA „Pilotladen werden“ oder „Interesse anmelden“.

**Empfehlung:** Im Hero einen primären Button „Demo starten“ mit Sprung zu den Rollen und einen sekundären CTA „Pilotladen werden“ ergänzen. Der aktuelle Sammelzettel kann darunter bleiben.

### P2.2 Akquisefunnel ist in der öffentlichen Demo nicht geschlossen

Die Registrierung ist absichtlich deaktiviert. Der Ladenantrag benötigt jedoch bereits eine Sitzung und ist von der Startseite nicht verlinkt. Ein echter Interessent kann daher weder einen Pilotantrag stellen noch klar erkennen, wie er Kontakt aufnehmen soll.

**Empfehlung:** Produktentscheidung treffen und offen kommunizieren:

- Entweder einen datensparsamen öffentlichen Interessen-/Kontaktprozess anbieten.
- Oder deutlich „Pilot nur auf Einladung“ anzeigen und eine konkrete Kontaktmöglichkeit verlinken.

### P2.3 Admin-Demo zeigt keine prüfbaren Fälle

Ladenanträge und Auditprotokoll sind leer, obwohl die Demo genau diese Adminperspektive bewirbt. Der Entscheidungsdetailbildschirm, Statuswechsel und sinnvolle Auditereignisse können dadurch live nicht beurteilt werden.

**Empfehlung:** Mindestens einen offenen Antrag, eine dokumentierte Entscheidung, einen abgelaufenen Supporteinsatz und drei bis fünf Auditereignisse idempotent als Demo-Fixtures anlegen.

### P2.4 Mitarbeiterrolle erklärt die fehlende Bestätigung nicht

Im Mitarbeiter-Einkauf verschwindet der komplette Bestätigungsabschnitt korrekt. Es gibt jedoch keinen sichtbaren Hinweis, dass nur Inhaber verbindlich freigeben können.

**Empfehlung:** Unter der Gesamtsumme einen Rollenhinweis anzeigen: „Du kannst den Entwurf bearbeiten. Die verbindliche Freigabe übernimmt eine Inhaberin oder ein Inhaber.“

### P2.5 Mehrdeutige zugängliche Buttonnamen

Alle fünf Buttons der Rollen-Demo heißen „Demo als diese Rolle öffnen“. Auch die drei Speisekartenaktionen der öffentlichen Restaurantseite heißen jeweils „Per WhatsApp bestellen“.

**Empfehlung:** Den Kontext in den zugänglichen Namen aufnehmen, beispielsweise „Demo als Betreuung öffnen“ und „Ocakbasi Teller per WhatsApp bestellen“. Der sichtbare kurze Text kann bestehen bleiben.

### P2.6 Kleine beziehungsweise kontrastarme Metadaten

Einige sekundäre Texte sind sehr klein und unterschreiten auf festen Hintergründen den üblichen WCAG-Kontrastwert für normalen Text. Gemessen wurden zum Beispiel 10 px bei einem Kontrast von ungefähr 3,33:1 für „Beispielprognose · noch ohne Kassendaten“ und 7 px bei ungefähr 3,03:1 für den Website-Pfad.

**Empfehlung:** Relevante Metadaten mindestens 11–12 px groß darstellen und auf 4,5:1 Kontrast anheben. Sehr kleine Großbuchstaben nur für rein dekorative Rubriken verwenden.

### P2.7 Kleine Desktop-Aktionsziele vereinheitlichen

Mehrere Desktopaktionen sind nur 34–38 px hoch: Dashboard-Iconlinks, Sortier-/Löschen-Buttons im Website-Editor und Admin-Navigation. Mobil werden die meisten korrekt vergrößert.

**Empfehlung:** Auch auf Desktop für häufige Aktionen 40–44 px vorsehen. Dies unterstützt Touch-Laptops und reduziert Fehlklicks.

## 6. P3 – Optimierungen und Validierung

### P3.1 Website-Editor in Aufgaben statt Datenfelder gliedern

Die aktuelle Reihenfolge ist fachlich korrekt, aber Nutzer müssen sehr viele Felder auf einmal verarbeiten. Sinnvoll wären die klaren Aufgaben „Online stellen“, „Aussehen“, „Kontakt“, „Öffnungszeiten“, „Speisekarte“ und „Domain“ mit je eigenem Status.

### P3.2 Dashboard-Vorschlag stärker erklären

Der KI-/Pilotvorschlag ist als Beispiel gekennzeichnet. Für spätere echte Daten sollte zusätzlich sichtbar werden, welche Datenbasis, welcher Zeitraum und welche Unsicherheit zur Empfehlung geführt haben.

### P3.3 Supportkarten kürzer benennen

Die zugängliche Bezeichnung der Ladenkarte enthält derzeit Status, Ladenname, Beschreibung und Ablaufhinweis in einem langen Linknamen. Ein klarer Name wie „Ocakbasi Rheydt öffnen“ mit separater Beschreibung wäre für Sprachsteuerung leichter.

### P3.4 Storefront-Verbesserungen aus dem Detailreport

Für die öffentliche Restaurantseite bleiben die bereits dokumentierten Punkte bestehen: kleine Header-CTA, semantischer Pflichtstatus der Lieferadresse, individuelle statt doppelter Inhalte sowie später reale Betriebsinformationen und Social Proof.

## 7. Produktreife gegenüber der Kebapp-Vision

Der aktuelle Stand ist ein überzeugender **technischer Kern**, aber noch nicht das vollständige digitale Betriebssystem aus der Produktspezifikation.

### Bereits als zusammenhängender Pilot vorhanden

- Mandanten und Rollen
- Inhaber- und Mitarbeiterbereich
- Bedarfserfassung und verbindliche Freigabe
- Sichtbare regionale Gruppenmenge und Preisziel
- Website-Self-Service und öffentliche Restaurantseite
- Team- und Einladungsgrundlage
- Adminfreigaben, Supportzuweisungen und Auditarchitektur
- Demo-Domainwunsch

### Bewusst noch nicht vollständig operationalisiert

- Lieferantenportal, Angebotsvergleich und Vergabe
- Übergabe der bestätigten Gruppenbestellung an einen Lieferanten
- Lieferstatus, Lieferschein, Rechnung und Reklamation
- Buchhaltungsvorbereitung und Expertenfreigabe
- Warenbestand, Kalkulation, Hygiene und Personalmodule
- Kassendaten und echte KI-Prognosen
- Automatische `.de`-Registrierung, DNS- und SSL-Statuskette
- Produktive E-Mail-Zustellung
- Zahlung, wie ausdrücklich vereinbart

Diese Punkte sind keine UI-Fehler des aktuellen Demo-Scopes. Sie bestimmen jedoch, wann Kebapp vom überzeugenden Demonstrator zu einem operativ vollständigen Einkaufs- und Betriebssystem wird.

## 8. Nicht vollständig live testbare Zustände

- Antragsstatus `PENDING`, `REJECTED` und `SUSPENDED`, da kein passendes Demo-Konto vorhanden ist
- Admin-Entscheidungsdetail, da keine Demo-Anträge vorhanden sind
- Ladenwechsler, da kein Demo-Nutzer mehreren Läden zugeordnet ist
- Einladung mit gültigem Token
- E-Mail-Bestätigung und Passwort-Reset, weil E-Mail im öffentlichen Demo-Modus deaktiviert ist
- Reale Domainregistrierung, Lieferantenübergabe und Zahlung, da diese nicht implementiert beziehungsweise ausdrücklich nicht im Scope sind

Diese fehlenden Zustände sollten durch sichere, rücksetzbare Demo-Fixtures abgedeckt werden, bevor externe Tester das Produkt ohne Begleitung bewerten.

## 9. Empfohlene Umsetzungsreihenfolge

### Paket A – Pilot-Blocker

1. Bedarfstabelle bei Tabletbreite umbrechen.
2. Teamverwaltung in Navigation oder Account-Menü verlinken.
3. Abmeldung für Admin und Support ergänzen.
4. Website-Editor mit Sticky Save Bar und separater/inert gesetzter Vorschau umbauen.
5. Datum und Begrüßung zeitzonenrichtig beziehungsweise zeitunabhängig machen.

### Paket B – Selbstständige Demo und Akquise

6. „Demo starten“ oberhalb des mobilen Folds platzieren.
7. Öffentlichen Interessentenweg definieren und verlinken.
8. Admin-, Status-, Audit- und Multi-Store-Demo-Fixtures ergänzen.
9. Mitarbeiterrechte im Einkauf explizit erklären.

### Paket C – Accessibility und Conversion

10. Zugängliche Buttonnamen eindeutig machen.
11. Kleine Metadaten und Desktop-Aktionsziele überarbeiten.
12. Storefront mit echten Pilotinhalten, Betriebsinformationen und optionalem Social Proof bestücken.

### Paket D – Operativer End-to-End-Pilot

13. Einkaufsteam-/Lieferantenübergabe abbilden.
14. Lieferung, Rechnung, Ersparnis und Reklamation bis zum Abschluss verfolgen.
15. Domainbereitstellung und später Buchhaltungs-/Betriebsmodule schrittweise anschließen.

## 10. Abschlussurteil

Kebapp sieht bereits wie ein echtes, eigenständiges B2B-Produkt aus und nicht wie ein generischer Prototyp. Der Gruppeneinkauf, die Rollenabgrenzung, die Supportlogik und die öffentliche Restaurantseite bilden eine überzeugende Grundlage. Ein erneutes grundlegendes Redesign ist nicht erforderlich.

Vor dem ersten unbeaufsichtigten Pilotladen sollten jedoch die sechs P1-Punkte abgeschlossen werden. Danach ist der nächste wichtige Meilenstein nicht mehr primär visuell, sondern operativ: einen bestätigten Gruppenbedarf bis zur Lieferantenübergabe und zum nachvollziehbaren Liefer-/Rechnungsergebnis end-to-end abbilden.
