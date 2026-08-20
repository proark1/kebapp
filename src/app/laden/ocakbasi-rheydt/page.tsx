import type { Metadata } from "next";
import { Storefront } from "@/components/storefront";
import { demoStoreProfile } from "@/lib/demo-data";

export const metadata: Metadata = {
  title: "Ocakbaşı Rheydt",
  description:
    "Drehspieß, frisches Gemüse und hausgemachte Saucen mitten in Rheydt.",
};

export default function StorefrontPage() {
  return <Storefront initialProfile={demoStoreProfile} />;
}
