# Kebapp: Lokale Authentifizierung, Mandanten und PostgreSQL

**Stand:** 21. August 2026<br>
**Status:** Fachlich abgestimmter Entwurf zur schriftlichen Freigabe<br>
**Geltungsbereich:** Lokale Entwicklungsumgebung und Grundlage für den späteren Pilotbetrieb<br>
**Technischer Weg:** Better Auth, Drizzle ORM, PostgreSQL und eine Podman-/Docker-kompatible Compose-Umgebung

## 1. Ziel

Die bestehende Kebapp-Demo erhält eine echte, lokal betreibbare Grundlage für:

- E-Mail-/Passwort-Anmeldung
- E-Mail-Verifizierung und Passwort-Zurücksetzen
- öffentliche Registrierungsanträge mit manueller Freigabe
- Einladungen für Ladeninhaber und Mitarbeiter
- Plattformrollen für Administration und Support
- konsequente Trennung der Daten verschiedener Dönerläden
- persistente Einkaufs-, Profil- und Website-Daten in PostgreSQL
- kontrollierte lokale Demodaten

Diese Ausbaustufe ersetzt die bisherige Browser-Speicherung schrittweise durch eine echte Datenbank. Sie bleibt zunächst vollständig lokal. Hetzner, INWX, produktiver E-Mail-Versand, Domains und SSL werden noch nicht angebunden, die Architektur wird aber so vorbereitet, dass diese Dienste später ergänzt werden können.

Onlinebestellungen und Zahlungen von Endkunden bleiben ausdrücklich außerhalb dieses Umfangs. Die öffentliche Ladenwebsite ist weiterhin eine reine Informationsseite.

## 2. Bestätigte Entscheidungen

1. Better Auth verwaltet Identitäten, Zugangsdaten, E-Mail-Verifikation, Zurücksetzen von Passwörtern und Sitzungen.
2. Kebapp verwendet nicht das noch junge Organisationsmodell eines Auth-Anbieters, sondern ein eigenes Mandanten-, Mitgliedschafts- und Rollenmodell.
3. Drizzle ORM definiert das Datenbankschema und erzeugt versionierte SQL-Migrationen.
4. PostgreSQL ist bereits lokal die verbindliche Datenbank; SQLite oder eine reine Browserlösung werden nicht vorgeschaltet.
5. PostgreSQL Row-Level Security ergänzt die Anwendungsautorisierung als zweite Schutzschicht.
6. PostgreSQL und Mailpit laufen lokal über eine Compose-Datei, die mit Podman und Docker kompatibel sein soll.
7. Die Next.js-Anwendung läuft für kurze Entwicklungszyklen zunächst direkt auf dem Entwicklungsrechner.
8. Die öffentliche Selbstregistrierung ist möglich, schaltet einen Laden aber nicht automatisch frei.
9. Das System kennt die Rollen Plattform-Admin, Support, Ladeninhaber und Mitarbeiter.
10. Die spätere Produktion soll auf selbst verwalteter Infrastruktur bei Hetzner in Deutschland laufen; dies ist nicht Teil dieser lokalen Implementierungsstufe.

## 3. Abgrenzung der Verantwortlichkeiten

### 3.1 Better Auth

Better Auth ist ausschließlich für technische Authentifizierung zuständig:

- Benutzerkonto und E-Mail-Adresse
- sicher gehashtes Passwort
- E-Mail-Verifizierung
- Sitzungen und Sitzungscookies
- Verifikations- und Passwort-zurücksetzen-Token

Better Auth entscheidet nicht, auf welchen Laden ein Benutzer zugreifen darf. Es verwaltet auch keine Freigabe eines Ladens und keine betrieblichen Rollen.

### 3.2 Kebapp

Kebapp entscheidet serverseitig:

- zu welchen Organisationen ein Benutzer gehört
- welche Rolle er dort besitzt
- ob die Organisation freigegeben, gesperrt oder abgelehnt ist
- ob ein Supportmitarbeiter dem Laden zugewiesen ist
- welche betrieblichen Daten gelesen oder verändert werden dürfen
- ob ein Ladenprofil öffentlich veröffentlicht werden darf

Diese Trennung verhindert, dass das Geschäftsmodell an ein Auth-Plug-in gekoppelt wird.

## 4. Lokale Systemarchitektur

Die lokale Entwicklungsumgebung besteht aus drei Teilen:

