import Link from "next/link";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listRegistrationRequests } from "@/server/organizations/admin";

const weekdayLabel = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  timeZone: "Europe/Berlin",
}).format(new Date());

function daytimeGreeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Berlin",
    }).format(now),
  );
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function AdminOverviewPage() {
  const actor = await requirePlatformAdminPage("/admin");

  const requests = await listRegistrationRequests({ actor });
  const pending = requests.filter((request) => request.status === "PENDING");
  const decided = requests.length - pending.length;
  const oldest = pending[0];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <p>{weekdayLabel} · Prüflauf NRW</p>
          <h1>{daytimeGreeting(new Date())}, {actor.name.split(" ")[0]}.</h1>
          <span>Hier liegen nur Antrags- und Freigabedaten – keine Betriebsdaten.</span>
        </div>
        <div className="admin-date-block">
          <strong>{String(pending.length).padStart(2, "0")}</strong>
          <span>offen</span>
        </div>
      </header>

      <section className="admin-ledger" aria-labelledby="ledger-title">
        <header>
          <div>
            <p>Arbeitsmappe</p>
            <h2 id="ledger-title">Eingang und Entscheidungen</h2>
          </div>
          <Link href="/admin/antraege">Alle Anträge öffnen →</Link>
        </header>
        <div className="admin-ledger__line">
          <span>Offene Ladenprüfungen</span>
          <strong>{pending.length}</strong>
          <small>{oldest ? `Ältester Eingang: ${oldest.storeName}` : "Ablage leer"}</small>
        </div>
        <div className="admin-ledger__line">
          <span>Dokumentierte Entscheidungen</span>
          <strong>{decided}</strong>
          <small>Freigaben und Ablehnungen im Protokoll</small>
        </div>
        <div className="admin-ledger__line admin-ledger__line--total">
          <span>Anträge im NRW-Piloten</span>
          <strong>{requests.length}</strong>
          <small>Gesamtbestand</small>
        </div>
      </section>

      <section className="admin-next">
        <div>
          <p>Nächster Arbeitsschritt</p>
          <h2>{oldest ? oldest.storeName : "Keine offene Prüfung"}</h2>
          <span>
            {oldest
              ? `${oldest.postalCode} ${oldest.city} · Kontakt: ${oldest.contactName}`
              : "Neue Ladenanträge erscheinen automatisch hier."}
          </span>
        </div>
        {oldest ? (
          <Link href={`/admin/antraege/${oldest.id}`}>Akte prüfen</Link>
        ) : null}
      </section>
    </div>
  );
}
