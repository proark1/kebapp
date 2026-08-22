# Kebapp – öffentliche Hetzner-Demo

Stand: 22. August 2026

## 1. Ziel und Status

Der lokal abgenommene Kebapp-MVP wird als öffentlich erreichbare Demo auf der
kleinsten sinnvoll nutzbaren Hetzner-Cloud-Instanz bereitgestellt. Die Demo
zeigt Gruppeneinkauf, Rollen, Mandantentrennung und Ladenwebsite mit
persistentem PostgreSQL-Datenbestand.

Die Umgebung ist eine öffentliche Produktdemo, aber noch kein Betrieb mit
echten Kundendaten. Sie versendet keine E-Mails, registriert keine Domains und
enthält weder Onlinebestellung noch Zahlung. Eine zusätzliche
DSGVO-Fachprüfung gehört auf Wunsch des Auftraggebers nicht zum Umfang dieses
Pakets und blockiert die Demo-Bereitstellung nicht.

Erfolg bedeutet:

1. Kebapp ist unter einer temporären HTTPS-Adresse öffentlich erreichbar.
2. Die öffentliche Ladenwebsite funktioniert ohne Anmeldung.
3. App-, Admin- und Supportbereiche bleiben durch Kebapp-Sitzungen und Rollen
   geschützt.
4. Bestätigte Demo-Konten decken Admin, Support, Inhaber:in und
   Mitarbeiter:in ab.
5. Registrierung, Passwort-E-Mails und Teameinladungs-E-Mails sind im
   Demo-Modus serverseitig deaktiviert.
6. PostgreSQL ist nicht öffentlich erreichbar und behält Daten über
   Deployments hinweg.
7. HTTPS, Backups, Healthchecks, Logrotation und ein dokumentierter Rollback
   sind eingerichtet.

## 2. Geprüfte Varianten

### 2.1 Ausgewählt: CX23 mit IPv4, IPv6 und Hetzner-Backups

- Standort: Nürnberg (`NBG1`)
- Architektur: x86-64
- Ressourcen: 2 vCPU, 4 GB RAM, 40 GB SSD
- Betriebssystem: Ubuntu 24.04 LTS
- öffentliche IPv4 und kostenfreie IPv6
- aktivierte Hetzner-Backups mit sieben Slots

Auf Grundlage der ab 15. Juni 2026 gültigen deutschen Preise ergibt sich eine
monatliche Obergrenze von ungefähr 8,44 Euro inklusive Umsatzsteuer: 6,53 Euro
für den CX23, 0,60 Euro für IPv4 und rund 1,31 Euro für die Backup-Option.

Quellen:

