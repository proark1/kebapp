import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";

export const metadata: Metadata = {
  title: "Übersicht",
};

export default async function DashboardPage() {
  const { actor, organization } = await requireActiveOrganizationPage("/app");

  return (
    <Dashboard
      operatorName={actor.name}
      organization={organization}
    />
  );
}
