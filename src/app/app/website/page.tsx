import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { saveStorefrontAction } from "@/app/app/website/actions";
import { WebsiteEditor } from "@/components/website-editor";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import { getStorefrontEditor } from "@/server/storefront/queries";

export const metadata: Metadata = {
  title: "Website",
};

export default async function WebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ meldung?: string }>;
}) {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/website",
  );
  if (organization.role !== "OWNER") {
    redirect("/app");
  }

  const [editor, query] = await Promise.all([
    getStorefrontEditor({
      actor,
      organizationId: organization.organizationId,
    }),
    searchParams,
  ]);

  return (
    <WebsiteEditor
      initialData={editor}
      messageCode={query.meldung}
      saveAction={saveStorefrontAction}
    />
  );
}
