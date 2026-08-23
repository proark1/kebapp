"use client";

import { RouteErrorFallback } from "@/components/route-feedback";

export default function StoreAppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RouteErrorFallback context="deinem Ladenkonto" error={error} retry={retry} />;
}
