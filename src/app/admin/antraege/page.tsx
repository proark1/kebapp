import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listRegistrationRequests } from "@/server/organizations/admin";

export const metadata: Metadata = { title: "Ladenanträge" };

const statusLabels = {
  APPROVED: "Freigegeben",
  PENDING: "Offen",
  REJECTED: "Abgelehnt",
} as const;

export default async function RegistrationRequestsPage() {
  const actor = await requirePlatformAdminPage("/admin/antraege");
  const requests = await listRegistrationRequests({ actor });

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Prüfmappe · NRW-Pilot</p>
          <h1>Ladenanträge</h1>
          <span>Persönlich prüfen, entscheiden und lückenlos dokumentieren.</span>
        </div>
        <div className="admin-file-count">{requests.length} AKTEN</div>
      </header>

      <section className="request-file" aria-label="Liste der Ladenanträge">
        <header className="request-file__columns" aria-hidden="true">
          <span>Eingang / Akte</span>
          <span>Laden</span>
          <span>Kontakt / Ort</span>
          <span>Status</span>
        </header>
        {requests.length === 0 ? (
          <p className="request-file__empty">Noch keine Anträge eingegangen.</p>
        ) : (
          <ol>
            {requests.map((request, index) => (
              <li key={request.id}>
                <Link href={`/admin/antraege/${request.id}`}>
                  <span className="request-file__index">
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    {new Intl.DateTimeFormat("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    }).format(request.createdAt)}
                  </span>
                  <span className="request-file__store">{request.storeName}</span>
                  <span className="request-file__contact">
                    {request.contactName}
                    <small>
                      {request.postalCode} {request.city}
                    </small>
                  </span>
                  <span className={`request-status request-status--${request.status.toLowerCase()}`}>
                    {statusLabels[request.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
