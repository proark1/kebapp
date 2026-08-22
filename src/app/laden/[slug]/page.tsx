import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Storefront } from "@/components/storefront";
import { getPublicStorefrontBySlug } from "@/server/storefront/queries";

type StorefrontPageProps = {
  params: Promise<{ slug: string }>;
};

const getPublicStorefront = cache((slug: string) =>
  getPublicStorefrontBySlug({ slug }),
);

export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await getPublicStorefront(slug);

  if (!storefront) {
    return {
      robots: { follow: false, index: false },
      title: "Laden nicht gefunden",
    };
  }

  return {
    description: storefront.profile.description,
    title: storefront.profile.name,
  };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const storefront = await getPublicStorefront(slug);
  if (!storefront) {
    notFound();
  }

  return <Storefront profile={storefront.profile} publicSlug={storefront.publicSlug} />;
}
