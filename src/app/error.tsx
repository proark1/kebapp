"use client";

import { RouteErrorFallback } from "@/components/route-feedback";

export default function AppRootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorFallback context="der Anwendung" error={error} retry={retry} />;
}
