import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Download } from "lucide-react";
import {
  clockInAction,
  clockOutAction,
  correctTimeEntryAction,
} from "@/app/app/zeit/actions";
import { ClockCard } from "@/components/clock-card";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  listRecentTimeEntries,
  listTeamMembers,
} from "@/server/personnel/timesheets";

export const metadata: Metadata = { title: "Zeit" };

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

const messages: Record<string, { text: string; tone: "error" | "success" }> = {
  beendet: { text: "Schicht beendet", tone: "success" },
  gestartet: { text: "Schicht gestartet", tone: "success" },
  korrigiert: { text: "Eintrag korrigiert", tone: "success" },
  "keine-offene": {
    text: "Es läuft gerade keine Schicht",
    tone: "error",
  },
  "laeuft-bereits": { text: "Es läuft bereits eine Schicht", tone: "error" },
  "nicht-gefunden": { text: "Eintrag nicht gefunden", tone: "error" },
  ungueltig: { text: "Bitte prüfe Start und Ende.", tone: "error" },
};

function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

export default async function ZeitPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string; mitarbeiter?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage("/app/zeit");
  const query = await searchParams;
  const isManager = organization.role === "OWNER";

  const [entries, teamMembers] = await Promise.all([
    listRecentTimeEntries({
      actor,
      organizationId: organization.organizationId,
      targetUserId: query.mitarbeiter,
    }),
    isManager
      ? listTeamMembers({
          actor,
          organizationId: organization.organizationId,
        })
      : Promise.resolve([]),
  ]);

  const openEntry = entries.find((entry) => entry.endedAt === null) ?? null;
  const message = query.meldung ? messages[query.meldung] : undefined;
  const exportQuery = new URLSearchParams({ von: "", bis: "" });
  void exportQuery;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Personal</span>
          <h1>Zeiterfassung</h1>
          <p>
            Arbeitszeiten für den Mindestlohn-Nachweis — pro Person sauber
            dokumentiert und exportierbar.
          </p>
        </div>
        <a
          className="button button--secondary"
          download="arbeitszeiten.csv"
          href={`/api/app/zeit/export${query.mitarbeiter ? `?mitarbeiter=${query.mitarbeiter}` : ""}`}
        >
          <Download size={17} aria-hidden="true" />
          CSV exportieren
        </a>
      </header>

      <ClockCard
        clockInAction={clockInAction}
        clockOutAction={clockOutAction}
        openStartedAt={openEntry ? openEntry.startedAt.toISOString() : null}
      />

      {message ? (
        <p className={`save-message save-message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      {isManager ? (
        <nav className="team-filter" aria-label="Teamfilter">
          <Link
            className={!query.mitarbeiter ? "chip chip--active" : "chip"}
            href="/app/zeit"
          >
            Ganzes Team
          </Link>
          {teamMembers.map((member) => (
            <Link
              className={
                query.mitarbeiter === member.userId ? "chip chip--active" : "chip"
              }
              href={`/app/zeit?mitarbeiter=${member.userId}`}
              key={member.userId}
            >
              {member.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Letzte 14 Tage</span>
            <h2>Arbeitszeiten</h2>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="request-file__empty">Noch keine Zeiten erfasst.</p>
        ) : (
          <div className="demand-table-wrap">
            <table className="demand-table time-table">
              <thead>
                <tr>
                  <th>Wer</th>
                  <th>Start</th>
                  <th>Ende</th>
                  <th>Dauer</th>
                  <th>Vermerk</th>
                  <th>
                    <span className="sr-only">Korrektur</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.entryId}>
                    <td data-label="Wer">{isManager ? entry.userName : "Du"}</td>
                    <td data-label="Start">
                      {dateTimeFormatter.format(entry.startedAt)}
                    </td>
                    <td data-label="Ende">
                      {entry.endedAt
                        ? dateTimeFormatter.format(entry.endedAt)
                        : (
                          <>
                            <Clock3 size={14} aria-hidden="true" /> läuft
                          </>
                        )}
                    </td>
                    <td data-label="Dauer">
                      {entry.durationMinutes === null
                        ? "—"
                        : formatDuration(entry.durationMinutes)}
                    </td>
                    <td data-label="Vermerk">
                      {entry.note ?? "—"}
                      {entry.corrected ? <small>korrigiert</small> : null}
                    </td>
                    <td>
                      {isManager && entry.endedAt ? (
                        <details className="correction">
                          <summary>Korrigieren</summary>
                          <form action={correctTimeEntryAction}>
                            <input
                              name="entryId"
                              type="hidden"
                              value={entry.entryId}
                            />
                            <label>
                              <span className="sr-only">Neuer Start</span>
                              <input
                                defaultValue={new Date(entry.startedAt)
                                  .toISOString()
                                  .slice(0, 16)}
                                name="startedAt"
                                required
                                type="datetime-local"
                              />
                            </label>
                            <label>
                              <span className="sr-only">Neues Ende</span>
                              <input
                                defaultValue={entry.endedAt
                                  .toISOString()
                                  .slice(0, 16)}
                                name="endedAt"
                                required
                                type="datetime-local"
                              />
                            </label>
                            <label>
                              <span className="sr-only">Vermerk</span>
                              <input
                                maxLength={300}
                                name="note"
                                placeholder="Anlass (optional)"
                                type="text"
                              />
                            </label>
                            <button
                              className="button button--secondary button--small"
                              type="submit"
                            >
                              Speichern
                            </button>
                          </form>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
