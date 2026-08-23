import type { Metadata } from "next";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import {
  connectDomainAction,
  rejectDomainAction,
} from "@/app/admin/domains/actions";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listDomainRequests } from "@/server/storefront/admin-domains";

export const metadata: Metadata = { title: "Domains" };

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: "Europe/Berlin",
});

const meldungMessages: Record<string, string> = {
  verbunden: "Domain verbunden",
  abgelehnt: "Domain-Wunsch abgelehnt",
  ungueltig: "Bitte eine Begründung mit mindestens 10 Zeichen angeben.",
};

export default async function AdminDomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const actor = await requirePlatformAdminPage("/admin/domains");
  const [requests, query] = await Promise.all([
    listDomainRequests({ actor }),
    searchParams,
  ]);
  const meldung = query.meldung ? meldungMessages[query.meldung] : undefined;

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Webauftritt · NRW-Pilot</p>
          <h1>Domains</h1>
          <span>
            Vorgemerkte Wunsch-Domains prüfen und entscheiden. Verbindungen
            werden protokolliert.
          </span>
        </div>
        <div className="admin-file-count">{requests.length}</div>
      </header>

      {meldung ? (
        <p className="save-message save-message--neutral" role="status">
          {meldung}
        </p>
      ) : null}

      <section className="request-file request-file--domains" aria-label="Liste der Domain-Wünsche">
        <header className="request-file__columns request-file__columns--domains" aria-hidden="true">
          <span>Laden</span>
          <span>Wunsch / Status</span>
          <span>Vorgemerkt</span>
          <span>Entscheidung</span>
        </header>
        {requests.length === 0 ? (
          <p className="request-file__empty">
            Keine offenen Domain-Wünsche und keine verbundenen Domains.
          </p>
        ) : (
          <ol>
            {requests.map((request) => (
              <li key={request.organizationId}>
                <span className="request-file__store">
                  {request.name}
                  <small>/{request.publicSlug}</small>
                </span>
                <span className="rounds-cell-muted">
                  {request.status === "REVIEW_REQUESTED" ? (
                    <>
                      <Globe2 size={14} aria-hidden="true" />{" "}
                      {request.requestedDomain}
                      <small>Zur Prüfung vorgemerkt</small>
                    </>
                  ) : (
                    <>
                      ✓ {request.connectedDomain}
                      <small>Verbunden (Demo-Status)</small>
                    </>
                  )}
                </span>
                <span className="rounds-cell-muted">
                  {request.requestedAt
                    ? dateFormatter.format(request.requestedAt)
                    : "—"}
                </span>
                <span className="rounds-actions">
                  {request.status === "REVIEW_REQUESTED" ? (
                    <>
                      <form action={connectDomainAction}>
                        <input
                          name="organizationId"
                          type="hidden"
                          value={request.organizationId}
                        />
                        <button
                          className="button button--secondary button--small"
                          type="submit"
                        >
                          Verbinden
                        </button>
                      </form>
                      <details className="correction">
                        <summary>Ablehnen</summary>
                        <form action={rejectDomainAction}>
                          <input
                            name="organizationId"
                            type="hidden"
                            value={request.organizationId}
                          />
                          <label>
                            <span className="sr-only">Begründung</span>
                            <input
                              minLength={10}
                              name="reason"
                              placeholder="Grund (mindestens 10 Zeichen)"
                              required
                              type="text"
                            />
                          </label>
                          <button
                            className="button button--secondary button--small"
                            type="submit"
                          >
                            Ablehnen
                          </button>
                        </form>
                      </details>
                    </>
                  ) : (
                    <Link href={`/laden/${request.publicSlug}`} target="_blank" rel="noreferrer">
                      Seite öffnen →
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
