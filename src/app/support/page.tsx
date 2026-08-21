import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, ShieldCheck } from "lucide-react";
import { requirePlatformSupportPage } from "@/server/auth/page-guards";
import { listAssignedSupportOrganizations } from "@/server/support/service";

export const metadata: Metadata = { title: "Meine Läden" };

export default async function SupportOverviewPage() {
  const actor = await requirePlatformSupportPage("/support");
  const assignments = await listAssignedSupportOrganizations({ actor });

  return (
    <div className="support-page">
      <header className="support-page__header">
        <div>
          <p>Arbeitsliste · persönliche Zuweisungen</p>
          <h1>Meine betreuten Läden</h1>
          <span>Hier erscheinen ausschließlich aktuell freigegebene Supporteinsätze.</span>
        </div>
        <div className="support-count">
          <strong>{String(assignments.length).padStart(2, "0")}</strong>
          <span>aktiv</span>
        </div>
      </header>

      <section className="support-safety-note">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <strong>Eigene Identität bleibt sichtbar</strong>
          <p>Du kannst Bedarf und Website-Daten unterstützen. Bestellungen bestätigen, Teamrollen ändern oder Admin-Entscheidungen treffen kannst du nicht.</p>
        </div>
      </section>

      {assignments.length === 0 ? (
        <section className="support-empty">
          <Building2 size={34} aria-hidden="true" />
          <h2>Aktuell kein Einsatz zugewiesen</h2>
          <p>Ein Admin kann dir einen Laden mit Zweck und optionalem Ablaufdatum freigeben.</p>
        </section>
      ) : (
        <ol className="support-store-grid">
          {assignments.map((assignment) => (
            <li key={assignment.assignmentId}>
              <Link href={`/support/laeden/${assignment.organizationId}`}>
                <div className="support-store-card__mark">
                  {assignment.storeName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="support-live-dot support-live-dot--active">Aktiver Einsatz</span>
                  <h2>{assignment.storeName}</h2>
                  <p>{assignment.purpose ?? "Operative Unterstützung"}</p>
                  <small>
                    <CalendarClock size={15} aria-hidden="true" />
                    {assignment.expiresAt
                      ? `Freigabe bis ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(assignment.expiresAt))}`
                      : "Freigabe ohne automatisches Ablaufdatum"}
                  </small>
                </div>
                <ArrowRight size={21} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