| Komponente | Aufgabe | Ausführung |
|---|---|---|
| Next.js-Anwendung | Oberfläche, Serverlogik, Better Auth und Drizzle | direkt auf dem Entwicklungsrechner |
| PostgreSQL | Authentifizierungs- und Kebapp-Daten | Compose-Container |
| Mailpit | lokaler SMTP-Empfang und sichtbare Test-Mailbox | Compose-Container |

Mailpit fängt Verifizierungs-, Einladungs- und Passwort-zurücksetzen-E-Mails ab. Es versendet lokal keine Nachricht an echte Empfänger.

Die Compose-Konfiguration enthält:

- feste, dokumentierte Entwicklungsports
- Healthchecks
- ein benanntes Volume für PostgreSQL
- keine produktiven Zugangsdaten
- keine fest eingebauten persönlichen Daten

Lokale Geheimnisse stehen in einer ignorierten Umgebungsdatei. Eine eingecheckte Beispieldatei beschreibt nur die benötigten Variablennamen und sichere Erzeugung der Werte.

## 5. Datenmodell

### 5.1 Authentifizierungstabellen

Die von Better Auth verwalteten Tabellen enthalten sinngemäß:

- user
- session
- account
- verification

Sie sind global und tragen keine organization_id. Ein Benutzer kann später Mitglied mehrerer Läden sein. Authentifizierungstabellen werden nicht für fachliche Mandantenabfragen verwendet.

### 5.2 Kebapp-Kerntabellen

**user_profiles**

- Verweis auf den Better-Auth-Benutzer
- Anzeigename und optionale Sprache
- globaler Kontostatus
- keine Ladenrolle

**platform_roles**

- Verweis auf einen Benutzer
- Rolle ADMIN oder SUPPORT
- Vergabezeitpunkt und vergebender Administrator

Normale Ladenbenutzer besitzen keinen Eintrag in dieser Tabelle.

**organizations**

- eindeutige ID und technischer Slug
- Laden- und Unternehmensname
- Status PENDING, ACTIVE, SUSPENDED oder REJECTED
- Erstellungs-, Prüf- und Änderungszeitpunkte

**memberships**

- Benutzer und Organisation
- Rolle OWNER oder EMPLOYEE
- Status INVITED, ACTIVE, SUSPENDED oder REMOVED
- eindeutige Kombination aus Benutzer und Organisation

**registration_requests**

- antragstellender Benutzer und Organisation
- eingereichte Laden- und Kontaktdaten
- Status PENDING, APPROVED oder REJECTED
- Prüfnotiz, Prüfer und Prüfzeitpunkt

**invitations**

- Ziel-E-Mail-Adresse
- Organisation und vorgesehene Rolle
- einladender Benutzer
- nur gehashter Token beziehungsweise Verweis auf den Auth-Token
- Ablaufdatum und Status PENDING, ACCEPTED, REVOKED oder EXPIRED

**support_assignments**

- Supportbenutzer und Organisation
- zuweisender Administrator
- optionaler Zweck und Ablaufzeitpunkt
- aktiver oder beendeter Status

**audit_events**

- handelnder Benutzer
- optionale Organisation
- Aktion und betroffener Objekttyp
- Zeitpunkt, Ergebnis und begrenzte Metadaten
- Begründung für sensible Support- oder Adminaktionen

Passwörter, Sitzungstoken, vollständige Beleginhalte und unnötige personenbezogene Daten gehören niemals in Audit-Metadaten.

### 5.3 Erste betriebliche Tabellen

Die vorhandene Demo wird zunächst mit folgenden persistenten Objekten verbunden:

- store_profiles für Ladenprofil, Öffnungszeiten, Kontaktdaten und Websitegestaltung
- buying_rounds für Sammelbestellrunden und Bestellschluss
- demand_items für den Bedarf eines Ladens

Jede dieser Tabellen besitzt zwingend eine organization_id. Weitere betriebliche Tabellen müssen demselben Grundsatz folgen.

Ein Ladenprofil ist öffentlich nur sichtbar, wenn:

1. die Organisation den Status ACTIVE besitzt,
2. das Profil ausdrücklich veröffentlicht wurde und
3. der öffentliche Slug zur Organisation gehört.

## 6. Mandantenkontext und Row-Level Security

### 6.1 Zwei Schutzschichten

Jeder geschützte Zugriff durchläuft:

