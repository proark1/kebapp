# Gesamtcheck: UI/UX, Sicherheit und Automatisierung für Dönerleben

**Datum:** 23. August 2026
 **Geprüfter Stand:** Arbeitsverzeichnis (Next.js 16.3.1, React 19.2, PostgreSQL mit RLS, Better Auth 1.7.1)
 **Art der Prüfung:** Vollständige Code-Analyse ohne Datenänderungen (UI/UX, Sicherheit, Feature-/Automatisierungsstand)
 **Abgrenzung:** Der [Storefront-Finalreport](2026-08-23-public-storefront-ui-ux-final-report.md) und der [Gesamtprodukt-UI/UX-Report](2026-08-23-kebapp-full-product-ui-ux-report.md) bleiben gültig; dieser Report ergänzt Sicherheit, Automatisierungsfähigkeit und die Frage „Was braucht Dönerleben?"

---

## 1. Executive Summary

Kebapp hat einen überdurchschnittlich soliden und sicherheitshärteten Kern: Mandantentrennung mit FORCE-RLS, dreifache Autorisierung (Guard → Service → RLS), Audit-Events in derselben Transaktion, durchdachte Auth-Flows und ein handwerklich sauber gebautes UI mit ernst genommenen Accessibility-Grundlagen. **Im versionierten Code wurde kein kritischer Sicherheitsbefund gefunden.**

Die größten Risiken liegen nicht im Code, sondern im Betrieb und in der Produktlogik:

1. **Demo-Modus ist in der Produktions-Compose voreingestellt an** (`DEMO_MODE:-true`) – bei aktivem Demo-Modus kann sich jeder anonyme Besucher per Ein-Klick als Plattform-Admin anmelden. Für die öffentliche Demo gewollt, für echten Betrieb mit Dönerleben-Daten fatal.
2. **Klartext-Geheimnisse im Projektverzeichnis** (nicht in Git, aber auf Platte): Produktions-Passwörter, Auth-Secrets und eine Demo-Zugangsdatei inklusive Plattform-Admin-Passwort.
3. **Der namensgebende Gruppeneinkauf endet an der Bestätigungsmaske:** Sammelrunden können nur per Seed angelegt werden, es gibt keinen Scheduler für Rundenstatuswechsel, keine Erinnerungs-E-Mails und keinen Bündel-Export nach Rundschluss. Genau hier liegt der größte Automatisierungshebel für Dönerleben.
4. **Website-Editor verliert sein Kernversprechen auf Mobilgeräten:** Die Live-Vorschau wird <760 px komplett ausgeblendet – genau auf dem Gerät der Zielgruppe.

| Bereich | Bewertung | Kurzurteil |
| --- | ---: | --- |
| Sicherheit (Code) | 8,5/10 | Kein kritischer Befund; Defense-in-depth vorbildlich |
| Sicherheit (Betrieb) | 6,0/10 | Demo/Prod-Trennung, Secret-Handling, Header müssen nachgezogen werden |
| UI/UX Handwerk | 8,0/10 | A11y-Grundlagen, Microcopy und Formulare auf hohem Niveau |
| UI/UX Systemik | 6,5/10 | Keine Loading-/Error-Routen, dünne Token-Basis, kein Dark Mode |
| Einfachheit für Laien | 8,0/10 | Deutsche, ehrliche Microcopy; gute Führung; Mobile-Preview-Lücke |
| Gestaltungsfreiheit „Designer" | 4,5/10 | Ein Layout, eine Typo, eine Akzentfarbe – bewusst opinionated |
| Automatisierung aktuell | 5,0/10 | Onboarding/E-Mail/Audit automatisiert; Einkaufszyklus bricht ab |
| Vorbereitung auf Dönerleben | 6,5/10 | Technischer Kern steht; Betriebsmodule fehlen fast vollständig |

**Fazit:** Für geführte Demos und Pilotgespräche bereit. Für einen betreuten Pilotbetrieb mit Dönerleben zuerst: Demo/Prod hart trennen, Header+SMTP-TLS nachziehen, Runden-Lebenszyklus automatisieren (Quick Wins unten). Vom „Betriebssystem"-Claim sind neben Website und Einkauf noch alle Betriebsmodule (Lager, Personal, Hygiene, Buchhaltung) papierlos – das ist laut Spec Phase 3 und korrekt priorisiert.

---

## 2. UI/UX-Befund

### 2.1 Stärken (Auswahl)

