import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getDemandPlanning } from "@/server/procurement/queries";
import { getStorefrontEditor } from "@/server/storefront/queries";

export const metadata: Metadata = {
  title: "Übersicht",
};

export default async function DashboardPage() {
  const { actor, organization } = await requireActiveOrganizationPage("/app");
  const [planning, storefront] = await Promise.all([
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
  ]);

  return (
    <Dashboard
      operatorName={actor.name}
      organization={organization}
      planning={planning}
      storefront={storefront}
    />
  );
}