1. eine zentrale Anwendungsprüfung von Sitzung, Benutzer, Mitgliedschaft, Rolle und Organisationsstatus,
2. eine Datenbankrichtlinie über PostgreSQL Row-Level Security.

Eine ausgeblendete Schaltfläche in der Oberfläche gilt nicht als Berechtigungsschutz.

### 6.2 Datenbankrollen

Es werden mindestens zwei Datenbankrollen getrennt:

- eine Migrationsrolle, die Tabellen und Richtlinien besitzt und verändert,
- eine eingeschränkte Laufzeitrolle für die Anwendung ohne BYPASSRLS und ohne Tabellenbesitz.

Für betriebliche Tabellen wird Row-Level Security erzwungen. Die Laufzeitanwendung darf sich nicht als PostgreSQL-Superuser oder Tabellenbesitzer verbinden.

### 6.3 Transaktionsgebundener Kontext

Für jede fachliche Datenbankoperation:

1. validiert der Server die Better-Auth-Sitzung,
2. bestimmt er die angeforderte Organisation,
3. prüft er Mitgliedschaft oder Supportzuweisung,
4. startet er eine Datenbanktransaktion,
5. setzt er Benutzer- und Organisationskontext mit transaktionslokalen PostgreSQL-Einstellungen,
6. führt er innerhalb derselben Transaktion die Fachabfrage aus.

Die RLS-Richtlinie prüft organization_id gegen den gesetzten Kontext und bestätigt zusätzlich anhand der Datenbanktabellen, dass eine aktive Mitgliedschaft, zulässige Plattformrolle oder aktive Supportzuweisung besteht.

Transaktionslokale Einstellungen verhindern, dass der Mandantenkontext bei wiederverwendeten Pool-Verbindungen auf die nächste Anfrage übergeht.

Eine vom Browser übermittelte Organisations-ID oder ein Slug wählt lediglich einen möglichen Kontext aus. Er ersetzt niemals die serverseitige Berechtigungsprüfung.

### 6.4 Plattformzugriffe

- ADMIN darf Organisationen prüfen, aktivieren, ablehnen und sperren.
- SUPPORT darf nur zugewiesene Organisationen bearbeiten.
- Supportänderungen benötigen eine Begründung und werden protokolliert.
- Support darf keine Passwörter, Sitzungstoken oder fremde Sitzungen einsehen.
- Support darf keine Administratoren ernennen und keine eigenen Berechtigungen erweitern.
- Für globale Verwaltungsabfragen werden eigene, eng begrenzte Serverfunktionen verwendet; es gibt keinen allgemeinen RLS-Bypass.

## 7. Anmelde- und Onboarding-Abläufe

### 7.1 Öffentliche Registrierung

1. Der Betreiber registriert E-Mail-Adresse und Passwort.
2. Kebapp antwortet unabhängig von bestehenden Konten ohne unnötige Kontoauskunft.
3. Der Betreiber bestätigt seine E-Mail über Mailpit.
4. Er erfasst die erforderlichen Grunddaten seines Ladens.
5. Kebapp legt Organisation, Registrierungsantrag und eine noch nicht aktive OWNER-Mitgliedschaft an.
6. Die Organisation bleibt PENDING.
7. Der Betreiber sieht ausschließlich die Antrags- und Statusansicht.
8. Ein ADMIN genehmigt oder lehnt den Antrag mit dokumentierter Entscheidung ab.
9. Bei Genehmigung werden Organisation und OWNER-Mitgliedschaft atomar aktiviert.

Eine Ablehnung löscht das Benutzerkonto nicht automatisch. Löschung und Aufbewahrung richten sich nach dem später festgelegten Datenschutz- und Nachweiskonzept.

### 7.2 Einladung eines Ladeninhabers

1. Ein ADMIN legt einen Laden an oder wählt einen bestehenden Antrag aus.
2. Er versendet eine zeitlich begrenzte OWNER-Einladung.
3. Der Empfänger registriert sich oder meldet sich mit derselben verifizierten E-Mail-Adresse an.
4. Der Token wird einmalig eingelöst.
5. Kebapp aktiviert die Mitgliedschaft nur, wenn Einladung, Konto und Organisation weiterhin zulässig sind.

### 7.3 Einladung eines Mitarbeiters

Ein OWNER einer aktiven Organisation darf EMPLOYEE-Einladungen für den eigenen Laden erstellen und widerrufen. Mitarbeiter dürfen keine weiteren Benutzer einladen.

