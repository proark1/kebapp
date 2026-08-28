"use client";

import { Clock3, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function PendingButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? "Wird gespeichert …" : children}
    </button>
  );
}

export function ClockCard({
  clockInAction,
  clockOutAction,
  openStartedAt,
}: {
  clockInAction: () => Promise<void>;
  clockOutAction: (formData: FormData) => Promise<void>;
  openStartedAt: string | null;
}) {
  // Ohne Startwert stand die laufende Schicht bis zum ersten Client-Tick auf
  // 00:00:00. Server- und Clientuhr weichen dabei um Millisekunden ab -
  // deshalb unterdrueckt die Anzeige unten die Hydrationswarnung.
  const [elapsed, setElapsed] = useState(() =>
    openStartedAt
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(openStartedAt).getTime()) / 1000),
        )
      : 0,
  );

  useEffect(() => {
    if (!openStartedAt) return;
    const startMs = new Date(openStartedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [openStartedAt]);

  if (openStartedAt) {
    return (
      <section className="panel clock-card" aria-label="Laufende Schicht">
        <div className="clock-card__timer">
          <Clock3 size={22} aria-hidden="true" />
          <strong suppressHydrationWarning>{formatElapsed(elapsed)}</strong>
          <span>seit {new Date(openStartedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</span>
        </div>
        <form action={clockOutAction} className="clock-card__out">
          <label className="field">
            <span className="sr-only">Vermerk zur Schicht</span>
            <input
              maxLength={300}
              name="note"
              placeholder="Vermerk (optional)"
              type="text"
            />
          </label>
          <PendingButton className="button button--primary">
            <LogOut size={17} aria-hidden="true" />
            Schicht beenden
          </PendingButton>
        </form>
      </section>
    );
  }

  return (
    <section className="panel clock-card" aria-label="Zeiterfassung">
      <p className="clock-card__idle">Du bist nicht eingestempelt.</p>
      <form action={clockInAction}>
        <PendingButton className="button button--primary">
          <LogIn size={17} aria-hidden="true" />
          Arbeiten starten
        </PendingButton>
      </form>
    </section>
  );
}
