# Kebapp: Gruppeneinkauf und digitales Betriebssystem für Dönerläden

**Stand:** 20. August 2026  
**Pilotregion:** Mönchengladbach und Umgebung, anschließend Nordrhein-Westfalen  
**Produktart:** B2B-Web-App/PWA mit automatisch erzeugten B2C-Laden-Websites  
**Status:** Freigegebener Produkt- und Pilotentwurf

## 1. Zusammenfassung

Kebapp soll unabhängige Dönerläden wirtschaftlich und operativ stärken. Der erste Hebel ist ein betreuter Gruppeneinkauf: Mehrere Läden tragen ihren Bedarf ein, Kebapp bündelt die Mengen, verhandelt bessere Konditionen und weist die tatsächliche Ersparnis je Betrieb aus. Im ersten Geschäftsmodell verkauft und liefert der ausgewählte Lieferant direkt an jeden Laden. Kebapp koordiniert und vermittelt. Sobald Volumen, Lieferqualität und Zahlungsfähigkeit belastbar nachgewiesen sind, kann Kebapp später selbst zentral einkaufen und weiterverkaufen.

Der Einkauf ist der wirtschaftliche Einstieg, Kebapp wird jedoch von Beginn an als vollständiges, modular aufgebautes Betriebssystem angeboten. Es umfasst Warenwirtschaft, Kalkulation, Buchhaltungsvorbereitung, Personal, Hygiene, KI-Unterstützung sowie eine kostenlose, automatisch veröffentlichte Website pro aktivem Mitglied. Die Website verwendet ein standardisiertes Template, lässt Logo und Farben anpassen, registriert eine `.de`-Domain, verwaltet SSL und ermöglicht Abholung, Vorbestellung und Onlinezahlung.

Der Pilot startet mit fünf bis zehn unabhängigen Läden in Mönchengladbach und einem Lieferradius von ungefähr 30 bis 50 Kilometern. Erfolg bedeutet gleichzeitig regelmäßige digitale Nutzung und eine belegbare Nettoersparnis von fünf bis zehn Prozent bei vergleichbarer Ware.

## 2. Strategische Entscheidungen

Die folgenden Entscheidungen sind für den Pilot verbindlich:

1. Kebapp beginnt als betreute Einkaufsgemeinschaft mit Software, nicht als reiner Softwareanbieter.
2. Der Einkauf bleibt im Pilot eine direkte Vertrags-, Liefer- und Rechnungsbeziehung zwischen Lieferant und Dönerladen.
3. Kebapp zeigt bereits im Pilot alle wesentlichen Module, begrenzt aber deren Funktionstiefe.
4. Bestehende Kassensysteme werden angebunden oder über standardisierte Exporte importiert. Kebapp baut zunächst keine eigene TSE-Kasse.
5. Buchhaltung, Umsatzsteuervoranmeldung und Abschluss werden umfassend vorbereitet, aber ausschließlich durch fachlich verantwortliche Personen freigegeben und übermittelt.
6. Jede kostenlose Website unterstützt Menü, Abholung, Vorbestellung und Onlinezahlung, aber zunächst keinen eigenen Lieferdienst.
7. Bei Endkundenbestellungen ist Kebapp der Geschäftspartner des Endkunden und nimmt die Zahlung an. Der jeweilige Laden erhält seinen Anteil automatisiert.
8. Die technische Plattform und die Laden-Websites laufen bei Hetzner an einem deutschen Standort. INWX übernimmt Domainregistrierung und DNS; SSL wird über Let’s Encrypt automatisiert.
9. Die Web-App ist mobiloptimiert und als PWA installierbar. Native Android- und iOS-Apps folgen nach dem validierten Pilot.
10. Das Basispaket und die Standard-Website bleiben für aktiv am Gruppeneinkauf teilnehmende Betriebe kostenlos. Einnahmen entstehen aus Einkaufspartnerschaften, Onlinebestellungen und Premium-Funktionen.

## 3. Ausgangslage und Problem

Unabhängige Dönerläden kaufen häufig mit deutlich weniger Verhandlungsmacht als Filial- oder Franchisesysteme ein. Gleichzeitig entstehen im Tagesgeschäft viele getrennte, teilweise manuelle Prozesse:

- Bedarfsschätzungen auf Papier oder per Messenger
- Bestellungen per Telefon, Textnachricht oder E-Mail
- individuelle Preise ohne belastbaren Marktvergleich
- getrennte Lieferscheine, Rechnungen und Zahlungsinformationen
- manuell gepflegte Speisekarten, Allergene und Preise
- uneinheitliche Lager- und Verderberfassung
- aufwendige Arbeitszeit- und Hygienedokumentation
- verspätete oder unvollständige Buchhaltungsunterlagen
- hohe Abhängigkeit von fremden Endkundenplattformen

