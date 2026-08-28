"use client";

import { Clock3, LogIn, LogOut, MapPin, MapPinOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  evaluateGeofence,
  formatDistance,
  type StoreGeofence,
} from "@/lib/geofence";

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

type Fix = { accuracyMeters: number; latitude: number; longitude: number };

type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "denied" }
  | { status: "unavailable"; message: string }
  | { status: "ready"; fix: Fix };

// Ein Standortfix altert: wer vor zehn Minuten am Laden stand, steht
// jetzt vielleicht am Bahnhof. Vor dem Stempeln wird deshalb neu
// gemessen, wenn der letzte Wert aelter ist als das hier.
const FIX_MAX_AGE_MS = 60_000;

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

function toFix(position: GeolocationPosition): Fix {
  return {
    accuracyMeters: position.coords.accuracy,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

function describeFailure(code: number | undefined): LocationState {
  if (code === 1) return { status: "denied" };
  return {
    message:
      code === 3
        ? "Der Standort ließ sich nicht rechtzeitig bestimmen."
        : "Dieses Gerät liefert keinen Standort.",
    status: "unavailable",
  };
}

/**
 * Meldet den Standort einmalig ueber Rueckrufe und liefert eine
 * Abmeldefunktion - die Form, in der ein Effekt eine Aussenwelt anbinden
 * soll. Fehlt die Schnittstelle ganz (unsicherer Kontext), meldet sich
 * der Fehlerrueckruf im naechsten Tick, damit der Aufrufer im
 * Effektkoerper nichts synchron setzen muss.
 */
function observePosition(
  onFix: (fix: Fix) => void,
  onFailure: (state: LocationState) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const timer = setTimeout(() => onFailure(describeFailure(undefined)), 0);
    return () => clearTimeout(timer);
  }

  let cancelled = false;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (!cancelled) onFix(toFix(position));
    },
    (error) => {
      if (!cancelled) onFailure(describeFailure(error.code));
    },
    GEO_OPTIONS,
  );
  return () => {
    cancelled = true;
  };
}

function requestPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toFix(position)),
      (error) => reject(error),
      GEO_OPTIONS,
    );
  });
}

function PendingButton({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending || disabled} type="submit">
      {pending ? "Wird gespeichert …" : children}
    </button>
  );
}

function GeofenceHint({
  geofence,
  location,
  onRetry,
}: {
  geofence: StoreGeofence;
  location: LocationState;
  onRetry: () => void;
}) {
  if (location.status === "locating") {
    return (
      <p className="clock-card__location clock-card__location--pending">
        <MapPin size={15} aria-hidden="true" />
        Standort wird bestimmt …
      </p>
    );
  }

  if (location.status === "denied" || location.status === "unavailable") {
    return (
      <p className="clock-card__location clock-card__location--warn">
        <MapPinOff size={15} aria-hidden="true" />
        {location.status === "denied"
          ? "Kein Standortzugriff."
          : location.message}
        {geofence.enforced
          ? " Dieser Laden verlangt das Stempeln vor Ort. "
          : " Die Schicht wird ohne Standort vermerkt. "}
        <button className="text-link" onClick={onRetry} type="button">
          Erneut versuchen
        </button>
      </p>
    );
  }

  if (location.status !== "ready") return null;

  const verdict = evaluateGeofence(geofence, location.fix);
  if (verdict.kind === "UNUSABLE_FIX") {
    return (
      <p className="clock-card__location clock-card__location--warn">
        <MapPinOff size={15} aria-hidden="true" />
        Das Signal ist zu ungenau (±{formatDistance(verdict.accuracyMeters)}).{" "}
        <button className="text-link" onClick={onRetry} type="button">
          Erneut messen
        </button>
      </p>
    );
  }

  if (verdict.kind !== "INSIDE" && verdict.kind !== "OUTSIDE") return null;

  return (
    <p
      className={`clock-card__location clock-card__location--${verdict.kind === "INSIDE" ? "ok" : "warn"}`}
    >
      <MapPin size={15} aria-hidden="true" />
      {verdict.kind === "INSIDE" ? (
        `Am Laden${geofence.label ? ` · ${geofence.label}` : ""} · ±${formatDistance(verdict.accuracyMeters)}`
      ) : (
        <>
          {formatDistance(verdict.distanceMeters)} vom Laden entfernt
          {geofence.enforced
            ? ` — Stempeln ist nur im Umkreis von ${formatDistance(geofence.radiusMeters)} möglich. `
            : ` — wird so vermerkt. Erlaubter Umkreis: ${formatDistance(geofence.radiusMeters)}. `}
          <button className="text-link" onClick={onRetry} type="button">
            Erneut messen
          </button>
        </>
      )}
    </p>
  );
}

/**
 * Die Standortfelder liegen im Formular, nicht im Aktionsaufruf: so
 * stempelt das Formular auch ohne JavaScript - dann eben ohne Standort.
 * Sie sind unkontrolliert, damit ein kurz vor dem Absenden nachgemessener
 * Fix noch hineingeschrieben werden kann, ohne auf ein Rendern zu warten.
 */
