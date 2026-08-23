"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Kebapp: unbehandelter Anwendungsfehler.", error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          alignItems: "center",
          background: "#f3f5ef",
          color: "#132019",
          display: "flex",
          fontFamily:
            "'Figtree Variable', 'Segoe UI', system-ui, sans-serif",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <main
          role="alert"
          style={{
            background: "#fff",
            border: "1px solid #dce2da",
            borderRadius: 18,
            maxWidth: 460,
            padding: "34px 30px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, margin: "0 0 10px" }}>
            Da ist etwas schiefgegangen.
          </h1>
          <p style={{ color: "#66736b", lineHeight: 1.55, margin: "0 0 20px" }}>
            Die Anwendung konnte diesen Bereich nicht darstellen. Deine Daten
            sind sicher.
          </p>
          <button
            onClick={retry}
            style={{
              background: "#1f6b4f",
              border: 0,
              borderRadius: 999,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              padding: "12px 22px",
            }}
            type="button"
          >
            Erneut versuchen
          </button>
        </main>
      </body>
    </html>
  );
}