- **A11y-Grundlagen konsequent:** globales `:focus-visible` (3 px gelb), Skip-Links in allen Shells (`admin/layout.tsx:18`, `components/app-shell.tsx:52`), `prefers-reduced-motion` respektiert.
- **Manuelle Dialoge korrekt:** Focus-Trap, Escape, Fokus-Rückgabe (`storefront-order-sheet.tsx:73-181`, `demand-planner.tsx:129-169`).
- **Formularqualität hoch:** `useActionState`, Feldfehler mit `aria-invalid`/`aria-describedby`/`role="alert"` nahe am Feld, `autoComplete`/`inputMode` durchgängig.
- **Pending-Zustände überall** (`useFormStatus` mit deutschen Texten), Live-Regionen für Speicherstatus.
- **Empty-States aktivierend** statt Sackgasse; Demo-Transparenz als Designprinzip („Beispieldaten", „Kebapp speichert oder sendet diese Bestellung nicht").
- **Microcopy durchgängig Deutsch, Du-Form, gendergerecht**, konsistente Metaphern („Sammelzettel", „Prüftisch").

### 2.2 Schwächen (mit Belegen)

| # | Befund | Beleg | Wirkung |
| --- | --- | --- | --- |
| U1 | Live-Vorschau im Website-Editor wird mobil komplett ausgeblendet; Entwürfe am Handy nicht ansehbar | `globals.css:3479-3481`, `website-editor.tsx:506` | Hoch – bricht Kernversprechen am Hauptgerät der Zielgruppe |
| U2 | **Kein einziges** `loading.tsx`/`error.tsx`/Suspense im gesamten App-Baum | Grep: 0 Treffer | Hoch – Navigation friert ein, Laufzeitfehler landen im generischen Fallback |
| U3 | Mengen-Buttons: voller Server-Roundtrip pro Tap, kein Optimismus | `demand-planner.tsx:296-354` | Mittel–Hoch (Touch-Trägheit im Tagesgeschäft) |
| U4 | Serverfehler behaupten „Prüfe die markierten Felder", liefern aber nie Feldfehler | `website-editor.tsx:68-71` vs. `app/app/website/actions.ts:42-44` | Mittel |
| U5 | Extrem kleine Schriftgrade: 8–10 px Labels, Tabbar-Label 9 px; Inputs 13 px → iOS-Fokuszoom | `professional-storefront.css:290`, `globals.css:3333,1743` | Hoch (Lesbarkeit/A11y) |
| U6 | Kontrastfehler: Kupfer #b58a50 auf Hell = 2,75:1 (AA: 4,5) | `professional-storefront.css:199-206` | Hoch |
| U7 | Geschäftskritischer Bestellschluss-Badge wird mobil ausgeblendet | `globals.css:3347-3351` | Hoch (Deadline-Sichtbarkeit) |
| U8 | Kein Dark Mode; nur 29 CSS-Variablen gegenüber ~450 hardcoded Hexwerten | `globals.css:1-22` | Mittel (Konsistenz, Abendschicht) |
| U9 | Drei parallel gepflegte Navigationen (App/Admin/Support) statt einer Shell-Abstraktion | `app-shell.tsx`, `admin-navigation.tsx`, `support-navigation.tsx` | Mittel (Wartung) |
| U10 | Hartcodierte Inhalte: „Guten Morgen" immer, Wochentag „Freitag" fix, „4 offene Belege" fix | `dashboard.tsx:57,130`, `admin/page.tsx:17-18` | Mittel (Glaubwürdigkeit) |
| U11 | React-Key-Kollision bei mehrfachem Wochentag in Öffnungszeiten | `website-editor.tsx:457`, `storefront.tsx:264` | Niedrig–Mittel |
| U12 | Mobiler Drawer ohne Fokus-Management/Scroll-Lock/Escape | `app-shell.tsx:137-144` | Mittel |

### 2.3 Bewertung Website-Editor & „Designer"-Eignung