function PositionFields({ fix }: { fix: Fix | null }) {
  // Der Schluessel baut die Felder bei jedem neuen Fix neu auf: React
  // schreibt `defaultValue` nicht in ein bereits vorhandenes Feld, der
  // erste Standort waere sonst nie im Formular gelandet.
  const key = fix
    ? `${fix.latitude},${fix.longitude},${Math.round(fix.accuracyMeters)}`
    : "ohne";
  return (
    <div hidden key={key}>
      <input
        data-position="latitude"
        defaultValue={fix ? String(fix.latitude) : ""}
        name="positionLatitude"
        type="hidden"
      />
      <input
        data-position="longitude"
        defaultValue={fix ? String(fix.longitude) : ""}
        name="positionLongitude"
        type="hidden"
      />
      <input
        data-position="accuracy"
        defaultValue={fix ? String(Math.round(fix.accuracyMeters)) : ""}
        name="positionAccuracy"
        type="hidden"
      />
    </div>
  );
}

function writeFixInto(form: HTMLFormElement, fix: Fix | null): void {
  const set = (key: string, value: string) => {
    const field = form.querySelector<HTMLInputElement>(`[data-position="${key}"]`);
    if (field) field.value = value;
  };
  set("latitude", fix ? String(fix.latitude) : "");
  set("longitude", fix ? String(fix.longitude) : "");
  set("accuracy", fix ? String(Math.round(fix.accuracyMeters)) : "");
}

export function ClockCard({
  clockInAction,
  clockOutAction,
  geofence,
  openStartedAt,
}: {
  clockInAction: (formData: FormData) => Promise<void>;
  clockOutAction: (formData: FormData) => Promise<void>;
  geofence: StoreGeofence | null;
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
  // Ohne hinterlegten Ladenstandort wird gar nicht erst nach dem Standort
  // gefragt - eine Berechtigungsabfrage ohne Zweck.
  const [location, setLocation] = useState<LocationState>(() =>
    geofence ? { status: "locating" } : { status: "idle" },
  );
  // Zeitpunkt der letzten Messung - auch einer fehlgeschlagenen. Sonst
  // gilt der Fix beim erneuten Absenden wieder als veraltet und die
  // Messung liefe im Kreis.
  const measuredAt = useRef(0);
  // `handleSubmit` schickt das Formular nach der Nachmessung selbst ab.
  // Dieser Durchlauf darf nicht noch einmal messen wollen.
  const resubmitting = useRef(false);

  useEffect(() => {
    if (!openStartedAt) return;
    const startMs = new Date(openStartedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [openStartedAt]);

  useEffect(() => {
    if (!geofence) return;
    return observePosition(
      (fix) => {
        measuredAt.current = Date.now();
        setLocation({ fix, status: "ready" });
      },
      (failure) => {
        measuredAt.current = Date.now();
        setLocation(failure);
      },
    );
  }, [geofence]);

  const retry = useCallback(() => {
    setLocation({ status: "locating" });
    observePosition(
      (fix) => {
        measuredAt.current = Date.now();
        setLocation({ fix, status: "ready" });
      },
      (failure) => {
        measuredAt.current = Date.now();
        setLocation(failure);
      },
    );
  }, []);

  const fix = location.status === "ready" ? location.fix : null;

  /**
   * Ist der letzte Fix zu alt, wird vor dem Absenden neu gemessen. Der
   * neue Wert geht direkt in die Formularfelder - auf ein Rendern zu
   * warten wuerde den alten Standort mitschicken.
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (resubmitting.current) {
      resubmitting.current = false;
      return;
    }
    if (!geofence || location.status !== "ready") return;
    if (Date.now() - measuredAt.current <= FIX_MAX_AGE_MS) return;

    event.preventDefault();
    const form = event.currentTarget;
    void requestPosition()
      .then((fresh) => {
        setLocation({ fix: fresh, status: "ready" });
        writeFixInto(form, fresh);
      })
      .catch((error: unknown) => {
        setLocation(
          describeFailure((error as GeolocationPositionError | undefined)?.code),
        );
        writeFixInto(form, null);
      })
      .finally(() => {
        measuredAt.current = Date.now();
        resubmitting.current = true;
        form.requestSubmit();
      });
  };

  const verdict = geofence ? evaluateGeofence(geofence, fix) : null;
  const blocked =
    geofence?.enforced === true && verdict !== null && verdict.kind !== "INSIDE";

  const hint = geofence ? (
    <GeofenceHint geofence={geofence} location={location} onRetry={retry} />
  ) : null;

  if (openStartedAt) {
    return (
      <section className="panel clock-card" aria-label="Laufende Schicht">
        <div className="clock-card__timer">
          <Clock3 size={22} aria-hidden="true" />
          <div>
            <strong suppressHydrationWarning>{formatElapsed(elapsed)}</strong>
            <span>
              seit{" "}
              {new Date(openStartedAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Uhr
            </span>
          </div>
        </div>
        <form action={clockOutAction} className="clock-card__out" onSubmit={handleSubmit}>
          <PositionFields fix={fix} />
          <label className="field">
            <span className="sr-only">Vermerk zur Schicht</span>
            <input
              maxLength={300}
              name="note"
              placeholder="Vermerk (optional)"
              type="text"
            />
          </label>
          <PendingButton className="button button--primary" disabled={blocked}>
            <LogOut size={17} aria-hidden="true" />
            Schicht beenden
          </PendingButton>
        </form>
        {hint}
      </section>
    );
  }

  return (
    <section className="panel clock-card" aria-label="Zeiterfassung">
      <p className="clock-card__idle">Du bist nicht eingestempelt.</p>
      <form action={clockInAction} onSubmit={handleSubmit}>
        <PositionFields fix={fix} />
        <PendingButton className="button button--primary" disabled={blocked}>
          <LogIn size={17} aria-hidden="true" />
          Arbeiten starten
        </PendingButton>
      </form>
      {hint}
    </section>
  );
}
