import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import {
  addDemandItemAction,
  confirmDemandSubmissionAction,
  removeDemandItemAction,
  updateDemandQuantityAction,
} from "@/app/app/einkauf/actions";
import { DemandPlanner } from "@/components/demand-planner";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getDemandPlanning } from "@/server/procurement/queries";

export const metadata: Metadata = {
  title: "Einkauf",
};

export default async function BuyingPage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const [planning, query] = await Promise.all([
    getDemandPlanning({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);

  if (!planning) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <div>
            <span className="eyebrow">Gruppeneinkauf</span>
            <h1>Dein Fleischbedarf</h1>
            <p>Für deinen Laden ist aktuell keine Sammelrunde geöffnet.</p>
          </div>
        </header>
        <section className="panel empty-state procurement-empty-state">
          <CalendarX2 size={34} aria-hidden="true" />
          <h2>Die nächste Runde wird vorbereitet.</h2>
          <p>
            Sobald der Bestellschluss und das Lieferfenster feststehen, kannst du
            hier Positionen erfassen.
          </p>
        </section>
      </div>
    );
  }

  return (
    <DemandPlanner
      addAction={addDemandItemAction}
      confirmAction={confirmDemandSubmissionAction}
      messageCode={query.meldung}
      planning={planning}
      removeAction={removeDemandItemAction}
      role={organization.role}
      updateAction={updateDemandQuantityAction}
    />
  );
}
