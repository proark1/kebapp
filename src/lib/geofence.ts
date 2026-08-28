// Abstandsrechnung fuer die Zeiterfassung. Bewusst ohne Serverbindung:
// dasselbe Ergebnis entsteht im Telefon (Anzeige "du stehst 40 m vom
// Laden entfernt") und auf dem Server (Entscheidung, ob gestempelt
// werden darf). Zwei Implementierungen wuerden frueher oder spaeter
// auseinanderlaufen.

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type StoreGeofence = Coordinate & {
  enforced: boolean;
  label: string | null;
  radiusMeters: number;
};

export type PositionFix = Coordinate & {
  accuracyMeters: number;
};

export type GeofenceVerdict =
  | { kind: "NO_FENCE" }
  | { kind: "NO_POSITION" }
  | { kind: "UNUSABLE_FIX"; accuracyMeters: number }
  | {
      kind: "INSIDE" | "OUTSIDE";
      accuracyMeters: number;
      distanceMeters: number;
    };

// Ein Handy-Fix mit mehr als einem Kilometer Streuung stammt aus der
// Funkzellenortung, nicht vom GPS. Damit laesst sich nicht beurteilen,
// ob jemand im Laden steht - so ein Wert wird verworfen statt geraten.
export const MAX_USABLE_ACCURACY_METERS = 1000;

// Die Messgenauigkeit wird der Person gutgeschrieben: wer laut Geraet
// 180 m entfernt ist, das Geraet sich dabei aber nur auf 60 m sicher
// ist, kann sehr wohl im Laden stehen. Ohne Deckel wuerde ein absichtlich
// schlechter Fix jeden Radius aushebeln.
export const MAX_ACCURACY_CREDIT_METERS = 100;

const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Grosskreisabstand zweier Punkte in Metern (Haversine). Auf den
 * Entfernungen, um die es hier geht - ein Laden und sein Parkplatz -
 * liegt der Fehler gegenueber einem Ellipsoidmodell unter einem Meter.
 */
export function distanceInMeters(from: Coordinate, to: Coordinate): number {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.sin(deltaLongitude / 2) ** 2 *
      Math.cos(fromLatitude) *
      Math.cos(toLatitude);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Entscheidet, ob ein Standortfix innerhalb des Ladenradius liegt.
 * Liefert immer auch den gerundeten Abstand, weil der selbst dann
 * dokumentiert wird, wenn der Radius gar nicht erzwungen wird.
 */
export function evaluateGeofence(
  fence: StoreGeofence | null,
  fix: PositionFix | null,
): GeofenceVerdict {
  if (!fence) return { kind: "NO_FENCE" };
  if (!fix) return { kind: "NO_POSITION" };

  const accuracyMeters = Math.max(0, Math.round(fix.accuracyMeters));
  if (accuracyMeters > MAX_USABLE_ACCURACY_METERS) {
    return { accuracyMeters, kind: "UNUSABLE_FIX" };
  }

  const distanceMeters = Math.round(distanceInMeters(fence, fix));
  const credit = Math.min(accuracyMeters, MAX_ACCURACY_CREDIT_METERS);
  const inside = distanceMeters - credit <= fence.radiusMeters;

  return {
    accuracyMeters,
    distanceMeters,
    kind: inside ? "INSIDE" : "OUTSIDE",
  };
}

/** Kurze Angabe fuer die Oberflaeche: "am Laden", "180 m entfernt". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} km`;
}