Steigende Lebensmittel-, Energie- und Personalkosten gehören laut DEHOGA NRW zu den größten Herausforderungen der Gastronomie. Destatis meldete für 2025 einen realen Umsatzrückgang des Gastgewerbes, obwohl der nominale Umsatz stieg. Die Plattform muss deshalb zuerst messbar Kosten und Zeit reduzieren, bevor Komfortfunktionen als Kaufargument wirken. Quellen: [DEHOGA NRW zur Preisentwicklung](https://www.dehoga-nrw.de/fachthemen/preisentwicklung), [Destatis zum Gastgewerbeumsatz 2025](https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/02/PD26_054_45213.html).

## 4. Zielgruppen und Rollen

### 4.1 Ladeninhaber

Der Inhaber bestätigt Bedarfe, kontrolliert Kosten, verwaltet Website und Menü, prüft KI-Vorschläge und gibt Finanzdaten zur fachlichen Kontrolle frei. Seine Startseite zeigt keine Funktionssammlung, sondern heutige Entscheidungen, Risiken und wirtschaftliche Kennzahlen.

### 4.2 Ladenmitarbeiter

Mitarbeiter erfassen Arbeitszeit, Temperaturen, Reinigung, Wareneingang und ausgewählte Bestände. Sie sehen nur die für ihre Rolle notwendigen Daten.

### 4.3 Kebapp-Einkaufsteam

Das Einkaufsteam bündelt Bedarfe, standardisiert Produktspezifikationen, verhandelt Konditionen, dokumentiert Vergaben und bearbeitet Eskalationen. Es darf nur die für die Einkaufsleistung erforderlichen Einzelinformationen sehen.

### 4.4 Lieferant

Der Lieferant erhält aggregierte Anfragen, gibt Angebote ab und bestätigt Verfügbarkeit, Liefertermine und Bedingungen. Nach der Vergabe erhält er die individuellen Lieferpositionen und Adressen. Er liefert und fakturiert im Pilot direkt an die Läden.

### 4.5 Steuerberater oder Buchhaltungsexperte

Der Experte prüft Buchungsvorschläge, Kontierung, UStVA-Entwürfe und Abschlussunterlagen. Er erhält ausschließlich Zugriff auf zugewiesene Mandanten und dokumentiert jede Freigabe.

### 4.6 Plattformadministration und Support

Die Administration verwaltet Läden, Lieferanten, Vorlagen, Integrationen und Supportfälle. Produktivdatenzugriffe sind rollenbegrenzt, protokolliert und nur bei berechtigtem Anlass zulässig.

### 4.7 Endkunde

Der Endkunde besucht die individuelle Website eines Ladens, sieht Menü und Pflichtinformationen, bestellt zur Abholung und bezahlt online. Ein dauerhaftes Kundenkonto ist für den Pilot nicht erforderlich.

## 5. Nutzenversprechen

Das primäre Nutzenversprechen lautet:

> Kebapp bündelt den Bedarf unabhängiger Dönerläden, verhandelt bessere Konditionen und weist jedem Betrieb seine tatsächliche Ersparnis nach. Gleichzeitig automatisiert es die wichtigsten Verwaltungsaufgaben des Ladens.

Die Differenzierung ist nicht der digitale Warenkorb. Choco, ChefsList und andere Anbieter digitalisieren bereits Lieferantenbestellungen. Döner Pro aus Duisburg bietet sogar ein geschlossenes Bestellportal für Dönerproduzenten und ihre Kunden. Kebapp ist dagegen käufergeführt, bündelt Mengen über mehrere unabhängige Läden, kann mehrere Lieferanten vergleichen und verbindet Einkaufsergebnis, Lieferung, Bestand, Rechnung, Kalkulation und Buchhaltung. Quellen: [Choco](https://choco.com/de/gastronomen), [ChefsList](https://www.chefslist.de/restaurants), [Döner Pro](https://donerpro.de/), [HOGAST Deutschland](https://www.hogast.com/deutschland.html).

## 6. Produktumfang

### 6.1 Gruppeneinkauf

Der Einkauf ist das Kernmodul und enthält:

- Bedarf nach Produkt, Spezifikation, Einheit, Menge und Liefertermin
- wiederkehrende Bestellvorlagen
- Bestellschluss, Erinnerungen und verspätete Änderungen
- regionale Mengenbündelung
- Angebotsanfragen an freigegebene Lieferanten
- Vergleich von Preis, Qualität, Ausbeute, Logistik und Zahlungsziel
- dokumentierte Verhandlungs- und Vergabeentscheidung
- individuelle Bestellbestätigung pro Laden
- direkter Liefer- und Rechnungsprozess zwischen Lieferant und Laden
- Wareneingang, Fehlmenge, Temperaturabweichung und Reklamation
- Referenzpreis und nachvollziehbare Ersparnisberechnung
- Rückvergütung und Provisionsabrechnung

Andere Mitglieder sehen weder Einzelmengen noch individuelle Preise oder Umsätze. Die Oberfläche darf nicht zur Abstimmung von Verkaufspreisen oder zum Austausch sensibler Wettbewerbsdaten verwendet werden.

### 6.2 Produktspezifikation für Fleisch

Ein Preisvergleich ist nur bei vergleichbarer Ware zulässig. Jede relevante Ausschreibungsposition enthält deshalb:

- Fleischart und genaue Zusammensetzung
- Hackfleisch- beziehungsweise Scheibenanteil
- Spießgröße, Nenngewicht und Abrechnung nach Ist-Gewicht
- Herkunft, Produzent und Zertifikate
- Halal-Nachweis
- Zutaten, Allergene und Zusatzstoffe
- gekühlt oder tiefgekühlt
- Mindesthaltbarkeit und Lagerbedingungen
- Lieferfenster und Mindestbestellmenge
- zulässige Ersatzprodukte
- Reklamations- und Gutschriftenregeln
- Zahlungsziel und Skonto

Die Kennzahl „Ersparnis“ vergleicht nur freigegebene, gleichwertige Spezifikationen und berücksichtigt Gebühren, Rückvergütungen und nachweisbare Qualitäts- oder Gewichtsabweichungen.

### 6.3 Warenwirtschaft und Kalkulation

- Lagerbestände für Fleisch, Brot, Gemüse, Soßen, Getränke und Verpackungen
- Übernahme des Wareneingangs aus Bestellungen
- Verbrauch, Inventur, Verderb und Abweichungen
- Rezepte, Portionen und Wareneinsatz
- Deckungsbeitrag pro Artikel und Menü
- Preisänderungswarnungen
- Bestellvorschläge aus Absatz, Wochentag, Wetter und aktuellem Bestand

Ein KI-Vorschlag wird nie selbstständig bestellt. Der Betreiber bestätigt Menge und Termin.

### 6.4 Buchhaltungs- und Steuerarbeitsplatz

- zentrale Beleg- und E-Rechnungs-Inbox
- Verarbeitung von XRechnung und ZUGFeRD
- OCR für Bilder und sonstige Rechnungen
- Lieferanten-, Steuer- und Kontierungsvorschläge
- Abgleich von Bestellung, Lieferschein, Rechnung und Zahlung
- Import von Kassen- und Bankdaten
- Einnahmen, Ausgaben und offene Posten
- Entwürfe für UStVA, BWA und Abschlussunterlagen
- DATEV-kompatibler Export
- geschützter Expertenzugang
- Prüfstatus „KI-Vorschlag“, „intern geprüft“ und „fachlich freigegeben“

Seit 1. Januar 2025 müssen inländische Unternehmen E-Rechnungen empfangen können; Übergangsregeln für die Ausstellung laufen gestaffelt aus. Ein einfaches PDF ist keine strukturierte E-Rechnung. Quelle: [BMF: Fragen und Antworten zur E-Rechnung](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html).

Kebapp ist kein autonomer Steuerberater. Steuererklärungen, UStVA und Jahresabschluss werden nicht ohne fachliche Prüfung übermittelt.

### 6.5 Personal

- Mitarbeiterakte und Dokumentenablage
- Dienstplan
- Ein- und Ausstempeln per Mobilgerät oder Laden-Tablet
- Pausen, Urlaub, Krankheit und Überstunden
- vorbereiteter Export für Lohnbüro oder Steuerberater
- Erinnerungen an Dokumente und Unterweisungen

Beginn, Ende und Dauer der täglichen Arbeitszeit müssen aufgezeichnet werden. Für Gaststätten gelten zusätzliche Dokumentationspflichten nach dem Mindestlohngesetz. Quelle: [BMAS zur Arbeitszeiterfassung](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Arbeitnehmerrechte/Regelungen-zur-Arbeitszeit/Fragen-und-Antworten/faq-arbeitszeiterfassung.html), [BMAS zur Dokumentationspflicht](https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/Dokumentationspflicht/dokumentationspflicht-art.html).

### 6.6 Hygiene und Lebensmittel-Compliance

- HACCP-Checklisten
- Kühl-, Lager- und Wareneingangstemperaturen
- Reinigungs- und Schädlingskontrollpläne
- Chargen- und Lieferantenrückverfolgung
- Allergene und Zusatzstoffe aus zentralen Rezepturen
- Abweichungsmaßnahmen und Verantwortlichkeiten
- Kontrollordner als PDF-Export

Der Lebensmittelunternehmer bleibt für Sicherheit, Eigenkontrollen, kritische Kontrollpunkte und Rückverfolgbarkeit verantwortlich. Kebapp dokumentiert und erinnert, übernimmt aber nicht die rechtliche Verantwortung. Quelle: [BVL zu Pflichten von Lebensmittelunternehmen](https://www.bvl.bund.de/SharedDocs/FAQ/DE/02_Unternehmer/01_Lebensmittel/11_FAQ_Gesetze_Pflichten_fuer_LM-Unternehmen/04_FAQ_Pflichten_Lebensmittelunternehmen.html).

### 6.7 Kostenlose Website

Jeder aktiv teilnehmende Betrieb erhält:

- ein mobiloptimiertes Standardtemplate
- Logo, definierte Farbvariablen, Bilder und Texte
- Öffnungszeiten, Kontakt, Karte und Impressum
- synchronisierte Speisekarte
- Allergene und Zusatzstoffe
- Abholung und Vorbestellung
- Onlinezahlung
- automatische Bestellbestätigung
- eine normale `.de`-Domain
- Hosting und SSL

Nicht im kostenlosen Template enthalten sind freie Individualgestaltung, mehrere Webseitenkonzepte, eigener Lieferdienst oder unbegrenzte Änderungsleistungen. Premium-Domains und Sonderentwicklungen zahlt der Laden zusätzlich.

Die Domain wird auf den Laden als Inhaber registriert. Kebapp ist technischer Verwalter. Bei Austritt kann die Domain übertragen werden. Hosting und Betrieb werden danach kostenpflichtig fortgesetzt oder nach vereinbarter Frist beendet.

### 6.8 Betreiber- und KI-Dashboard

Die Startseite zeigt:

- heutigen Umsatz und Bestellungen
- anstehende Aufgaben und Kontrollen
- Personalbesetzung
- Lager- und Lieferwarnungen
- offene oder auffällige Rechnungen
- nächste Sammelbestellung
- Einkaufspreisentwicklung und Ersparnis
- konkrete KI-Vorschläge mit Begründung und Freigabe

Der bevorzugte Bediengrundsatz lautet „Entscheidungen zuerst“. Große Aktionen, kurze Texte und eine optionale deutsch-türkische Oberfläche unterstützen den Einsatz im laufenden Ladenbetrieb.

## 7. Gemeinsamer Datenkern

Alle Module verwenden dieselben Stammdaten. Dadurch aktualisiert eine freigegebene Änderung an Produkt, Rezeptur oder Preis auch Lager, Kalkulation, Allergene, Website, Einkauf und Buchhaltung.

Zentrale Datenobjekte sind:

- Organisation, Standort, Benutzer und Rolle
- Mitarbeiter, Schicht und Zeiteintrag
- Produkt, Spezifikation, Lieferant und Kondition
- Rezept, Menüartikel, Allergen und Zusatzstoff
- Lagerbewegung, Inventur und Verderb
- Bedarf, Sammelrunde, Angebot und Vergabe
- Bestellung, Lieferung, Charge, Reklamation und Gutschrift
- Beleg, Rechnung, Zahlung, Buchungsvorschlag und Expertenfreigabe
- Website, Domain, Theme, Seite und Endkundenbestellung
- Hygieneplan, Kontrolle, Messwert und Abweichungsmaßnahme
- Benachrichtigung, Audit-Ereignis und KI-Vorschlag

## 8. Kernabläufe

### 8.1 Vom Verkauf zur Sammelbestellung

1. Kassen- und Websiteverkäufe fließen in Kebapp ein.
2. Das System berechnet Bestand, Verbrauch und Prognose.
3. Der Laden prüft und bestätigt seinen Bedarf.
4. Kebapp bündelt die regionale Gesamtmenge.
5. Das Einkaufsteam vergleicht und verhandelt Angebote.
6. Der Laden erhält seine Kondition und bestätigt die Einzelbestellung.
7. Der Lieferant liefert und fakturiert direkt.
8. Der Laden prüft Menge, Temperatur und Qualität.
9. Bestand, Rechnung, Ersparnis und Buchhaltung werden aktualisiert.

### 8.2 Laden-Onboarding und Website

1. Kebapp legt Organisation, Standort und Rollen an.
2. Der Laden erfasst Unternehmens- und Inhaberdaten.
3. Logo, Farben, Bilder, Öffnungszeiten und Menü werden eingerichtet.
4. Die Wunschdomain wird bei INWX geprüft.
5. Der Laden akzeptiert Domainbedingungen und bestätigt die Inhaberdaten.
6. INWX registriert die `.de`-Domain und setzt DNS-Einträge.
7. Hetzner ordnet den Hostnamen dem richtigen Mandanten zu.
8. Let’s Encrypt stellt das Zertifikat aus.
9. Der Laden prüft eine Vorschau und veröffentlicht.
10. Bis zur Domainaktivierung bleibt eine Plattform-Subdomain erreichbar.

Bei vorgeschriebener Verifikation der `.de`-Inhaberdaten muss der Domaininhaber die Verifikationsnachricht selbst bestätigen. Kebapp zeigt den Status und sendet Erinnerungen, kann diesen Schritt aber nicht rechtmäßig überspringen.

### 8.3 Endkundenbestellung und Zahlung

1. Der Kunde wählt einen Laden und legt Artikel in den Warenkorb.
2. Kebapp prüft Öffnungszeiten, Abholfenster und Verfügbarkeit.
3. Der Kunde bezahlt im Checkout der Plattform.
4. Der Laden nimmt die Bestellung an oder sie läuft nach definierter Frist kontrolliert aus.
5. Der Kunde erhält Status und Abholzeit.
6. Nach Abholung werden Umsatz, Bestand und Buchhaltung aktualisiert.

## 9. Zahlungsarchitektur

Für Endkundenbestellungen wird Stripe Connect mit Accounts v2 vorgesehen:

- Dashboard für Läden: Express
- Gebührenverwaltung: Kebapp
- Haftung für negative Kontostände: Kebapp
- Charge Pattern: Destination Charges
- Onboarding: eingebettete Connect-Komponenten
- Risikomanagement: Stripe Radar mit Standardregeln
- Plattformmarge: fünf Prozent
- zusätzliche Berücksichtigung der geschätzten Stripe-Zahlungsgebühren
- `applicationFeeIncludes = stripe_fee_estimate`

Jeder Laden erhält eine Empfänger-Konfiguration mit aktivierten Überweisungen. Die Zahlung liegt auf dem Plattformkonto und der Ladenanteil wird automatisch übertragen. Kebapp ist für Erstattungen, Zahlungsstreitfälle, Transfer-Rückholungen und nicht gedeckte negative Ladenkonten verantwortlich.

Der Express-Bereich zeigt Läden Umsätze und Auszahlungen. Wegen eingeschränkter Konflikt- und Erstattungsfunktionen bei Destination Charges benötigt Kebapp eigene Support- und Bearbeitungsprozesse.

Die fünfprozentige Plattformmarge wird nicht als ausreichend zur Deckung der Zahlungsgebühren unterstellt. Der Abzug enthält deshalb zusätzlich eine geschätzte Zahlungsgebühr. Tatsächliche Kosten unterscheiden sich nach Zahlungsmethode und Vertrag; die Plattform überwacht ihre Marge anhand der Stripe-Berichte. Quellen: [Stripe Connect: Destination Charges](https://docs.stripe.com/connect/destination-charges), [Stripe-Preise](https://stripe.com/de/pricing), [Stripe-Margenberichte](https://docs.stripe.com/connect/margin-reports).

Diese Zahlungsarchitektur gilt nur für Endkundenbestellungen auf Laden-Websites. B2B-Lieferantenrechnungen werden im Pilot nicht über Stripe Connect vermittelt.

## 10. Technische Architektur

### 10.1 Architekturprinzip

Kebapp startet als modularer Monolith. Das System wird als eine überschaubare Plattform betrieben, trennt die Fachbereiche jedoch durch klare Module und Schnittstellen. Microservices sind für den Pilot nicht erforderlich.

Komponenten:

- Next.js-Web-App und PWA für Betreiber und Partner
- Next.js-Ausgabe der öffentlichen Laden-Websites
- TypeScript-Backend mit klaren Fachmodulen
- PostgreSQL als zentrale transaktionale Datenbank
- Objektspeicher für Rechnungen, Bilder und Exporte
- Hintergrundaufträge für E-Mail, OCR, Domains und Integrationen
- Integrationsadapter für POS, Bank, DATEV, E-Rechnung, Stripe und INWX
- getrennte KI-Schicht für Extraktion, Prognose und Empfehlungen

Next.js eignet sich für dynamische Full-Stack-Webanwendungen. Für native Android- und iOS-Apps wird später Expo/React Native verwendet. Geteilt werden API-Client, Typen, Validierungen und Geschäftsregeln, nicht zwangsläufig jede Benutzeroberfläche. Quellen: [Next.js-Dokumentation](https://nextjs.org/docs), [Expo-Dokumentation](https://docs.expo.dev/).

### 10.2 Hetzner-Aufbau

Produktivsysteme werden ausschließlich an einem deutschen Hetzner-Standort betrieben, bevorzugt Nürnberg oder Falkenstein.

Pilot-Topologie:

- Anwendungsknoten für Web-App, Websites, API und Hintergrundaufträge
- getrennter Datenbankknoten für PostgreSQL
- Objektspeicher für Dokumente und Bilder
- verschlüsselter, räumlich getrennter Backup-Speicher
- Reverse Proxy für Routing, TLS und Schutzregeln
- getrennte Test- und Produktionsumgebung

Alle Ladendomains können dieselbe Website-Anwendung verwenden. Der Hostname bestimmt den Mandanten; Logo, Farben, Menü und Inhalte kommen aus der Datenbank. Dadurch benötigen Läden keine getrennten Softwareinstallationen und erhalten Aktualisierungen gleichzeitig.

Vor dem Pilot werden Wiederherstellung und Serverausfall praktisch getestet. Nach dem Pilot kann ein zweiter Anwendungsknoten hinter einem Load Balancer hinzukommen.

Hetzner stellt einen AV-Vertrag nach Art. 28 DSGVO und dokumentierte technische und organisatorische Maßnahmen bereit. Bei Wahl eines deutschen Standorts bleiben Serverdaten innerhalb der EU. Quellen: [Hetzner zum Datenschutz](https://docs.hetzner.com/de/general/company-and-policy/data-protection-at-hetzner/), [Hetzner TOMs](https://docs.hetzner.com/general/security-and-identify/technical-and-organizational-measures/).

### 10.3 Domains und SSL

INWX wird Domain-Reseller und DNS-Anbieter. Es unterstützt `.de`, Echtzeitregistrierung sowie Domain- und DNS-Funktionen per API. Domaininhaber ist der Laden; Kebapp verwaltet technische Kontakte und DNS im Auftrag. Quelle: [INWX API](https://www.inwx.com/de/offer/api), [INWX Domainvertrag](https://www.inwx.com/de/aboutus/termsdomains).

SSL-Zertifikate werden mit Let’s Encrypt automatisiert. Caddy oder Traefik übernimmt SNI-Routing, Ausstellung und Erneuerung. Für DNS-Prüfungen kann die INWX-API verwendet werden.

Status der Domainbereitstellung:

1. Wunsch erfasst
2. Verfügbarkeit geprüft
3. Inhaberdaten bestätigt
4. Registrierung beauftragt
5. Registrierung aktiv
6. DNS aktiv
7. Zertifikat aktiv
8. Website veröffentlicht

Fehler führen nicht zu einem unklaren Zwischenzustand. Ist eine Domain belegt oder kostenpflichtig premium, muss der Betreiber eine Alternative bestätigen. Bei ausstehender Registrierung bleibt die Plattform-Subdomain aktiv.

## 11. Mandantentrennung, Sicherheit und Datenschutz

### 11.1 Mandantentrennung

- Jeder Laden ist ein eigener Mandant.
- Jede fachliche Tabelle und jeder Dateipfad trägt eine Mandantenkennung.
- Zugriffsrechte werden serverseitig geprüft, nicht nur in der Oberfläche.
- Lieferanten sehen zunächst nur aggregierte Anfragen.
- Steuerberater sehen ausschließlich zugewiesene Mandanten.
- Supportzugriffe benötigen einen Anlass und werden protokolliert.
- Automatisierte Tests versuchen gezielt, fremde Mandantendaten abzurufen.

### 11.2 Sicherheitsmaßnahmen

- Verschlüsselung während Übertragung und Speicherung
- Mehrfaktor-Authentifizierung für Administration und Experten
- rollenbasierte Minimalrechte
- zentrale Geheimnisverwaltung und regelmäßige Schlüsselrotation
- signierte und gegen Wiederholung geschützte Webhooks
- unveränderbares Audit-Protokoll für kritische Vorgänge
- getrennte Entwicklungs-, Test- und Produktionsdaten
- automatisierte Sicherheitsupdates mit kontrolliertem Rollout
- Überwachung von Fehlern, Verfügbarkeit und verdächtigen Zugriffen
- verschlüsselte Backups und regelmäßige Wiederherstellungstests
- dokumentierter Sicherheitsvorfall- und Meldeprozess

### 11.3 DSGVO-Rollen und Pflichten

Der Serverstandort allein erzeugt keine DSGVO-Konformität. Vor dem Pilot werden Verantwortlichkeiten je Datenfluss dokumentiert:

- Kebapp kann für Einkaufsnetzwerk, Plattformzahlungen und eigene Analysen selbst Verantwortlicher sein.
- Bei reiner Verarbeitung von Mitarbeiter-, Buchhaltungs- oder Endkundendaten im Auftrag eines Ladens kann Kebapp Auftragsverarbeiter sein.
- Hetzner ist für gehostete Daten Auftragsverarbeiter von Kebapp.
- Stripe, INWX, E-Mail-, Banking-, POS- und KI-Anbieter werden je Leistung als Auftragsverarbeiter oder eigenständige Verantwortliche eingeordnet.

Erforderlich sind:

- AV-Verträge und Unterauftragnehmerverzeichnis
- Datenschutzinformationen für Läden, Mitarbeiter und Endkunden
- Zweck, Rechtsgrundlage und Speicherfrist je Datenkategorie
- Datenminimierung und Löschkonzept
- Export, Berichtigung und Löschung für Betroffenenanfragen
- dokumentierte Berechtigung für Steuerberater- und Supportzugriffe
- Datenschutz-Folgenabschätzung, wenn die abschließende Prüfung ein hohes Risiko feststellt
- keine Verwendung von Kundendaten zum KI-Training ohne ausdrückliche Vereinbarung

Domaininhaberdaten müssen für die Registrierung an INWX und DENIC übermittelt werden. Dies wird im Onboarding transparent erklärt und auf die erforderlichen Daten begrenzt.

## 12. Zustands- und Fehlerbehandlung

Kritische Prozesse verwenden explizite Zustände und können wiederholt ausgeführte Nachrichten sicher verarbeiten:

- Bedarf: Entwurf → bestätigt → gebündelt → vergeben → bestellt
- Lieferung: angekündigt → geliefert → geprüft → reklamiert
- Rechnung: eingelesen → abgeglichen → auffällig → freigegeben
- Website-Bestellung: erstellt → bezahlt → angenommen → bereit → abgeholt
- Domain: geprüft → registriert → DNS aktiv → SSL aktiv → veröffentlicht
- Buchung: KI-Vorschlag → intern geprüft → fachlich freigegeben

Regeln:

- Doppelte Webhooks oder Klicks erzeugen keine Doppelbestellung oder Doppelzahlung.
- Fehlgeschlagene Hintergrundaufträge werden mit begrenzter Anzahl wiederholt und anschließend sichtbar eskaliert.
- Niedrige KI-Sicherheit führt zu manueller Prüfung statt zu einer automatischen Aktion.
- Ausfall eines KI-Dienstes blockiert keine Bestellung, Zeiterfassung oder Hygienekontrolle.
- Zeiterfassung und ausgewählte Hygieneformulare können kurzzeitig offline erfasst und später synchronisiert werden.
- Nicht angenommene Endkundenbestellungen werden automatisch storniert oder erstattet.
- Lieferantenänderungen nach Bestellschluss benötigen eine neue Ladenbestätigung, wenn Preis, Spezifikation oder Menge betroffen sind.

## 13. Geschäftsmodell

### 13.1 Kostenloses Basispaket

Bei aktiver Einkaufsteilnahme sind enthalten:

- Standard-Website
- eine normale `.de`-Domain
- Hosting und SSL
- Basis-Betriebssystem
- Teilnahme am Gruppeneinkauf

„Aktiv“ wird vertraglich über eine nachvollziehbare Mindestaktivität definiert. Es wird keine unbegrenzte kostenlose Individualentwicklung versprochen.

### 13.2 Einnahmen

- transparente Lieferantenprovision beziehungsweise Rückvergütung
- fünf Prozent Plattformmarge auf Endkunden-Onlinebestellungen
- zusätzlich berücksichtigte Zahlungsabwicklungskosten
- Premium-Module und Supportpakete
- später mögliche Handelsmarge beim zentralen Eigenkauf

Lieferantenprovisionen dürfen Produktrangfolge und Vergabe nicht intransparent beeinflussen. Die Plattform trennt fachliche Bewertung, Preisvergleich und Provision sichtbar.

### 13.3 Wirtschaftlichkeitsrechnung

Die Pilotrechnung wird je aktivem Laden geführt:

**Erlöse**

- Einkaufspartner- und Rückvergütungserlöse
- Marge aus Onlinebestellungen
- Premiumerlöse

**direkte Kosten**

- Domain und DNS
- anteiliges Hosting, Speicher und Backup
- Zahlungs- und Rückbuchungskosten
- E-Mail, OCR, KI und sonstige API-Nutzung
- Onboarding- und Supportzeit
- Einkaufs- und Reklamationsaufwand

Die Plattform skaliert erst in eine weitere Region, wenn der erwartete Deckungsbeitrag die laufende Betreuung und Infrastruktur trägt.

## 14. Kartell-, Lebensmittel-, Steuer- und Zahlungsrecht

Bestimmte Kooperationen kleiner und mittlerer Unternehmen können als Mittelstandskooperation zulässig sein, wenn sie deren Wettbewerbsfähigkeit verbessern. Einkaufsgemeinschaften können dennoch wettbewerbsbeschränkend wirken. Vor Vertragsstart prüft eine spezialisierte Kanzlei insbesondere Informationsaustausch, Marktanteile, Exklusivität, Lieferantenvergabe und Provisionsmodell. Quelle: [Bundeskartellamt zur Kartellverfolgung](https://www.bundeskartellamt.de/DE/Aufgaben/Kartelle/Kartellverfolgung/Kartellverfolgung.html), [Bundeskartellamt zu Einkaufskooperationen](https://www.bundeskartellamt.de/SharedDocs/Meldung/DE/Pressemitteilungen/2022/20_01_2022_Begros_KHG.html).

Verboten beziehungsweise nicht vorgesehen sind:

- Abstimmung der Verkaufspreise der Läden
- Teilen individueller Absatz-, Kunden- oder Margendaten zwischen Wettbewerbern
- intransparente Bevorzugung von Lieferanten aufgrund der Plattformprovision
- autonome Steuerübermittlung ohne Freigabe
- Bezeichnung von KI-Vorschlägen als fachlich geprüfte Beratung

Da Kebapp bei Onlinebestellungen der Geschäftspartner des Endkunden ist, prüft ein Fachanwalt vor dem Pilot AGB, Widerrufs- und Stornierungsregeln, Zahlungsstreitfälle, Leistungsbeschreibung, Haftung und Plattform-/Ladenbeziehung. Ein Steuerberater bestätigt die umsatzsteuerliche Behandlung von Plattformgebühr, Zahlungsabzug und Auszahlungen.

## 15. Pilot in Mönchengladbach und Umgebung

### 15.1 Zielgruppe

- fünf bis zehn unabhängige Dönerläden
- ein Hauptlieferant und ein Ersatzlieferant
- ein Steuerberater oder Buchhaltungsexperte
- zwei bis drei unterschiedliche Kassensysteme
- Lieferradius ungefähr 30 bis 50 Kilometer

Mögliche Pilotorte sind Mönchengladbach, Rheydt, Viersen, Krefeld, Neuss und der westliche Raum Düsseldorf. Entscheidend ist die wirtschaftliche Lieferroute, nicht die Verwaltungsgrenze.

### 15.2 Datengrundlage

Vor der ersten Verhandlung werden je Laden vier bis acht Wochen anonymisierte beziehungsweise zweckgebundene Daten erhoben:

- Einkaufsrechnungen
- Wochenmengen und Lieferintervalle
- Produktspezifikationen und Spießgrößen
- Zahlungsziele und Skonto
- Fehlmengen, Reklamationen und Gutschriften
- Kassen- und Buchhaltungsprozess
- Zeitaufwand für Einkauf und Verwaltung

Diese Daten definieren den Referenzpreis, Qualitätsvergleich und Ausgangswert für Zeitersparnis.

### 15.3 Phasen

1. **Operative Validierung:** Läden besuchen, Rechnungen analysieren und erste gebündelte Bestellungen betreut durchführen.
2. **Technischer Kern:** Mandanten, Rollen, Einkauf, Website, Domains und Zahlungen.
3. **Betriebsmodule:** Lager, Hygiene, Personal und Finanzvorbereitung.
4. **Geschlossene Alpha:** drei Läden mit echten Daten und enger Begleitung.
5. **Pilotbetrieb:** fünf bis zehn Läden und mindestens zwei Lieferanten.
6. **Auswertung:** Ersparnis, Nutzung, Lieferqualität, Supportaufwand und Deckungsbeitrag.
7. **NRW-Ausbau:** neue Gruppen entlang wirtschaftlicher Lieferrouten.

Die operative Einkaufsvalidierung startet vor Fertigstellung aller Module. Der vollständige Softwarepilot folgt erst nach bestandener Alpha. Abhängig von Teamgröße, Integrationen und externen Prüfungen ist dies ein Vorhaben von mehreren Monaten, nicht wenigen Wochen.

## 16. Erfolgskriterien

Der Pilot wird fortgesetzt, wenn alle folgenden Kernkriterien erreicht werden:

- mindestens fünf Läden bestellen regelmäßig
- mindestens 80 Prozent der erwarteten Bedarfe werden digital und rechtzeitig bestätigt
- vergleichbare Waren werden netto fünf bis zehn Prozent günstiger
- mindestens 95 Prozent der bestätigten Mengen werden korrekt geliefert
- Lieferqualität und Reklamationsquote verschlechtern sich nicht
- die ausgewiesene Ersparnis ist anhand von Rechnung und Spezifikation nachprüfbar
- eine Standard-Website steht nach vollständigen Daten innerhalb von 30 Minuten bereit oder erhält automatisch eine temporäre Subdomain
- keine kritische Mandanten-, Zahlungs- oder Datenschutzverletzung bleibt unentdeckt
- Buchhaltungs- und KI-Ergebnisse tragen immer einen eindeutigen Prüfstatus
- die direkten Plattformkosten je aktivem Laden können mit den zugeordneten Erlösen gedeckt werden

Zusätzliche Kennzahlen:

- aktive Läden pro Bestellrunde
- bestätigte Menge und Bündelungsquote
- Lieferanten-Antwort- und Erfüllungsquote
- Preisabweichung zwischen Angebot und Rechnung
- Reklamationszeit und Gutschriftenquote
- Zeitaufwand für Bestellung und Rechnung
- Website-Bestellungen und Abholabschlussquote
- Belegautomatisierung und manuelle Korrekturquote
- Hygiene- und Zeiterfassungs-Vollständigkeit
- Supportminuten pro Laden

## 17. Teststrategie

### 17.1 Fachliche Tests

- Mengenbündelung, Preisstaffeln, Rundung und Ersparnis
- Gebühren, Rückvergütungen und Zahlungsabzüge
- Rezept-, Lager- und Kalkulationsregeln
- Arbeitszeit- und Hygienedokumentation
- E-Rechnung, Kontierung und DATEV-Export

### 17.2 Integrations- und End-to-End-Tests

- Bedarf bis Lieferung und Rechnung
- Domainprüfung, Registrierung, DNS, SSL und Transfer
- Stripe-Onboarding, Zahlung, Erstattung, Streitfall und Transfer-Rückholung
- POS-, Bank- und E-Rechnungsimporte
- Website-Menü bis Abholung
- Expertenprüfung und Freigabe

### 17.3 Sicherheits- und Zuverlässigkeitstests

- Mandantentrennung und Rollenrechte
- Webhook-Signaturen und Wiederholungsschutz
- Lasttest zum Bestellschluss
- Offline-Erfassung und Konfliktsynchronisation
- Ausfall von Lieferanten-, Domain-, Zahlungs- und KI-Schnittstellen
- Wiederherstellung aus Backup
- Geheimnisrotation und Admin-MFA

### 17.4 Praxistests

Die Alpha wird in echten Läden auf günstigen Android-Geräten, Laden-Tablets und Desktopbrowsern getestet. Beobachtet werden Aufgabenverständnis, Klickwege, Fehler, Sprachbedarf und Zeit im laufenden Betrieb.

## 18. Hauptrisiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Zu wenig gebündeltes Volumen | Anchor-Läden gewinnen, wenige Kernprodukte starten, Regionen nach Lieferrouten bilden |
| Abhängigkeit von einem Lieferanten | Haupt- und Ersatzlieferant, dokumentierte Ausschreibung, keine unkündbare Exklusivität |
| Schlechtere Qualität trotz niedrigerem Preis | verbindliche Spezifikation, Wareneingang, Ausbeute und Reklamationsquote messen |
| Nutzung bleibt bei WhatsApp | Vorlagen, Erinnerungen, extrem kurze Bestätigung und persönliche Einführung |
| Kostenlose Websites verursachen Individualaufwand | ein Template, definierte Variablen, klare Premiumgrenze |
| POS-Landschaft ist uneinheitlich | zunächst CSV/DSFinV-K und priorisierte Adapter, keine eigene Kasse |
| Fehlerhafte KI-Buchungen | Entwurfsstatus, Konfidenz, Belegbezug und Expertenfreigabe |
| Zahlungsstreitfälle belasten Kebapp | Radar, Reserve, Supportprozess, Transfer-Rückholung und klare Ladenverträge |
| Hetzner ist unmanaged | automatisierte Updates, Monitoring, Backups, Runbooks und benannte Betriebsverantwortung |
| Datenschutzverletzung zwischen Mandanten | serverseitige Autorisierung, Datenbankregeln, Isolationstests und Audit-Alarm |
| Kartellrechtlich problematischer Datenaustausch | aggregierte Lieferantenanfragen, keine Konkurrenzdatenansicht, juristische Prüfung |
| Domain wird faktisch Plattformbesitz | Laden als Inhaber, dokumentierter Transfer- und Austrittsprozess |

## 19. Bewusste Nicht-Ziele des Piloten

Der Pilot enthält ausdrücklich nicht:

- eigenes TSE-Kassensystem
- autonom übermittelte Steuererklärungen oder UStVA
- vollständige eigene Lohnabrechnung
- eigener Endkunden-Lieferdienst und Fahrersteuerung
- freier Website-Builder mit beliebigen Layouts
- zentraler Fleisch-Eigenhandel durch Kebapp
- NRW-weite Einführung vor bestandener regionaler Validierung
- Austausch von Verkaufspreisen oder individuellen Wettbewerbsdaten zwischen Läden

## 20. Startvoraussetzungen

Vor dem ersten echten Pilotauftrag müssen vorliegen:

1. fünf unterschriebene Pilotvereinbarungen mit Läden
2. vollständige Produktspezifikation für die ersten Kernpositionen
3. mindestens zwei grundsätzlich geeignete Lieferanten
4. kartellrechtlich geprüfte Kooperations- und Datenregeln
5. geprüfte Plattform-, Laden-, Endkunden- und Lieferantenverträge
6. bestätigtes Steuer- und Zahlungsmodell
7. AV-Verträge, Datenschutzinformationen und Löschkonzept
8. Hetzner-Produktivumgebung an deutschem Standort
9. INWX-Resellerkonto und getestete `.de`-Domainprozesse
10. Stripe-Test- und Produktivfreigabe mit dokumentierten Konfliktprozessen
11. benannte fachliche Prüfer für Buchhaltung und Steuern
12. getestete Backup-Wiederherstellung und Sicherheitsalarmierung

## 21. Empfohlener nächster Schritt

Nach Freigabe dieses Dokuments folgt ein eigenständiger Implementierungsplan. Er zerlegt die Plattform in lieferbare Pakete, Abhängigkeiten, Datenmodelle, Schnittstellen, Tests und Abnahmekriterien. Parallel beginnt die operative Pilotgewinnung, da Rechnungen, Mengen, Produktspezifikationen und echte Abläufe für die korrekte Softwareausgestaltung benötigt werden.
