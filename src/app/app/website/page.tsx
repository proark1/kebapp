import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WebsiteEditor } from "@/components/website-editor";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";

export const metadata: Metadata = {
  title: "Website",
};

export default async function WebsitePage() {
  const { organization } = await requireActiveOrganizationPage("/app/website");
  if (organization.role !== "OWNER") {
    redirect("/app");
  }

  return <WebsiteEditor />;
}
