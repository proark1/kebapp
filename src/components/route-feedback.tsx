"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export function RouteErrorFallback({
  error,
  retry,
  context,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  context: string;
}) {
  useEffect(() => {
    console.error(`Kebapp: Fehler im Bereich ${context}.`, error);
  }, [context, error]);

  return (
    <div className="page-stack">
      <section className="panel empty-state" role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>Das hat leider nicht geklappt.</h1>
        <p>
          Im Bereich {context} ist ein unerwarteter Fehler aufgetreten. Deine
          Daten sind sicher. Versuche es erneut oder lade die Seite neu.
        </p>
        {error.digest ? (
          <p>
            <small>Fehler-Kennung: {error.digest}</small>
          </p>
        ) : null}
        <button className="button button--primary" onClick={retry} type="button">
          Erneut versuchen
        </button>
      </section>
    </div>
  );
}

export function LoadingSkeleton({
  label,
  variant = "app",
}: {
  label: string;
  variant?: "app" | "admin";
}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={variant === "admin" ? "admin-page" : "page-stack"}
    >
      <span className="sr-only">{label}</span>
      <div className="loading-shell">
        <span className="loading-skeleton loading-skeleton--title" />
        <span className="loading-skeleton loading-skeleton--text" />
        <span className="loading-skeleton loading-skeleton--text" style={{ width: "62%" }} />
        <span className="loading-skeleton loading-skeleton--panel" />
      </div>
    </div>
  );
}
