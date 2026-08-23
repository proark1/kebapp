import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listStoreDirectory } from "@/server/organizations/directory";

export const metadata: Metadata = { title: "Läden" };

const statusLabels: Record<string, string> = {
  ACTIVE: "Aktiv",
  PENDING: "In Prüfung",
  REJECTED: "Abgelehnt",
  SUSPENDED: "Gesperrt",
};

const roundLabels: Record<string, string> = {
  CANCELLED: "Storniert",
  CLOSED: "Geschlossen",
  OPEN: "Offen",
  PLANNING: "Geplant",
  SUBMITTED: "Eingereicht",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

export default async function AdminStoreDirectoryPage() {
  const actor = await requirePlatformAdminPage("/admin/laeden");
  const stores = await listStoreDirectory({ actor });
  const activeCount = stores.filter((store) => store.status === "ACTIVE").length;

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Pilot NRW · Bestandsaufnahme</p>
          <h1>Läden</h1>
          <span>
            Alle Betriebe im Piloten mit Teamgröße, Website-Status und
            neuester Sammelrunde.
          </span>
        </div>
        <div className="admin-file-count">{activeCount} AKTIV</div>
      </header>

      <section className="request-file" aria-label="Liste der Läden">
        <header className="request-file__columns request-file__columns--directory" aria-hidden="true">
          <span>Laden</span>
          <span>Status</span>
          <span>Team / Website</span>
          <span>Neueste Runde</span>
          <span>Freigabe</span>
        </header>
        {stores.length === 0 ? (
          <p className="request-file__empty">Noch keine Läden im Piloten.</p>
        ) : (
          <ol>
            {stores.map((store) => (
              <li key={store.organizationId}>
                <span className="request-file__store">
                  {store.storeName}
                  <small>/{store.slug}</small>
                </span>
                <span
                  className={`request-status request-status--${statusKey(store.status)}`}
                >
                  {statusLabels[store.status]}
                </span>
                <span className="rounds-cell-muted">
                  {store.memberCount} aktiv
                  {store.websiteSlug ? (
                    <>
                      {" · "}
                      {store.websitePublished ? (
                        <Link
                          href={`/laden/${store.websiteSlug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Website live
                        </Link>
                      ) : (
                        "Website Entwurf"
                      )}
                    </>
                  ) : (
                    " · Keine Website"
                  )}
                </span>
                <span className="rounds-cell-muted">
                  {store.latestRoundStatus
                    ? `${roundLabels[store.latestRoundStatus]}${
                        store.latestRoundClosesAt
                          ? ` · bis ${dateFormatter.format(store.latestRoundClosesAt)}`
                          : ""
                      }`
                    : "Keine Teilnahme"}
                </span>
                <span className="rounds-cell-muted">
                  {store.reviewedAt
                    ? dateFormatter.format(store.reviewedAt)
                    : "—"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function statusKey(status: string): string {
  return status.toLowerCase();
}
