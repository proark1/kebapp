import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getDemandPlanning } from "@/server/procurement/queries";

export const metadata: Metadata = {
  title: "Übersicht",
};

export default async function DashboardPage() {
  const { actor, organization } = await requireActiveOrganizationPage("/app");
  const planning = await getDemandPlanning({
    actor,
    organizationId: organization.organizationId,
  });

  return (
    <Dashboard
      operatorName={actor.name}
      organization={organization}
      planning={planning}
    />
  );
}
