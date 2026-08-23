"use client";

import { RouteErrorFallback } from "@/components/route-feedback";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorFallback context="dem Prüftisch" error={error} retry={retry} />;
}
