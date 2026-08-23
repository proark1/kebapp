import type { Metadata } from "next";
import Link from "next/link";
import { saveHygieneAction } from "@/app/app/hygiene/actions";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  getHygieneDay,
  HygieneDateLockedError,
  listRecentHygieneDays,
} from "@/server/hygiene/service";

export const metadata: Metadata = { title: "Hygiene" };

const dayFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
});

function shiftDate(isoDate: string, days: number): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(new Date(`${isoDate}T12:00:00Z`).getTime() + days * 86_400_000),
  );
}

function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
}

export default async function HygienePage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string; meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/hygiene",
  );
  const query = await searchParams;
  const date = query.datum && /^\d{4}-\d{2}-\d{2}$/.test(query.datum)
    ? query.datum
    : todayIso();

  let day;
  try {
    day = await getHygieneDay({
      actor,
      date,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    if (error instanceof HygieneDateLockedError) {
      return (
        <div className="page-stack">
          <p className="save-message save-message--error" role="alert">
            Ältere Tage können nicht geändert werden.
          </p>
          <Link className="button button--secondary" href="/app/hygiene">
            Zu heute
          </Link>
        </div>
      );
    }
    throw error;
  }

  const history = await listRecentHygieneDays({
    actor,
    organizationId: organization.organizationId,
  });
  const message =
    query.meldung === "gespeichert"
      ? "Hygiene-Check gespeichert"
      : query.meldung === "begruendung"
        ? "Bei Mängeln ist eine Bemerkung erforderlich."
        : query.meldung === "gesperrt"
          ? "Dieser Tag ist bereits gesperrt."
          : null;

  const defectCount = day.items.filter((item) => item.status === "MANGEL").length;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">Hygiene · HACCP</span>
          <h1>Tages-Check</h1>
          <p>Fünf Prüfpunkte und beide Kühltemperaturen — jeden Tag dokumentiert.</p>
        </div>
        <nav className="team-filter" aria-label="Tag wählen">
          <Link
            className="chip"
            href={`/app/hygiene?datum=${shiftDate(date, -1)}`}
          >
            ← Vortag
          </Link>
          <span className="chip chip--active">{dayFormatter.format(new Date(`${date}T12:00:00Z`))}</span>
          <Link
            className="chip"
            href={`/app/hygiene?datum=${shiftDate(date, 1)}`}
            aria-disabled={date >= todayIso()}
          >
            Folgetag →
          </Link>
        </nav>
      </header>

      {message ? (
        <p
          className={`save-message save-message--${query.meldung === "gespeichert" ? "success" : "error"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <form action={saveHygieneAction} className="form-stack panel hygiene-form">
        <input name="date" type="hidden" value={date} />
        <div className="demand-table-wrap">
          <table className="demand-table hygiene-table">
            <thead>
              <tr>
                <th>Prüfpunkt</th>
                <th>Angabe</th>
                <th>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {day.items.map((item) => (
                <tr key={item.key}>
                  <td data-label="Prüfpunkt">
                    <strong>{item.label}</strong>
                    {item.targetLabel ? <small>{item.targetLabel}</small> : null}
                  </td>
                  <td data-label="Angabe">
                    <input
                      aria-hidden="true"
                      hidden
                      name={`kind-${item.key}`}
                      value={item.kind}
                    />
                    {item.kind === "CHECK" ? (
                      <fieldset className="hygiene-status">
                        <label>
                          <input
                            checked={item.status !== "MANGEL"}
                            name={`item-${item.key}`}
                            type="radio"
                            value="OK"
                          />
                          OK
                        </label>
                        <label>
                          <input
                            checked={item.status === "MANGEL"}
                            name={`item-${item.key}`}
                            type="radio"
                            value="MANGEL"
                          />
                          Mangel
                        </label>
                      </fieldset>
                    ) : (
                      <>
                        <input
                          aria-label={`${item.label} Temperatur in Celsius`}
                          inputMode="decimal"
                          max="60"
                          min="-40"
                          name={`item-${item.key}`}
                          required
                          step="0.1"
                          type="number"
                          defaultValue={item.valueCelsius ?? ""}
                        />{" "}
                        °C
                      </>
                    )}
                  </td>
                  <td data-label="Bemerkung">
                    <input
                      aria-label={`Bemerkung zu ${item.label}`}
                      maxLength={300}
                      name={`note-${item.key}`}
                      defaultValue={item.note}
                      placeholder={
                        item.status === "MANGEL" || item.warnAboveCelsius !== undefined
                          ? "Pflicht bei Mangel"
                          : undefined
                      }
                      type="text"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="field">
          <span>Tagesbemerkung (optional)</span>
          <textarea defaultValue={day.note} maxLength={1000} name="entryNote" rows={2} />
        </label>

        {defectCount > 0 ? (
          <p className="save-message save-message--error" role="alert">
            {defectCount} Mangel — bitte je Zeile kurz begründen.
          </p>
        ) : null}

        <div className="receipt-form__footer">
          <button className="button button--primary" type="submit">
            Tages-Check speichern
          </button>
        </div>
      </form>

      <section className="panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Rückblick</span>
            <h2>Letzte 14 Tage</h2>
          </div>
        </div>
        <ul className="hygiene-history" aria-label="Historie">
          {history.map((entry) => (
            <li key={entry.date}>
              <Link
                className={
                  entry.defectCount > 0
                    ? "chip chip--danger"
                    : "chip chip--ok"
                }
                href={`/app/hygiene?datum=${entry.date}`}
              >
                {dayFormatter.format(new Date(`${entry.date}T12:00:00Z`))}
                <small>{entry.defectCount > 0 ? `${entry.defectCount} Mangel` : "OK"}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
