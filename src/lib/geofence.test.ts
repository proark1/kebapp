import { describe, expect, it } from "vitest";
import {
  distanceInMeters,
  evaluateGeofence,
  formatDistance,
  MAX_ACCURACY_CREDIT_METERS,
  type StoreGeofence,
} from "@/lib/geofence";

// Mönchengladbach, Alter Markt - die Pilotregion.
const store = { latitude: 51.194_0, longitude: 6.441_6 };

const fence: StoreGeofence = {
  ...store,
  enforced: true,
  label: "Ladentheke",
  radiusMeters: 150,
};

describe("distanceInMeters", () => {
  it("liefert null für denselben Punkt", () => {
    expect(distanceInMeters(store, store)).toBe(0);
  });

  it("rechnet einen Breitengrad in rund 111 km um", () => {
    const distance = distanceInMeters(store, {
      latitude: store.latitude + 1,
      longitude: store.longitude,
    });
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_500);
  });

  it("ist symmetrisch", () => {
    const other = { latitude: 51.2, longitude: 6.45 };
    expect(distanceInMeters(store, other)).toBeCloseTo(
      distanceInMeters(other, store),
      6,
    );
  });

  it("misst über den Nullmeridian hinweg korrekt", () => {
    const west = { latitude: 51.5, longitude: -0.001 };
    const east = { latitude: 51.5, longitude: 0.001 };
    expect(distanceInMeters(west, east)).toBeGreaterThan(100);
    expect(distanceInMeters(west, east)).toBeLessThan(200);
  });
});

describe("evaluateGeofence", () => {
  it("meldet fehlenden Ladenstandort", () => {
    expect(
      evaluateGeofence(null, { ...store, accuracyMeters: 10 }),
    ).toEqual({ kind: "NO_FENCE" });
  });

  it("meldet fehlenden Standortfix", () => {
    expect(evaluateGeofence(fence, null)).toEqual({ kind: "NO_POSITION" });
  });

  it("erkennt einen Fix an der Ladentheke als innerhalb", () => {
    const verdict = evaluateGeofence(fence, { ...store, accuracyMeters: 12 });
    expect(verdict).toEqual({
      accuracyMeters: 12,
      distanceMeters: 0,
      kind: "INSIDE",
    });
  });

  it("erkennt einen Fix weit außerhalb als außerhalb", () => {
    const verdict = evaluateGeofence(fence, {
      accuracyMeters: 15,
      latitude: 51.21,
      longitude: 6.47,
    });
    expect(verdict.kind).toBe("OUTSIDE");
    expect(verdict).toHaveProperty("distanceMeters");
    if (verdict.kind === "OUTSIDE") {
      expect(verdict.distanceMeters).toBeGreaterThan(1500);
    }
  });

  it("rechnet die Messgenauigkeit zugunsten der Person an", () => {
    // 200 m Abstand, Radius 150 m: ohne Gutschrift außerhalb, mit
    // 80 m Messstreuung liegt die Person plausibel im Laden.
    const northOf = {
      accuracyMeters: 80,
      latitude: store.latitude + 200 / 111_320,
      longitude: store.longitude,
    };
    expect(evaluateGeofence(fence, northOf).kind).toBe("INSIDE");
    expect(
      evaluateGeofence(fence, { ...northOf, accuracyMeters: 5 }).kind,
    ).toBe("OUTSIDE");
  });

  it("deckelt die Gutschrift, damit ein grober Fix den Radius nicht aushebelt", () => {
    const farOff = {
      accuracyMeters: MAX_ACCURACY_CREDIT_METERS + 400,
      latitude: store.latitude + 400 / 111_320,
      longitude: store.longitude,
    };
    expect(evaluateGeofence(fence, farOff).kind).toBe("OUTSIDE");
  });

  it("verwirft einen Fix aus der Funkzellenortung", () => {
    const verdict = evaluateGeofence(fence, {
      ...store,
      accuracyMeters: 4200,
    });
    expect(verdict).toEqual({ accuracyMeters: 4200, kind: "UNUSABLE_FIX" });
  });

  it("beurteilt auch ohne Erzwingung und liefert den Abstand", () => {
    const verdict = evaluateGeofence(
      { ...fence, enforced: false },
      { accuracyMeters: 20, latitude: 51.2, longitude: 6.4416 },
    );
    expect(verdict.kind).toBe("OUTSIDE");
    if (verdict.kind === "OUTSIDE") {
      expect(verdict.distanceMeters).toBeGreaterThan(600);
    }
  });

  it("behandelt eine negative Messgenauigkeit als null", () => {
    const verdict = evaluateGeofence(fence, {
      ...store,
      accuracyMeters: -3,
    });
    expect(verdict).toMatchObject({ accuracyMeters: 0, kind: "INSIDE" });
  });
});

describe("formatDistance", () => {
  it("schreibt Meter unter einem Kilometer aus", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("wechselt ab einem Kilometer auf Kilometer", () => {
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(2350)).toBe("2,4 km");
  });
});
