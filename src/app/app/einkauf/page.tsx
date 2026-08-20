import type { Metadata } from "next";
import { DemandPlanner } from "@/components/demand-planner";

export const metadata: Metadata = {
  title: "Einkauf",
};

export default function BuyingPage() {
  return <DemandPlanner />;
}
