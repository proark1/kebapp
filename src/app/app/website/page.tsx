import type { Metadata } from "next";
import { WebsiteEditor } from "@/components/website-editor";

export const metadata: Metadata = {
  title: "Website",
};

export default function WebsitePage() {
  return <WebsiteEditor />;
}
