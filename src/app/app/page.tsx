import type { Metadata } from "next";
import { Dashboard, type DashboardInvoiceSummary } from "@/components/dashboard";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { listInvoices } from "@/server/accounting/invoices";
import { getDemandPlanning } from "@/server/procurement/queries";
import { getStorefrontEditor } from "@/server/storefront/queries";

export const metadata: Metadata = {
  title: "Übersicht",
};

function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
}

/**
 * Offene Posten aus den erfassten Eingangsrechnungen. Die Buchhaltungsseite
 * rechnet dasselbe; hier wird es auf die Uebersicht durchgereicht, statt wie
 * bisher eine feste 4 anzuzeigen.
 */
function summarizeInvoices(
  invoices: ReadonlyArray<{
    dueDate: string | null;
    netCents7: number;
    netCents19: number;
    status: string;
  }>,
): DashboardInvoiceSummary {
  const today = todayIso();
  const open = invoices.filter((invoice) => invoice.status === "OFFEN");
  const openGrossCents = open.reduce(
    (sum, invoice) =>
      sum + Math.round(invoice.netCents7 * 1.07 + invoice.netCents19 * 1.19),
    0,
  );

  return {
    openCount: open.length,
    openGrossEuros: openGrossCents / 100,
    overdueCount: open.filter(
      (invoice) => invoice.dueDate !== null && invoice.dueDate < today,
    ).length,
  };
}

export default async function DashboardPage() {
  const { actor, organization } = await requireActiveOrganizationPage("/app");
  const [planning, storefront, invoices] = await Promise.all([
    getDemandPlanning({
      actor,
      organizationId: organization.organizationId,
    }),
    organization.role === "OWNER"
      ? getStorefrontEditor({
          actor,
          organizationId: organization.organizationId,
        })
      : Promise.resolve(null),
    listInvoices({
      actor,
      organizationId: organization.organizationId,
    }),
  ]);

  return (
    <Dashboard
      invoices={summarizeInvoices(invoices)}
      operatorName={actor.name}
      organization={organization}
      planning={planning}
      storefront={storefront}
    />
  );
}
