import type { Metadata } from "next";
import { DemandPlanner } from "@/components/demand-planner";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";

export const metadata: Metadata = {
  title: "Einkauf",
};

export default async function BuyingPage() {
  const { organization } = await requireActiveOrganizationPage("/app/einkauf");
  return <DemandPlanner role={organization.role} />;
}