Ein bereits registrierter Benutzer kann eine Einladung annehmen. Die Annahme ergänzt eine Mitgliedschaft und erzeugt kein zweites Benutzerkonto.

### 7.4 Anmeldung

Nach erfolgreicher Anmeldung:

- Benutzer ohne bestätigte E-Mail gelangen zur Verifizierungsansicht.
- Benutzer mit offenem Ladenantrag gelangen zur Statusansicht.
- Benutzer einer gesperrten Organisation sehen eine Sperrinformation ohne Betriebsdaten.
- Benutzer mit genau einer aktiven Organisation gelangen direkt in deren Bereich.
- Benutzer mit mehreren aktiven Organisationen wählen einen Laden; die Auswahl verleiht keine zusätzlichen Rechte.
- Plattformadministratoren und Support gelangen in einen getrennten Verwaltungsbereich.

### 7.5 Passwort-Zurücksetzen

Der Benutzer fordert per E-Mail einen zeitlich begrenzten Link an. Die Antwort verrät nicht, ob ein Konto existiert. Nach erfolgreicher Passwortänderung werden bestehende Sitzungen widerrufen, soweit Better Auth dies im gewählten Ablauf unterstützt; andernfalls wird dieser Widerruf als ergänzende Kebapp-Logik umgesetzt.

## 8. Rollen und Berechtigungen

| Fähigkeit | ADMIN | SUPPORT | OWNER | EMPLOYEE |
|---|---:|---:|---:|---:|
| Registrierungsanträge prüfen | ja | nein | nein | nein |
| Organisation aktivieren oder sperren | ja | nein | nein | nein |
| Support zuweisen | ja | nein | nein | nein |
| zugewiesenen Laden betreuen | ja | ja | eigener Laden | eigener Laden, begrenzt |
| Ladenprofil und Website pflegen | ja | zugewiesen, protokolliert | ja | nur wenn später explizit freigegeben |
| Bedarfe eintragen | ja | zugewiesen, protokolliert | ja | ja |
| Bedarfe verbindlich bestätigen | ja | nur mit definierter Supportvollmacht | ja | zunächst nein |
| Mitarbeiter einladen oder entfernen | ja | nein | ja | nein |
| Rollen verändern | ja | nein | nur OWNER/EMPLOYEE im eigenen Laden | nein |
| Domains und Sicherheit verwalten | ja | nein | später definierte Inhaberaktionen | nein |
| Passwörter oder Sitzungstoken einsehen | nein | nein | nein | nein |

Die erste Implementierung hält Mitarbeiterrechte bewusst knapp. Zusätzliche Rechte werden später als explizite Fähigkeiten ergänzt, nicht durch immer breitere Rollen.

## 9. Sicherheitsanforderungen

- Mindestlänge für Passwörter: 12 Zeichen
- verpflichtende E-Mail-Verifizierung vor betrieblichen Zugriffen
- HttpOnly- und SameSite-Sitzungscookies
- Secure-Cookies in produktionsähnlichen und produktiven HTTPS-Umgebungen
- Schutz gegen fremde Ursprünge und CSRF über die vorgesehenen Better-Auth-Mechanismen
- Rate-Limits für Anmeldung, Registrierung, Verifizierung und Passwort-Zurücksetzen
- kurze, einmalig verwendbare und widerrufbare Einladungen
- keine Speicherung unverschlüsselter Auth- oder Einladungstoken
- serverseitige Eingabevalidierung
- keine sensiblen Daten in URLs, Logs oder Fehlermeldungen
- Audit-Ereignisse für Freigaben, Sperrungen, Rollenänderungen und Supporteingriffe

Mehrfaktor-Authentifizierung für ADMIN und SUPPORT ist spätestens vor dem ersten produktiven Pilotzugang verpflichtend. Sie muss nicht den lokalen Authentifizierungs-Grundausbau blockieren, wird aber als Produktionsvoraussetzung geführt.

## 10. Fehler- und Zustandsbehandlung

### 10.1 Einheitliche Ergebnisse

