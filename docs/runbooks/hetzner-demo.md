# Kebapp – Runbook für die öffentliche Hetzner-Demo

Stand: 22. August 2026

Dieses Runbook gilt für die synthetische, öffentlich erreichbare Demo auf einem
einzelnen Hetzner-Server. Es enthält bewusst keine echten Kunden- oder
Zahlungsdaten und versendet keine E-Mails.

## Zielbild und feste Pfade

- Server: Hetzner CX23, NBG1, Ubuntu 24.04, IPv4 und IPv6, Hetzner Backups
- öffentlicher Einstieg: Caddy auf TCP 80/443 und UDP 443
- intern: Next.js auf 3000 und PostgreSQL auf 5432, ohne Host-Port
- Anwendung: `/opt/kebapp/current`
- Releases: `/opt/kebapp/releases/<release>`
- geheime Umgebung: `/opt/kebapp/shared/.env.production`, Modus `0600`
- Statusdateien: `/opt/kebapp/state`
- Dumps: `/var/backups/kebapp`, Modus `0700`

Die Hetzner Cloud Firewall und UFW erlauben HTTP/HTTPS öffentlich. SSH ist nur
aus dem bei der Bereitstellung eingetragenen Admin-CIDR erreichbar. Der
temporäre Hostname wird aus der IPv4 gebildet, zum Beispiel
`203-0-113-10.sslip.io`.

## Erstbereitstellung

1. `deploy/cloud-init.yaml.tmpl` kopieren und ausschließlich
   `__SSH_PUBLIC_KEY__` sowie `__ADMIN_CIDR__` ersetzen.
2. Den Server mit dieser Cloud-Init-Konfiguration erstellen und warten, bis
   `/var/lib/cloud/instance/boot-finished` existiert.
3. Das geprüfte Repository ohne `.git`, lokale Env-Dateien, `node_modules` und
   Buildausgaben nach `/opt/kebapp/releases/<release>` übertragen.
4. Im Release `deploy/scripts/bootstrap-release.sh` ausführen.
5. Die Secret-Datei lokal erzeugen, ohne ihren Inhalt im Terminal auszugeben:

   ```bash
   pnpm prod:env:create -- --host HOST \
     --output .env.kebapp-production \
     --access-output .env.kebapp-demo-access.txt
   ```

   Diese Datei per Standard-Eingabe oder SCP nach
   `/opt/kebapp/shared/.env.production` übertragen und `chmod 600` setzen. Die
   Datei darf nie in Git oder Logs landen.
6. Im Release `deploy/scripts/deploy.sh <release>` ausführen.

Alle geheimen Werte werden zufällig erzeugt. Datenbankpasswörter in den URLs
müssen mit den separaten Passwortfeldern übereinstimmen. Für den öffentlichen
Demo-Modus gilt zwingend `DEMO_MODE=true` **zusammen mit**
`ALLOW_PUBLIC_DEMO=true`; SMTP-Werte bleiben abwesend. Ohne
`ALLOW_PUBLIC_DEMO=true` verweigert die Anwendung in der Produktionsumgebung
den Start mit `DEMO_MODE=true` (Sicherheitsriegel gegen versehentlich
öffentliche Ein-Klick-Zugänge). Für echten Betrieb beide Werte auf `false`
setzen bzw. weglassen und SMTP konfigurieren.

## Status und Logs

```bash
cd /opt/kebapp/current
docker compose --env-file /opt/kebapp/shared/.env.production \
  -f compose.production.yaml ps
docker compose --env-file /opt/kebapp/shared/.env.production \
  -f compose.production.yaml logs --tail 200 app caddy postgres
curl --fail --silent https://HOST/api/health
systemctl status kebapp-backup.timer
journalctl -u kebapp-backup.service --since today
```

Der vollständige Rollen-Smoke-Test wird von einem vertrauenswürdigen Rechner
mit installiertem Playwright ausgeführt; die Secret-Datei wird nur lokal
eingelesen:

```bash
pnpm prod:smoke:roles -- \
  --env-file .env.kebapp-production \
  --url https://HOST
```

Verbindungsstrings und die Ausgabe von `docker inspect` werden nicht in Tickets
oder Chats kopiert. Bei Auth-Problemen zuerst Uhrzeit, öffentlichen Hostnamen,
Containerzustand und rollenbezogenen Pfad prüfen.

## Reguläres Deployment

Ein neues Release in ein neues, eindeutiges Unterverzeichnis übertragen und
dort ausführen:

```bash
deploy/scripts/bootstrap-release.sh
deploy/scripts/deploy.sh 2026-08-22-abcdef0
```

