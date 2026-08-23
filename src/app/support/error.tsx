"use client";

import { RouteErrorFallback } from "@/components/route-feedback";

export default function SupportError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorFallback context="dem Supportbereich" error={error} retry={retry} />;
}
