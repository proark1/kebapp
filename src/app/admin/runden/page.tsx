import type { Metadata } from "next";
import Link from "next/link";
import { transitionBuyingRoundAction } from "@/app/admin/runden/actions";
import { RoundCreateForm } from "@/components/admin-rounds/round-create-form";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import {
  listActiveOrganizations,
  listBuyingRounds,
} from "@/server/procurement/rounds";

export const metadata: Metadata = { title: "Sammelrunden" };

const statusLabels: Record<string, string> = {
  CANCELLED: "Storniert",
  CLOSED: "Geschlossen",
  OPEN: "Offen",
  PLANNING: "Geplant",
  SUBMITTED: "Eingereicht",
};

const meldungMessages: Record<string, string> = {
  close: "Runde geschlossen",
  cancel: "Runde storniert",
  open: "Runde geöffnet",
  "nicht-gefunden": "Aktion nicht möglich: Runde nicht gefunden",
  submit: "Menge beim Einkaufsteam eingereicht",
  uebergang: "Dieser Statuswechsel ist nicht erlaubt",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

export default async function AdminRoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const actor = await requirePlatformAdminPage("/admin/runden");
  const [rounds, organizations, query] = await Promise.all([
    listBuyingRounds({ actor }),
    listActiveOrganizations({ actor }),
    searchParams,
  ]);
  const meldung = query.meldung ? meldungMessages[query.meldung] : undefined;

  const nextActions: Record<string, Array<{
    action: "OPEN" | "CLOSE" | "SUBMIT" | "CANCEL";
    label: string;
  }>> = {
    CLOSED: [
      { action: "SUBMIT", label: "Einreichen" },
      { action: "CANCEL", label: "Stornieren" },
    ],
    OPEN: [
      { action: "CLOSE", label: "Schließen" },
      { action: "CANCEL", label: "Stornieren" },
    ],
    PLANNING: [{ action: "OPEN", label: "Öffnen" }],
  };

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Einkauf · NRW-Pilot</p>
          <h1>Sammelrunden</h1>
          <span>
            Runden anlegen, öffnen und schließen. Erinnerungen und
            automatischer Bestellschluss laufen im Hintergrund.
          </span>
        </div>
        <div className="admin-file-count">{rounds.length} RUNDEN</div>
      </header>

      {meldung ? (
        <p className="save-message save-message--neutral" role="status">
          {meldung}
        </p>
      ) : null}

      <section className="panel rounds-create-panel" aria-labelledby="create-title">
        <h2 id="create-title">Neue Sammelrunde anlegen</h2>
        <RoundCreateForm organizations={organizations} />
      </section>

      <section className="request-file" aria-label="Liste der Sammelrunden">
        <header className="request-file__columns request-file__columns--rounds" aria-hidden="true">
          <span>Runde / Region</span>
          <span>Laden</span>
          <span>Bestellschluss</span>
          <span>Status</span>
          <span>Aktionen</span>
        </header>
        {rounds.length === 0 ? (
          <p className="request-file__empty">
            Noch keine Sammelrunde angelegt.
          </p>
        ) : (
          <ol>
            {rounds.map((round) => (
              <li key={round.id}>
                <span className="request-file__store">
                  <Link href={`/admin/runden/${round.id}`}>{round.name}</Link>
                  <small>{round.regionalKey}</small>
                </span>
                <span className="rounds-cell-muted">{round.organizationName}</span>
                <span className="rounds-cell-muted">
                  {formatDate(round.closesAt)}
                  {round.status === "OPEN" && round.reminderSentAt ? (
                    <small>Erinnerung versendet</small>
                  ) : null}
                </span>
                <span className={`request-status request-status--${round.status.toLowerCase()}`}>
                  {statusLabels[round.status]}
                </span>
                <span className="rounds-actions">
                  {(nextActions[round.status] ?? []).map((transition) => (
                    <form action={transitionBuyingRoundAction} key={transition.action}>
                      <input name="action" type="hidden" value={transition.action} />
                      <input name="roundId" type="hidden" value={round.id} />
                      <button
                        className="button button--secondary button--small"
                        type="submit"
                      >
                        {transition.label}
                      </button>
                    </form>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