- **Öffentliche Ladenwebsite (`/laden/[slug]`): Note 1–2.** Professionelles Serifen-Restaurant-Template, saubere Semantik, Sticky-Mobile-Actionleiste, korrektes Bottom-Sheet, ehrliche Hinweise.
- **Editor (`/app/website`): solides Fundament, halbes WYSIWYG (Note 3).** Für Laien richtig gemacht (Vorschau am Desktop, Erklärtexte, Limits, Dirty-Warnung). Es fehlen: Mobile-Vorschau, echter Desktop/Mobil-Umschalter, Template-/Farbschema-Alternativen, Reihenfolgeänderung, Undo, laienverständliche Feldnamen („Kleine Zeile"), feldnahe Fehler.
- **Für nicht-technische Nutzer: gut bis sehr gut** – sobald U1/U3/U4 gefixt sind.
- **Für professionelle Designer: bewusst limitiert.** Gestaltungsspielraum = Logo + Hero-Bild + Akzentfarbe. Das ist für die Pilotphase vertretbar („opinionated Default schlägt Baukasten"), sollte aber im Marketing so erzählt werden. Empfehlung statt freier Gestaltung: **2–3 kuratierte Farbwelt-Chips** (statt Hex-Eingabe) und später Section-Reihenfolge – das hebt die wahrgenommene Gestaltungsfreiheit, ohne Support-Aufwand zu erzeugen.

### 2.4 Top-10 UI-Maßnahmen (priorisiert)

1. Mobile Live-Vorschau im Editor wiederherstellen (U1)
2. `loading.tsx`/`error.tsx` + Skeletons; `useOptimistic` für Mengen-Buttons (U2/U3)
3. Zod-`fieldErrors` serverseitig durchreichen, Behauptung wahr machen (U4)
4. Mindestschriftgrößen anheben (≥11 px Labels, ≥16 px Inputs), Tabbar ≥12 px (U5)
5. Kupfer-Akzent dunkler Variante ≥4,5:1 (U6)
6. Bestellschluss-Badge mobil sichtbar halten (U7)
7. Token-Scale ausbauen (Farbrampen, Spacing, Typo), Hexwerte migrieren
8. Dark Mode via `prefers-color-scheme` für Inhaber-/Mitarbeiterbereich
9. Editor: Desktop/Mobil-Umschalter, Farbpaletten-Chips, Wochentag-Duplikate verhindern (U11)
10. Shell-Konsolidierung + dynamische Dashboard-Inhalte statt Fixtexte (U9/U10)

---

## 3. Sicherheitsbefund

### 3.1 Nach Schweregrad

**KRITISCH:** keine Befunde im versionierten Code. (Alle vier lokalen `.env`-Dateien sind nachweislich nicht getrackt: `git ls-files` listet nur Example-Dateien; `git check-ignore` ordnet sie `.gitignore:10` zu; Historie leer.)

| Grad | # | Befund | Beleg | Empfehlung |
| --- | --- | --- | --- | --- |
| HOCH | H1 | `compose.production.yaml` defaultet `DEMO_MODE:true`; aktiv = Ein-Klick-Login als Plattform-Admin für jeden Besucher | `compose.production.yaml:17`, `demo-actions.ts:36-59` | In echter Produktion `DEMO_MODE=false` beim Boot erzwingen (Fail-fast wenn `NODE_ENV=production && DEMO_MODE=true`); Demo-Stack vom Produktions-Stack trennen; ggf. IP-Allowlist/BasicAuth vor die Demo |
| HOCH | H2 | Klartext-Geheimnisse im Projektordner: `.env.kebapp-production` (DB-Passwörter, Auth-Secret), `.env.kebapp-demo-access.txt` (Zugangsliste inkl. Plattform-Admin) | Dateisystem, nicht Git | Pre-Commit-Hook (gitleaks/git-secrets); Secrets mittelfristig in Secret-Manager; Demo-Zugänge nur zeitlich begrenzt verteilen, nach Demo rotieren |
| HOCH | H3 | Weder CSP noch HSTS global (Caddy setzt Auto-HTTPS, aber kein HSTS) | `next.config.ts:14-25`, `deploy/Caddyfile:8-13` | HSTS in Caddyfile; CSP einführen (`default-src 'self'; img-src 'self' data:`; Fonts self-hosted) |
| MITTEL | M1 | SMTP ohne erzwungenes TLS (`secure:false`, kein `requireTLS`) – Reset-/Verifizierungslinks könnten klartext gehen | `src/server/email/mailer.ts:18-22` | `requireTLS:true`; Produktion nur gegen STARTTLS-Relay oder Implicit-TLS |
| MITTEL | M2 | Better-Auth-Tabellen ohne RLS, volles DML für App-Rolle (dokumentiert bewusst) | `drizzle/0001_tenant_security.sql:305-323` | Als bewusste Ausnahme im Security-Dok führen; Spaltenprivilegien erwägen |
| MITTEL | M3 | Audit kennt nur `SUCCESS` – Denied/Failed (fehlgeschlagene Logins, abgelehnte Support-Zugriffe) werden nicht auditiert | `write-audit-event.ts:28` | Denied/Failed-Events schreiben (Missbrauchserkennung) |
| MITTEL | M4 | Teilweise Account-Enumeration: `EMAIL_NOT_VERIFIED` sichtbar redirectiert | `(auth)/actions.ts:116-118` | Für B2B-Antragsprozess vertretbar; alternativ neutralisieren |
| MITTEL | M5 | Kein strukturiertes Logging (Better-Auth-Logger deaktiviert, `console.error` ohne Request-ID) | `create-auth.ts:99-101` | JSON-Logging mit Request-ID ohne PII; Incident Response ermöglichen |
| NIEDRIG | N1-N6 | Cookie `sameSite:lax` (ok), Org-Cookie 30 Tage (wird revalidiert), Bildvalidierung ohne Magic-Bytes (Restrisiko minimal), `/api/health` offen (vertretbar), Passwort nur Längenpolicy (BSI-ok) | Details im Anhang des Audits | Beobachten |

### 3.2 Was bereits gut gelöst ist (nicht antasten)

- **RLS-Architektur:** ENABLE+FORCE auf allen Fachtabellen, SECURITY-DEFINER-Prüffunktionen mit festem `search_path`, Laufzeitrolle ohne BYPASSRLS/SUPERUSER, transaktionslokaler Tenant-Kontext – **keine umgehbare Stelle gefunden**.
- **Dreifache Autorisierung** in allen 11 `actions.ts` geprüft: **kein IDOR**. Organisation kommt nie ungeprüft aus Requests.
- Einladungstokens (32 Byte Entropie, nur SHA-256-Hash, E-Mail-Bindung, 72 h), Anti-Open-Redirect, DB-Rate-Limiting je Endpunkt, Test-DB-Schutz (`_test`-Suffix doppelt geprüft), Deployment-Hygiene (Non-Root-Container, `0600` Env, internes DB-Netz, Backup-before-deploy, Rollback).

---

## 4. Automatisierung & Unterstützung von Dönerleben

### 4.1 Real implementiert (Stand heute)

Onboarding-Kette Registrierung → E-Mail-Verifizierung → Ladenantrag → Admin-Freigabe; Team-Einladungen; Rollen/Audit/Support-Zuweisungen; Bedarfserfassung mit zweistufiger Owner-Bestätigung und Sperrlogik nach Bestellschluss; **live regionale Mengenaggregation** inkl. Preisstufen/Ersparnisberechnung; Website-Editor + Ein-Klick-Veröffentlichung + WhatsApp-Bestellvorbereiter; Domainwunsch-Vormerkung; automatische Auth-E-Mails; Audit-Trail; Betriebsautomatisierung (tägliches Backup, Healthchecks, Rollback).

### 4.2 Die zentrale Lücke: Der Einkaufszyklus bricht ab

- Sammelrunden existieren **nur per Seed** (`scripts/seed.ts:273`) – keine Admin-UI/API zum Anlegen/Öffnen/Schließen.
- Kein Scheduler/Cron/Queue im gesamten Code: Statuswechsel OPEN→CLOSED→SUBMITTED passiert nie automatisch.
- Nach der Owner-Bestätigung passiert nichts: kein Export, keine Angebotsanfrage, keine Benachrichtigung (die UI sagt selbst: „Es wird kein realer Lieferantenauftrag ausgelöst", `demand-planner.tsx:201`).
- Keine Erinnerungs-E-Mails vor Bestellschluss (Spec 6.1 sieht sie vor).
- Admin-Antragsprüfung ist bewusst manuell („Prüftisch") – korrekt für den Piloten, später automatisierungsfähig.

### 4.3 Gap-Liste für Vollautomation bei Dönerleben

**Quick Wins (auf vorhandenem Datenmodell, Wochen 1–3):**

1. **Runden-Lebenszyklus automatisieren:** Admin-Oberfläche zum Runden-Anlegen, automatischer Statuswechsel bei `closes_at`, Erinnerungs-E-Mails. Grundlage (`buying_rounds`, Mailer) steht. Hebt direkt die Erfolgskennzahl „≥80 % rechtzeitig digital bestätigt".
2. **Rundenabschluss-Export:** aggregierte Gruppenmenge je Produkt/Spezifikation als Ansicht/Dokument für das Einkaufsteam nach SUBMITTED – Aggregationsfunktion existiert bereits.
3. **Wiederkehrende Bestellvorlagen:** Bedarf als Vorlage speichern und in neue Runde kopieren – reduziert den größten manuellen Aufwand des Ladens.
4. **Produktiven SMTP-Versand freischalten** (M1 gleich miterledigen).
5. P2-UX-Fixes aus dem Storefront-Finalreport (Touch-Ziele, Buttonnamen, `required` Lieferadresse).

**Mittelfristig (neue Module, Spec vorhanden, Code fehlend):**

| Baustein | Spec-Quelle |
| --- | --- |
| Lieferantenportal (Anfrage/Angebot/Vergabe) | Hauptspec 4.4, 6.1, Zustandsautomat Kap. 12 |
| Wareneingang/Fehlmengen/Reklamation | Spec 6.1 |
| Domain-/SSL-Automation (INWX-API, Let's Encrypt, 8-Stufen-Statuskette) | Hauptspec 10.3; Felder bereits modelliert |
| Objektspeicher statt Data-URLs (Bilder ≤1 MiB in Postgres heute) | Storefront-Spec 9 |
| Kassen-/POS-Import (CSV/DSFinV-K) für echtes Dashboard | Spec 6.8 |
| Lager/Inventur/Rezepte/Bestellvorschläge | Spec 6.3 |
| Personal: Zeiterfassung, Dienstplan (gesetzlich relevant!) | Spec 6.5 |
| Hygiene/HACCP-Dokumentation | Spec 6.6 |
| Buchhaltung/E-Rechnung/DATEV | Spec 6.4 |

**Bewusst ausgegrenzt (Nicht-Ziele, vorher rechtlich/steuerlich prüfen):** echte Endkundenbestellung & Zahlung (aktuell WhatsApp-Vorbereiter), Kundenkommunikation (Newsletter/SMS). Compliance-Vorbedingungen für Produktion sind dokumentiert, aber offen: Admin/Support-MFA (Auth-Spec 9, Pflicht vor erstem Pilotzugang), DSGVO-Fachprüfung, Sharp/LGPL-Lizenzklärung, AV-Verträge.

### 4.4 E2E-Testabdeckung

Gut abgedeckt: kompletter Onboarding-Flow, Rollengrenzen (Employee ohne Bestätigungsrecht), Mandantentrennung inkl. direkter RLS-Abfrage, öffentliche Storefront + WhatsApp-Ziel, 404 für gesperrte Läden – auf Desktop-Chromium, schmalem Android und mobilem WebKit. Nicht abgedeckt: Support-Flüsse, Domainwunsch, A11y-Automatisierung (kein axe).

---

## 5. Empfohlene Reihenfolge

**Sprint 0 – Sicherheit schärfen (vor jedem echten Dönerleben-Zugang):**
1. Fail-fast gegen `DEMO_MODE=true` in echter Produktion (H1)
2. HSTS + CSP in Caddyfile/next.config (H3), `requireTLS` für SMTP (M1)
3. Gitleaks-Pre-Commit-Hook, Demo-Credentials rotieren (H2)

**Sprint 1 – Pilotbetrieb tragfähig machen:**
4. Quick Wins 1–3 aus 4.3 (Runden-Automation, Abschluss-Export, Vorlagen)
5. UI-Top-3: Mobile-Preview, Loading/Error-Routen + optimistische Mengen, feldnahe Fehler
6. Schriftgrößen/Kontraste (U5/U6), Bestellschluss-Badge mobil (U7)

**Sprint 2+ – Richtung „Betriebssystem":**
7. Editor-Gestaltung: Desktop/Mobil-Umschalter, Farbwelt-Chips statt Hexfeld
8. Token-Scale + Dark Mode, Shell-Konsolidierung, dynamische Dashboards
9. Erstes Betriebsmodul nach Spec-Phase 3 (Empfehlung: Wareneingang/Fehlmengen – engster am bestehenden Einkauf), parallel MFA für Plattformrollen und DSGVO-Vorbereitung

---

*Erstellt durch automatisierte Code-Analyse (drei vertiefte Durchläufe: UI/UX, Sicherheit, Produkt/Automatisierung). Alle Befunde mit Datei:Zeile nachvollziehbar; keine Änderungen am Code oder an Daten vorgenommen.*