- Nicht angemeldet: Weiterleitung zur Anmeldung beziehungsweise HTTP 401 bei einer API.
- Angemeldet, aber nicht berechtigt: generische Ablehnung; fremde Mandantendaten werden nicht bestätigt.
- Organisation PENDING: Statusansicht statt Betriebsbereich.
- Organisation SUSPENDED: Sperransicht statt Betriebsbereich.
- Einladung abgelaufen oder widerrufen: verständliche Ablehnung und Möglichkeit, eine neue Einladung anzufordern.
- Doppelter Registrierungsversuch: keine Preisgabe, ob bereits ein fremdes Konto besteht.
- Datenbank oder E-Mail lokal nicht erreichbar: sichtbarer Entwicklungsfehler mit nächstem Prüfschritt, aber ohne Geheimnisse.

### 10.2 Atomare Änderungen

Folgende Vorgänge laufen jeweils in einer Datenbanktransaktion:

- Genehmigung von Organisation und OWNER-Mitgliedschaft
- Annahme einer Einladung und Aktivierung der Mitgliedschaft
- Sperrung einer Organisation und Erzeugung des Audit-Ereignisses
- Rollenänderung und Erzeugung des Audit-Ereignisses

Wiederholte Requests dürfen keine doppelten Mitgliedschaften, Einladungsannahmen oder Freigaben erzeugen.

## 11. Datenschutzvorbereitung

Die lokale Architektur wird nach Grundsätzen der Datenminimierung vorbereitet, ist aber allein dadurch noch nicht automatisch DSGVO-konform. Vor dem Produktivbetrieb werden Datenschutzbeauftragte beziehungsweise spezialisierte Experten mindestens Folgendes prüfen:

- Rollen von Kebapp und Laden als Verantwortliche oder Auftragsverarbeiter
- AV-Verträge mit Hetzner, E-Mail- und späteren Domainanbietern
- Zwecke, Rechtsgrundlagen und Aufbewahrungsfristen
- Datenschutzinformationen für Betreiber, Mitarbeiter und Websitebesucher
- Export-, Berichtigungs- und Löschabläufe
- Behandlung abgelehnter Anträge und abgelaufener Einladungen
- Protokollierung und zeitliche Begrenzung von Supportzugriffen
- technische und organisatorische Maßnahmen
- Notwendigkeit einer Datenschutz-Folgenabschätzung

Lokale Seed-Daten sind synthetisch. Echte Laden-, Mitarbeiter- oder Kundendaten dürfen nicht in das Repository eingecheckt werden.

## 12. Migration und lokale Demodaten

Drizzle erzeugt nachvollziehbare SQL-Migrationen. Der Zielzustand muss sowohl durch:

- Migration einer leeren Datenbank und
- Migration einer bereits bestehenden lokalen Entwicklungsdatenbank

reproduzierbar sein.

Ein kontrollierter Seed-Befehl erzeugt:

- einen Plattformadministrator,
- optional einen Supportbenutzer,
- mindestens zwei strikt getrennte Demoläden,
- je einen Ladeninhaber und Mitarbeiter,
- Beispielprofile, Einkaufsrunden und Bedarfspositionen.

Passwörter werden nicht im Seed-Quelltext oder Repository hinterlegt. Der Seed liest sie aus lokalen Umgebungsvariablen, validiert ihr Vorhandensein und darf klar dokumentiert zurückgesetzt werden. Er ist wiederholbar oder bricht kontrolliert ab, ohne inkonsistente Duplikate anzulegen.

## 13. Teststrategie und Abnahmekriterien

### 13.1 Datenbank und Migrationen

- vollständiger Aufbau aus einer leeren PostgreSQL-Datenbank
- erwartete Constraints, Fremdschlüssel und eindeutige Schlüssel
- aktive RLS-Richtlinien auf allen betrieblichen Tabellen
- Laufzeitrolle besitzt keinen RLS-Bypass
- Transaktionskontext wird nach Ende der Transaktion nicht weiterverwendet

### 13.2 Authentifizierung

- Registrierung und E-Mail-Verifizierung
- gültige und ungültige Anmeldung
- Sitzungsablauf und Abmeldung
- Passwort-Zurücksetzen und Token-Wiederverwendung
- Rate-Limit-Grundfälle
- neutrale Antworten gegen Kontoerkennung

### 13.3 Registrierung und Einladungen

- öffentlicher Antrag bleibt bis zur Adminfreigabe PENDING
- Genehmigung aktiviert Organisation und OWNER atomar
- Ablehnung gewährt keinen Betriebszugriff
- OWNER kann EMPLOYEE einladen
- EMPLOYEE kann niemanden einladen
- abgelaufene, widerrufene und bereits verwendete Token werden abgelehnt