Das Skript baut beide Images, erzeugt bei bestehender Datenbank vorab einen
Dump, führt versionierte Migrationen und den idempotenten Demo-Seed aus,
ersetzt die App, wartet auf den Healthcheck und testet HTTPS. Erst nach Erfolg
wird `/opt/kebapp/current` atomar auf das neue Release umgestellt. Das
vorherige App-Image bleibt als Rollback-Ziel erhalten.

## App-Rollback

Das zuletzt gemerkte Ziel steht in
`/opt/kebapp/state/previous-app-image`. Vor Verwendung Inhalt und lokalen
Imagebestand kontrollieren:

```bash
cat /opt/kebapp/state/previous-app-image
docker image ls kebapp-app
cd /opt/kebapp/current
deploy/scripts/rollback.sh kebapp-app:VORHERIGES_RELEASE
```

Ein App-Rollback nimmt keine Datenbankmigration zurück. Wenn ein älterer
Anwendungsstand nicht mehr mit dem Schema kompatibel ist, den Dienst stoppen
und den Restore- oder Hetzner-Backup-Weg verwenden.

## Manuelles Backup und täglicher Timer

```bash
cd /opt/kebapp/current
deploy/scripts/backup-postgres.sh
sudo systemctl start kebapp-backup.service
systemctl list-timers kebapp-backup.timer
```

Die Dumps sind PostgreSQL-Custom-Archive mit interner Kompression. Standardmäßig
werden Dateien älter als 14 Tage nur innerhalb von `/var/backups/kebapp` und
nur mit dem erwarteten Dateimuster entfernt. Hetzner-Backups ergänzen diese
anwendungsnahen Dumps, ersetzen sie aber nicht.

## Restore-Probe

Das Restore-Skript verweigert die Produktionsdatenbank und akzeptiert nur neue
Ziele mit dem Präfix `kebapp_restore_`. Es überschreibt keine vorhandene
Datenbank.

```bash
cd /opt/kebapp/current
deploy/scripts/restore-postgres.sh \
  /var/backups/kebapp/kebapp-ZEITSTEMPEL.dump \
  kebapp_restore_20260822 \
  --confirm kebapp_restore_20260822
```

Nach fachlicher Stichprobe wird die Prüf-Datenbank bewusst und direkt im
PostgreSQL-Container entfernt. Vorher Zielnamen exakt prüfen; niemals eine
Variable oder ein Muster als Produktionsziel verwenden.

## Hetzner-Backup-Restore

1. Server-IP, Volumezustand und letzten anwendungsnahen Dump dokumentieren.
2. In Hetzner den gewünschten Backup-Zeitpunkt kontrollieren.
3. Bevorzugt einen separaten Prüfserver aus dem Backup erstellen.
4. Cloud Firewall mit demselben restriktiven SSH-CIDR zuweisen.
5. App intern prüfen, bevor DNS beziehungsweise der sslip.io-Hostname auf die
   neue IPv4 wechselt.
6. `KEBAPP_HOST` und `BETTER_AUTH_URL` gemeinsam aktualisieren, Caddy neu
   erstellen und alle Sitzungen erneut testen.

## Änderung von IP, Hostname oder späterer Domain

Bei einer neuen IPv4 ändert sich auch der sslip.io-Hostname. In
`.env.production` müssen `KEBAPP_HOST` und `BETTER_AUTH_URL` exakt denselben
HTTPS-Host verwenden. Danach:

```bash
cd /opt/kebapp/current
docker compose --env-file /opt/kebapp/shared/.env.production \
  -f compose.production.yaml up -d --force-recreate app caddy
deploy/scripts/smoke-test.sh
```

Für eine eigene `.de`-Domain zuerst A/AAAA-DNS setzen und die Auflösung prüfen,
dann beide Hostwerte ändern. Caddy beschafft das neue Zertifikat automatisch.

## Störung und Eskalation

- `postgres` ungesund: freien Speicher, Containerlogs und Hetzner-Status prüfen;
  keine Migration erneut erzwingen.
- `app` ungesund: `/api/health`, Env-Vollständigkeit und Datenbankrolle prüfen;
  bei neuem Release App-Rollback versuchen.
- Zertifikat fehlt: DNS-Auflösung, Uhrzeit, Ports 80/443 und Caddy-Logs prüfen.
- Speicher knapp: Dumps und Docker-Images inventarisieren; keine pauschalen
  rekursiven Löschbefehle verwenden.
- Verdacht auf kompromittierte Zugangsdaten: SSH- und Demo-Passwörter sowie
  Better-Auth-Secret rotieren, Sitzungen löschen und Hetzner-Zugriffsprotokolle
  sichern.

Nach jeder Störung werden HTTPS-Smoke-Test, alle vier Rollen, Mandantentrennung,
Demo-Sperren und ein aktueller Dump erneut geprüft.
