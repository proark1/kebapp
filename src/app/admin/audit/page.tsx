import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listAuditEvents } from "@/server/audit/queries";
import { listSupportAdministration } from "@/server/support/service";

export const metadata: Metadata = { title: "Auditprotokoll" };

const actionLabels: Record<string, string> = {
  SUPPORT_ASSIGNED: "Support zugewiesen",
  SUPPORT_ASSIGNMENT_ENDED: "Support beendet",
  SUPPORT_DEMAND_ITEM_ADDED: "Bedarfsposition ergänzt",
  SUPPORT_DEMAND_ITEM_REMOVED: "Bedarfsposition entfernt",
  SUPPORT_DEMAND_QUANTITY_UPDATED: "Bedarfsmenge geändert",
  SUPPORT_STOREFRONT_UPDATED: "Ladenwebsite geändert",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; organizationId?: string }>;
}) {
  const actor = await requirePlatformAdminPage("/admin/audit");
  const filters = await searchParams;
  const [events, support] = await Promise.all([
    listAuditEvents({ actor, filters }),
    listSupportAdministration({ actor }),
  ]);

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Nachweis · unveränderliche Ereignisspur</p>
          <h1>Auditprotokoll</h1>
          <span>Nur notwendige Metadaten: wer, wann, in welchem Laden, welche Aktion und warum.</span>
        </div>
        <div className="admin-file-count">{events.length} TREFFER</div>
      </header>

      <form className="audit-filter" method="get">
        <label className="field">
          <span>Laden</span>
          <select name="organizationId" defaultValue={filters.organizationId ?? ""}>
            <option value="">Alle Läden</option>
            {support.organizations.map((organization) => (
              <option key={organization.organizationId} value={organization.organizationId}>
                {organization.storeName}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Akteur</span>
          <input name="actor" defaultValue={filters.actor ?? ""} placeholder="Name, E-Mail oder ID" />
        </label>
        <label className="field">
          <span>Aktion</span>
          <input name="action" defaultValue={filters.action ?? ""} placeholder="z. B. SUPPORT" />
        </label>
        <button className="button button--primary" type="submit">Filtern</button>
      </form>

      <section className="audit-ledger" aria-label="Auditereignisse">
        {events.length === 0 ? (
          <p className="request-file__empty">Keine passenden Ereignisse gefunden.</p>
        ) : (
          <ol>
            {events.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.createdAt))}
                </time>
                <div>
                  <span>{event.storeName ?? "Plattform"}</span>
                  <h2>{actionLabels[event.action] ?? event.action}</h2>
                  <p>{event.reason ?? "Ohne gesonderte Begründung"}</p>
                </div>
                <div className="audit-ledger__actor">
                  <strong>{event.actorLabel}</strong>
                  <small>{event.objectType}{event.objectId ? ` · ${event.objectId}` : ""}</small>
                </div>
                <span className={`audit-result audit-result--${event.result.toLowerCase()}`}>
                  {event.result}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
