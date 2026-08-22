import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { StorefrontLegalPage } from "@/components/storefront-legal-page";
import { getPublicStorefrontBySlug } from "@/server/storefront/queries";

type LegalPageProps = { params: Promise<{ slug: string }> };
const getStorefront = cache((slug: string) => getPublicStorefrontBySlug({ slug }));

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const storefront = await getStorefront((await params).slug);
  return {
    robots: { follow: false, index: false },
    title: storefront ? `Impressum · ${storefront.profile.name}` : "Impressum",
  };
}

export default async function ImprintPage({ params }: LegalPageProps) {
  const storefront = await getStorefront((await params).slug);
  if (!storefront) notFound();
  return <StorefrontLegalPage kind="impressum" profile={storefront.profile} publicSlug={storefront.publicSlug} />;
}
