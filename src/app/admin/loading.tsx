import { LoadingSkeleton } from "@/components/route-feedback";

export default function AdminLoading() {
  return (
    <LoadingSkeleton label="Prüftisch wird geladen" variant="admin" />
  );
}
