"use client";

import { Crosshair, MapPin, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatDistance, type StoreGeofence } from "@/lib/geofence";

const RADIUS_OPTIONS = [50, 100, 150, 250, 500, 1000] as const;

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button--primary" disabled={pending} type="submit">
      {pending ? "Wird gespeichert …" : "Standort speichern"}
    </button>
  );
}

/**
 * Einrichtung des Ladenstandorts. Gedacht fuer den Moment, in dem die
 * Inhaberin mit dem Telefon im Laden steht und einmal auf "Aktuellen
 * Standort übernehmen" tippt - Koordinaten von Hand einzutippen ist die
 * Ausnahme, nicht der Regelfall.
 */
export function GeofenceEditor({
  geofence,
  saveAction,
}: {
  geofence: StoreGeofence | null;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [latitude, setLatitude] = useState(
    geofence ? String(geofence.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    geofence ? String(geofence.longitude) : "",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const takeCurrentPosition = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("Dieses Gerät liefert keinen Standort.");
      return;
    }
    setLocating(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setStatus(
          `Übernommen · Messgenauigkeit ±${formatDistance(Math.round(position.coords.accuracy))}`,
        );
        setLocating(false);
      },
      (error) => {
        setStatus(
          error.code === 1
            ? "Kein Standortzugriff — bitte im Browser erlauben."
            : "Der Standort ließ sich nicht bestimmen.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  };

  return (
    <section className="panel geofence-editor" aria-labelledby="geofence-title">
      <div className="panel__header">
        <div>
          <span className="eyebrow">Nur für die Inhaberschaft</span>
          <h2 id="geofence-title">Ladenstandort für das Stempeln</h2>
          <p>
            Steht der Standort, zeigt jede Schicht, ob am Laden gestempelt
            wurde. Gespeichert wird nur der Abstand zum Laden — nie, wo eine
            Person sonst war.
          </p>
        </div>
      </div>

      <form action={saveAction} className="form-stack geofence-editor__form">
        <div className="geofence-editor__capture">
          <button
            className="button button--secondary"
            disabled={locating}
            onClick={takeCurrentPosition}
            type="button"
          >
            <Crosshair size={17} aria-hidden="true" />
            {locating ? "Standort wird gemessen …" : "Aktuellen Standort übernehmen"}
          </button>
          {status ? <small>{status}</small> : null}
        </div>

        <div className="form-grid form-grid--three">
          <label className="field">
            <span>Breitengrad</span>
            <input
              inputMode="decimal"
              name="latitude"
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="51.194000"
              required
              value={latitude}
            />
          </label>
          <label className="field">
            <span>Längengrad</span>
            <input
              inputMode="decimal"
              name="longitude"
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="6.441600"
              required
              value={longitude}
            />
          </label>
          <label className="field">
            <span>Erlaubter Umkreis</span>
            <select defaultValue={String(geofence?.radiusMeters ?? 150)} name="radiusMeters">
              {RADIUS_OPTIONS.map((meters) => (
                <option key={meters} value={meters}>
                  {formatDistance(meters)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Bezeichnung (optional)</span>
          <input
            defaultValue={geofence?.label ?? ""}
            maxLength={180}
            name="label"
            placeholder="Ladentheke Hauptstraße"
          />
        </label>

        <label className="geofence-editor__switch">
          <input
            defaultChecked={geofence?.enforced ?? false}
            name="enforced"
            type="checkbox"
          />
          <span>
            <strong>Stempeln nur am Laden zulassen</strong>
            <small>
              Aus: Der Abstand wird nur vermerkt. An: Außerhalb des Umkreises
              wird das Stempeln abgelehnt — auch wenn das Telefon gar keinen
              Standort liefert.
            </small>
          </span>
        </label>

        <div className="receipt-form__footer">
          {geofence ? (
            <button
              className="button button--quiet"
              name="intent"
              type="submit"
              value="entfernen"
            >
              <Trash2 size={16} aria-hidden="true" />
              Standort entfernen
            </button>
          ) : null}
          <SaveButton />
        </div>
      </form>

      {geofence ? (
        <p className="geofence-editor__current">
          <MapPin size={15} aria-hidden="true" />
          Aktiv: Umkreis {formatDistance(geofence.radiusMeters)}
          {geofence.enforced
            ? " · Stempeln außerhalb wird abgelehnt"
            : " · Abstand wird nur vermerkt"}
        </p>
      ) : null}
    </section>
  );
}
