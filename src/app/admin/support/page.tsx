import type { Metadata } from "next";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import { listSupportAdministration } from "@/server/support/service";
import {
  assignSupportAction,
  endSupportAssignmentAction,
} from "./actions";

export const metadata: Metadata = { title: "Supporteinsätze" };

const messages: Record<string, { text: string; tone: "error" | "success" }> = {
  beendet: { text: "Supporteinsatz wurde beendet.", tone: "success" },
  doppelt: { text: "Diese aktive Zuweisung besteht bereits.", tone: "error" },
  "nicht-gefunden": {
    text: "Supportperson oder Laden wurde nicht gefunden.",
    tone: "error",
  },
  ungueltig: {
    text: "Bitte Laden, Supportperson und einen aussagekräftigen Zweck angeben.",
    tone: "error",
  },
  zugewiesen: { text: "Supporteinsatz ist aktiv.", tone: "success" },
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const actor = await requirePlatformAdminPage("/admin/support");
  const overview = await listSupportAdministration({ actor });
  const { meldung } = await searchParams;
  const message = meldung ? messages[meldung] : undefined;

  return (
    <div className="admin-page">
      <header className="admin-page__header admin-page__header--compact">
        <div>
          <p>Berechtigungsakte · NRW-Pilot</p>
          <h1>Supporteinsätze</h1>
          <span>Zuweisen statt anmelden als: Zugriff bleibt zeitlich, fachlich und personell begrenzt.</span>
        </div>
        <div className="admin-file-count">
          {overview.assignments.filter((assignment) => assignment.isLive).length} AKTIV
        </div>
      </header>

      {message ? (
        <p className={`support-message support-message--${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}

      <section className="support-admin-grid" aria-label="Supportverwaltung">
        <form action={assignSupportAction} className="support-admin-card">
          <p className="eyebrow">Neue Zuweisung</p>
          <h2>Einsatz freigeben</h2>
          <label className="field">
            <span>Laden</span>
            <select name="organizationId" required defaultValue="">
              <option value="" disabled>Laden auswählen</option>
              {overview.organizations.filter((organization) => organization.status === "ACTIVE").map((organization) => (
                <option key={organization.organizationId} value={organization.organizationId}>
                  {organization.storeName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Supportperson</span>
            <select name="supportUserId" required defaultValue="">
              <option value="" disabled>Person auswählen</option>
              {overview.supportUsers.map((supportUser) => (
                <option key={supportUser.userId} value={supportUser.userId}>
                  {supportUser.name} · {supportUser.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Zweck</span>
            <textarea
              name="purpose"
              minLength={10}
              maxLength={600}
              placeholder="Zum Beispiel: Erstaufnahme der Website und Bedarfshilfe im Pilot"
              required
            />
          </label>
          <label className="field">
            <span>Ablauf (optional)</span>
            <input name="expiresAt" type="datetime-local" />
          </label>
          <button className="button button--primary" type="submit">Einsatz aktivieren</button>
        </form>

        <div className="support-admin-card support-admin-card--rules">
          <p className="eyebrow">Leitplanken</p>
          <h2>Kein Identitätswechsel</h2>
          <ol>
            <li>Support bleibt als eigene Person angemeldet.</li>
            <li>Nur zugewiesene, aktive Läden sind sichtbar.</li>
            <li>Jede Änderung verlangt eine Begründung.</li>
            <li>Bestätigungen, Teamrollen und Admin-Prüfungen bleiben gesperrt.</li>
          </ol>
        </div>
      </section>

      <section className="support-assignment-list" aria-labelledby="assignment-title">
        <header>
          <div>
            <p className="eyebrow">Einsatzjournal</p>
            <h2 id="assignment-title">Zuweisungen und Verlauf</h2>
          </div>
          <span>{overview.assignments.length} Einträge</span>
        </header>
        {overview.assignments.length === 0 ? (
          <p className="request-file__empty">Noch keine Supporteinsätze angelegt.</p>
        ) : (
          <ol>
            {overview.assignments.map((assignment) => {
              const live = assignment.isLive;
              return (
                <li key={assignment.assignmentId}>
                  <div>
                    <span className={`support-live-dot support-live-dot--${live ? "active" : "ended"}`}>
                      {live ? "Aktiv" : assignment.status === "ENDED" ? "Beendet" : "Abgelaufen"}
                    </span>
                    <h3>{assignment.storeName}</h3>
                    <p>{assignment.supportName}</p>
                    <small>
                      {assignment.purpose ?? "Kein Zweck dokumentiert"}
                      {assignment.expiresAt
                        ? ` · bis ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(assignment.expiresAt))}`
                        : " · ohne automatisches Ablaufdatum"}
                    </small>
                  </div>
                  {live ? (
                    <form action={endSupportAssignmentAction}>
                      <input type="hidden" name="assignmentId" value={assignment.assignmentId} />
                      <input type="hidden" name="organizationId" value={assignment.organizationId} />
                      <label className="field">
                        <span>Grund für Beendigung</span>
                        <input name="reason" minLength={10} maxLength={600} required />
                      </label>
                      <button className="button button--secondary" type="submit">Einsatz beenden</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