- [Hetzner-Preisanpassung](https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/)
- [Preise primärer IPs](https://docs.hetzner.com/de/cloud/servers/primary-ips/overview/)
- [Abrechnung von Backups](https://docs.hetzner.com/de/cloud/billing/faq/)

### 2.2 Verworfen: CX23 ohne Hetzner-Backups

Diese Variante spart ungefähr 1,31 Euro im Monat, lässt aber bei einem
Serverdefekt oder Bedienfehler nur Kopien auf demselben Host zurück. Die geringe
Ersparnis rechtfertigt das Wiederherstellungsrisiko nicht.

### 2.3 Verworfen: CX23 ausschließlich mit IPv6

Diese Variante spart 0,60 Euro im Monat, ist jedoch für Besucher aus
IPv4-only-Netzen nicht zuverlässig erreichbar. Sie eignet sich nicht für eine
öffentliche Vorführung.

ARM-basierte CAX-Tarife werden ebenfalls nicht verwendet: Der kleinste CAX11
ist nach aktueller Preisliste teurer als der CX23 und erhöht ohne Nutzen für die
Demo das Risiko architekturspezifischer Abweichungen.

## 3. Systemarchitektur

Auf dem einzelnen Cloud-Server laufen drei dauerhafte Container:

1. **Caddy** nimmt ausschließlich HTTP und HTTPS entgegen, beschafft und
   erneuert TLS-Zertifikate und leitet Anfragen an Kebapp weiter.
2. **Kebapp** läuft als optimierte Next.js-Produktionsanwendung und ist nur im
   internen Compose-Netz erreichbar.
3. **PostgreSQL 17** speichert Auth-, Mandanten-, Einkaufs-, Website- und
   Auditdaten in einem benannten Volume und ist ausschließlich intern
   erreichbar.

Mailpit wird auf dem öffentlichen Server nicht benötigt. Ausgehender SMTP wird
im Demo-Modus nicht konfiguriert.

Die feste IPv4 bildet zusammen mit `sslip.io` die temporäre Adresse, zum
Beispiel `https://203-0-113-10.sslip.io`. Damit stehen DNS-Auflösung und ein
öffentlich vertrauenswürdiges Let's-Encrypt-Zertifikat ohne Domainkauf bereit.
Beim späteren Wechsel auf eine eigene Domain ändern sich nur Hostname,
Auth-Basis-URL und Caddy-Konfiguration.

## 4. Serverbereitstellung und Netzwerk

Der Server wird reproduzierbar per Cloud-Init vorbereitet:

- Systempakete aktualisieren
- Docker Engine mit Compose-Plugin installieren
- dedizierten Benutzer `deploy` anlegen
- den vom Nutzer bestätigten SSH-Key hinterlegen
- Passwortanmeldung über SSH deaktivieren
- Root-Anmeldung über SSH deaktivieren
- Zeitzone auf `Europe/Berlin` setzen
- 2 GB Swap für kurzfristige Build-Spitzen anlegen
- automatisierte Sicherheitsupdates aktivieren
- begrenzte Docker-Logrotation konfigurieren

Eine Hetzner-Cloud-Firewall erlaubt:

- TCP 80 aus dem Internet
- TCP 443 aus dem Internet
- TCP 22 nur von der beim Setup festgestellten öffentlichen IP des Nutzers
- notwendige ausgehende Verbindungen, insbesondere HTTPS, DNS und
  Let's Encrypt

PostgreSQL, interne App-Ports und Docker-Steuerung werden nicht veröffentlicht.
Ändert sich die Administrator-IP, muss die SSH-Regel bewusst in der Hetzner
Console angepasst werden.

## 5. Demo-Modus

Die Anwendung erhält die explizite Laufzeitoption `DEMO_MODE=true`. Diese
Option darf nicht nur Schaltflächen ausblenden, sondern muss die betroffenen
Serveraktionen ablehnen.

Im Demo-Modus gelten folgende Regeln:

- Die öffentliche Ladenwebsite ist frei zugänglich.
- Anmelde- und geschützte Kebapp-Routen funktionieren unverändert.
- Selbstregistrierung wird deaktiviert und erklärt den Demo-Zustand.
- Verifizierungs- und Passwort-Reset-E-Mails werden nicht ausgelöst.
- Das Versenden neuer Teameinladungen wird deaktiviert.
- Es werden keine SMTP-Zugangsdaten benötigt.
- Bestehende Rollen- und Mandantenprüfungen bleiben vollständig aktiv.

Ein idempotenter Demo-Seed erzeugt bestätigte Konten und Beispieldaten für:

- Plattform-Admin
- zugewiesenen Support
- aktive Inhaberin oder aktiven Inhaber
- aktive Mitarbeiterin oder aktiven Mitarbeiter
- mindestens einen zweiten Laden für die nachweisbare Mandantentrennung
- eine aktive veröffentlichte Ladenwebsite

Alle Demo-Passwörter werden beim Deployment zufällig erzeugt. Sie stehen weder
im Repository noch auf der öffentlichen Website und werden dem Nutzer einmalig
übergeben. Ein erneuter Seed verändert vorhandene zufällige Passwörter nicht
unbeabsichtigt und legt keine doppelten Datensätze an.

## 6. Build, Deployment und Geheimnisse

Das Repository erhält:

- ein mehrstufiges Produktions-Dockerfile
- eine Produktions-Compose-Datei
- eine Caddy-Konfiguration
- eine Cloud-Init-Vorlage
- Deploy-, Backup-, Restore- und Rollback-Skripte
- eine Env-Beispieldatei ohne Geheimnisse
- ein kurzes Betriebs-Runbook

Das Next.js-Image wird als schlankes Standalone-Image gebaut. Abhängigkeiten,
Buildwerkzeuge und Quellcode, die zur Laufzeit nicht erforderlich sind, bleiben
außerhalb der finalen Image-Stufe. Container laufen soweit technisch möglich
ohne Root-Rechte und besitzen Healthchecks sowie eine Restart-Policy.

Die produktive Server-Env enthält mindestens:

- getrennte zufällige PostgreSQL-Passwörter für Besitzer- und Laufzeitrolle
- eine zufällige Better-Auth-Secret-Zeichenfolge
- die temporäre öffentliche Auth-Basis-URL
- `DEMO_MODE=true`
- zufällige initiale Demo-Passwörter

Diese Datei wird mit restriktiven Dateirechten ausschließlich auf dem Server
gespeichert. Sie wird weder committed noch in Befehlsausgaben oder Logs
ausgegeben.

Der Deploymentablauf lautet:

1. getesteten Commit auf den Server übertragen
2. neues App-Image vollständig bauen
3. Datenbank sichern
4. versionierte Migrationen mit der Besitzerrolle ausführen
5. idempotente Demo-Daten einspielen
6. App und Proxy aktualisieren
7. Healthchecks und öffentliche Smoke-Tests ausführen
8. vorheriges App-Image als Rollback-Ziel behalten

Migrationen werden nicht automatisch zurückgerollt. Eine Migration muss daher
vor dem Deployment vorwärts- und wiederherstellbar getestet werden. Bei einem
App-Fehler wird das vorige Image gestartet; bei einem Datenfehler wird der vor
dem Deployment erzeugte Dump verwendet.

## 7. Sicherung, Wiederherstellung und Betrieb

Die aktivierte Hetzner-Backup-Option stellt sieben Server-Backup-Slots bereit.
Zusätzlich erzeugt ein täglicher Systemd-Timer einen komprimierten
PostgreSQL-Dump auf dem Server. Lokale Dumps werden mit begrenzter Aufbewahrung
rotiert. Sie beschleunigen einzelne Datenbank-Restores, ersetzen aber nicht die
außerhalb der Instanz liegenden Hetzner-Backups.

Das Runbook dokumentiert:

- Status und Logs aller Container prüfen
- App neu starten
- Datenbankdump manuell erzeugen
- Dump in eine leere Datenbank zurückspielen und prüfen
- vorheriges App-Image aktivieren
- Hetzner-Backup zu einem Ersatzserver wiederherstellen
- temporären Hostnamen nach einem IP-Wechsel aktualisieren
- SSH-Quell-IP in der Cloud-Firewall ändern

Caddy, App und PostgreSQL erhalten Healthchecks. Docker startet ausgefallene
Container automatisch neu. Logrotation begrenzt die lokale Plattenbelegung.
Ein vollständiger externer Monitoring- oder Alarmierungsdienst gehört nicht zu
dieser kleinen Demo-Stufe; die dokumentierten Statusprüfungen bleiben manuell.

## 8. Fehlerverhalten

- Ohne gesunde App liefert Caddy keine scheinbar erfolgreiche leere Seite.
- Ohne Datenbankverbindung bleibt Kebapp ungesund und wird nicht als erfolgreich
  ausgerollt gewertet.
- Fehlende Demo-Konfiguration führt zu einem Startfehler statt zu einem
  ungeschützten Mischbetrieb.
- E-Mail-Aktionen antworten im Demo-Modus erklärend und lösen keinen
  Netzwerkversand aus.
- Ein fehlgeschlagener Seed legt keine halbfertigen doppelten Rollen oder
  Organisationen an.
- Scheitert TLS, bleibt die HTTP-Diagnose über Caddy-Logs nachvollziehbar; die
  Demo wird erst nach erfolgreichem HTTPS-Smoke-Test freigegeben.

## 9. Prüfung und Abnahme

Vor jeder ersten Bereitstellung laufen lokal:

```text
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm licenses list --prod
pnpm audit --prod
```

Die bestehende dokumentierte moderate transitive esbuild-Meldung wird nicht
durch einen ungetesteten Zwangs-Override verdeckt. Neue oder höher gewichtete
Auditmeldungen müssen vor dem Deployment bewertet werden.

Nach der Bereitstellung werden mindestens geprüft:

1. temporäre URL löst öffentlich auf und verwendet gültiges HTTPS
2. HTTP leitet auf HTTPS um
3. aktive Ladenwebsite liefert 200 und enthält keine Bestellung oder Zahlung
4. nicht aktive Ladenwebsite bleibt verborgen
5. Admin-, Support-, Inhaber- und Mitarbeiterkonto erreichen nur ihre Rollen
6. zwei Ladenkonten sehen keine Daten des jeweils anderen Mandanten
7. Registrierung, Passwort-E-Mail und Einladungssendung sind im Demo-Modus
   deaktiviert
8. PostgreSQL-Port ist von außen nicht erreichbar
9. Healthchecks sind grün und Container starten nach einem Neustart automatisch
10. manueller Dump und Restore in eine getrennte Prüfdatenbank funktionieren

## 10. Nicht enthalten

- eigene oder automatisch registrierte `.de`-Domain
- INWX-, DENIC- oder Domain-Reseller-Automation
- produktiver SMTP-Anbieter und echter E-Mail-Versand
- Onlinebestellung, Zahlung oder Endkundenkonto
- Kundendatenmigration
- Hochverfügbarkeit über mehrere Server
- externer Monitoring-/Pagerdienst
- CI/CD mit automatischer Produktionseinspielung
- zusätzliche DSGVO-, Rechts- oder Lizenzfachberatung

Diese Punkte können später als getrennte, erneut prüfbare Ausbaustufen ergänzt
werden. Der Wechsel von der temporären Adresse auf eine echte Domain und einen
produktiven SMTP-Dienst erfordert eine eigene Freigabe.
