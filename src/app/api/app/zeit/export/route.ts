import { z } from "zod";
import { getOptionalSession } from "@/server/auth/session";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  resolveActiveOrganization,
} from "@/server/organizations/active-organization";
import { cookies } from "next/headers";
import { getStoreGeofence } from "@/server/personnel/geofence";
import { exportableEntries } from "@/server/personnel/timesheets";

// Der Nachweis nach Mindestlohngesetz zaehlt in Ortszeit. Vorher lief
// der Export ueber `toISOString()` und schrieb damit UTC - eine Schicht
// von 09:30 bis 18:00 stand im Sommer als 07:30 bis 16:00 in der Datei.
const berlinDate = new Intl.DateTimeFormat("sv-SE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
  year: "numeric",
});

const berlinTime = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

const rangeSchema = z.object({
  bis: z.iso.date().optional(),
  mitarbeiter: z.string().uuid().optional(),
  von: z.iso.date().optional(),
});

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function GET(request: Request): Promise<Response> {
  const actor = await getOptionalSession();
  if (!actor) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = rangeSchema.safeParse({
    bis: url.searchParams.get("bis") ?? undefined,
    mitarbeiter: url.searchParams.get("mitarbeiter") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
  });
  if (!parsed.success) {
    return new Response("Ungültiger Zeitraum.", { status: 400 });
  }

  const preferredOrganizationId = (await cookies()).get(
    ACTIVE_ORGANIZATION_COOKIE,
  )?.value;
  const resolution = await resolveActiveOrganization({
    actor,
    preferredOrganizationId,
  });
  if (resolution.kind !== "READY") {
    return new Response("Kein aktiver Laden.", { status: 403 });
  }

  const to = parsed.data.bis
    ? new Date(`${parsed.data.bis}T23:59:59Z`)
    : new Date();
  const from = parsed.data.von
    ? new Date(`${parsed.data.von}T00:00:00Z`)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [rows, geofence] = await Promise.all([
      exportableEntries({
        actor,
        from,
        organizationId: resolution.organization.organizationId,
        targetUserId: parsed.data.mitarbeiter,
        to,
      }),
      getStoreGeofence({
        actor,
        organizationId: resolution.organization.organizationId,
      }),
    ]);

    const place = (distanceMeters: number | null): string => {
      if (distanceMeters === null) return "ohne Standort";
      if (geofence && distanceMeters <= geofence.radiusMeters) return "am Laden";
      return `${distanceMeters} m entfernt`;
    };

    const lines = [
      ["Datum", "Start", "Ende", "Stunden", "Name", "Start-Ort", "Ende-Ort"].join(";"),
      ...rows.map((row) =>
        [
          berlinDate.format(row.startedAt),
          berlinTime.format(row.startedAt),
          berlinTime.format(row.endedAt),
          (row.durationMinutes / 60).toFixed(2).replace(".", ","),
          csvEscape(row.userName),
          csvEscape(place(row.startedDistanceMeters)),
          csvEscape(place(row.endedDistanceMeters)),
        ].join(";"),
      ),
    ];

    return new Response(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Disposition": 'attachment; filename="arbeitszeiten.csv"',
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    console.error("Der Zeiterfassungs-Export ist fehlgeschlagen.");
    return new Response("Export fehlgeschlagen.", { status: 500 });
  }
}
