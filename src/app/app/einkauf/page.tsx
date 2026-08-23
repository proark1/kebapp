import type { Metadata } from "next";
import { CalendarX2 } from "lucide-react";
import {
  addDemandItemAction,
  applyDemandTemplateAction,
  confirmDemandSubmissionAction,
  removeDemandItemQuietAction,
  saveDemandTemplateAction,
  updateDemandQuantityAction,
  updateDemandQuantityQuietAction,
} from "@/app/app/einkauf/actions";
import { DemandPlanner } from "@/components/demand-planner";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getDemandPlanning } from "@/server/procurement/queries";
import { getDemandTemplateSummary } from "@/server/procurement/templates";
import { isPublicDemo } from "@/server/demo/demo-mode";

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
  const [planning, templateSummary, query] = await Promise.all([
    getDemandPlanning({
      actor,
      organizationId: organization.organizationId,
    }),
    getDemandTemplateSummary({
      actor,
      organizationId: organization.organizationId,
    }).catch(() => null),
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
      applyTemplateAction={applyDemandTemplateAction}
      confirmAction={confirmDemandSubmissionAction}
      demoMode={isPublicDemo()}
      messageCode={query.meldung}
      planning={planning}
      removeQuietAction={removeDemandItemQuietAction}
      role={organization.role}
      saveTemplateAction={saveDemandTemplateAction}
      templateItemCount={templateSummary?.itemCount ?? 0}
      updateAction={updateDemandQuantityAction}
      updateQuietAction={updateDemandQuantityQuietAction}
    />
  );
}