### 13.4 Mandantentrennung

Mit zwei Demoläden werden für jede betriebliche Tabelle mindestens folgende Fälle geprüft:

- Laden A kann eigene Daten lesen und ändern.
- Laden A kann Daten von Laden B weder lesen noch ändern.
- Manipulation einer organization_id im Request ändert das Ergebnis nicht.
- Direkte Abfrage über die eingeschränkte Laufzeitrolle bleibt durch RLS getrennt.
- Support ohne Zuweisung erhält keinen Zugriff.
- Zugewiesener Supportzugriff wird auf genau den betreffenden Laden begrenzt.
- Eine gesperrte Organisation erhält keinen betrieblichen Zugriff.

### 13.5 Öffentliche Website

- nur aktive und veröffentlichte Ladenprofile sind öffentlich erreichbar
- PENDING-, SUSPENDED- und REJECTED-Organisationen werden nicht veröffentlicht
- öffentliche Antworten enthalten keine Mitgliedschaften, Bedarfe oder internen Kontaktdaten

### 13.6 End-to-End-Abnahme

Der lokale Kern gilt als abgenommen, wenn automatisiert und im Browser nachgewiesen ist:

1. Ein neuer Betreiber registriert und verifiziert sich.
2. Sein Antrag bleibt zunächst gesperrt.
3. Ein ADMIN genehmigt ihn.
4. Der Betreiber meldet sich an und sieht ausschließlich seinen Laden.
5. Er lädt einen Mitarbeiter ein.
6. Der Mitarbeiter erfasst einen Bedarf, kann aber keine Benutzer verwalten.
7. Ein zweiter Laden bleibt auf Anwendungs- und Datenbankebene vollständig getrennt.
8. Das veröffentlichte Profil des aktiven Ladens ist öffentlich sichtbar.

## 14. Open-Source- und Lizenzrahmen

Der gewählte Kern kann ohne proprietären Auth- oder Datenbankdienst lokal und später selbst gehostet betrieben werden:

- Better Auth: MIT-Lizenz
- Drizzle ORM: Apache-2.0-Lizenz
- PostgreSQL: PostgreSQL-Lizenz
- Podman: Apache-2.0-Lizenz

Diese permissiven Lizenzen zwingen Kebapp nicht dazu, den eigenen Anwendungscode zu veröffentlichen. Vor einem kommerziellen Produktivstart wird dennoch ein automatisiertes Lizenzinventar aller direkten und transitiven Pakete erstellt und fachlich geprüft.

Podman ist die bevorzugte vollständig offene Container-Laufzeit. Die Compose-Datei bleibt Docker-kompatibel; die gesonderten Nutzungsbedingungen von Docker Desktop sind dann nur relevant, wenn ein Entwickler Docker Desktop tatsächlich verwendet.

## 15. Nicht-Ziele dieser Ausbaustufe

- kein Produktiv-Deployment
- keine Hetzner- oder INWX-Automatisierung
- keine echte Domainregistrierung
- kein produktiver E-Mail-Versand
- keine Onlinebestellung und keine Zahlung
- keine native Android- oder iOS-App
- keine vollständige Warenwirtschaft oder Buchhaltung
- kein autonomer Supportzugriff und keine Benutzer-Imitation
- kein Ersatz für die rechtliche und datenschutzfachliche Prüfung

## 16. Empfohlene Implementierungsreihenfolge

Nach schriftlicher Freigabe dieses Entwurfs folgt ein separater, datei- und testgenauer Implementierungsplan. Die voraussichtliche Reihenfolge ist:

1. lokale PostgreSQL- und Mailpit-Infrastruktur
2. Drizzle-Grundlage, Datenbankrollen und Migrationen
3. Better Auth und lokale E-Mail-Abläufe
4. Kebapp-Organisationen, Mitgliedschaften und Plattformrollen
5. zentrale Autorisierung und Row-Level Security
6. Registrierung, Freigabe und Einladungen
7. Migration der Demo-Daten aus dem Browser in PostgreSQL
8. Rollenoberflächen, Auditierung und End-to-End-Tests

Die einzelnen Schritte werden klein genug geplant, dass Migrationen, Berechtigungen und Mandantentrennung nach jedem sicherheitsrelevanten Paket separat überprüfbar bleiben.
