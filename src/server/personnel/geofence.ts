import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";
import type { StoreGeofence } from "@/lib/geofence";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { storeGeofences } from "@/server/db/schema";
import {
  type TenantTransaction,
  withTenantContext,
} from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

export const MIN_RADIUS_METERS = 25;
export const MAX_RADIUS_METERS = 5000;

export const geofenceInputSchema = z.object({
  enforced: z.boolean(),
  label: z.string().trim().max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce
    .number()
    .int()
    .min(MIN_RADIUS_METERS)
    .max(MAX_RADIUS_METERS),
});

export type GeofenceInput = z.input<typeof geofenceInputSchema>;

// Der Standortfix kommt aus `navigator.geolocation` im Browser und ist
// damit Nutzereingabe: alles wird geprueft, nichts wird uebernommen.
export const positionFixSchema = z.object({
  accuracyMeters: z.coerce.number().min(0).max(100_000),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export type PositionFixInput = z.infer<typeof positionFixSchema>;

/**
 * Liest den Standortfix aus einem Formular. Fehlende oder unbrauchbare
 * Angaben ergeben `null` - ohne GPS wird trotzdem gestempelt, der
 * Eintrag traegt dann nur keinen Abstand.
 */
export function readPositionFix(formData: FormData): PositionFixInput | null {
  const parsed = positionFixSchema.safeParse({
    accuracyMeters: formData.get("positionAccuracy"),
    latitude: formData.get("positionLatitude"),
    longitude: formData.get("positionLongitude"),
  });
  return parsed.success ? parsed.data : null;
}

export async function readGeofence(
  transaction: TenantTransaction,
  organizationId: string,
): Promise<StoreGeofence | null> {
  const [row] = await transaction
    .select({
      enforced: storeGeofences.enforced,
      label: storeGeofences.label,
      latitude: storeGeofences.latitude,
      longitude: storeGeofences.longitude,
      radiusMeters: storeGeofences.radiusMeters,
    })
    .from(storeGeofences)
    .where(eq(storeGeofences.organizationId, organizationId))
    .limit(1);

  return row ?? null;
}

export async function getStoreGeofence(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
}): Promise<StoreGeofence | null> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    (transaction) => readGeofence(transaction, organizationId),
  );
}

export async function saveStoreGeofence(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  geofence: GeofenceInput;
  organizationId: string;
  supportReason?: string;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const parsed = geofenceInputSchema.parse(input.geofence);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER"],
        organizationId,
        supportReason: input.supportReason,
      });

      const values = {
        enforced: parsed.enforced,
        label: parsed.label || null,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        radiusMeters: parsed.radiusMeters,
        updatedByUserId: input.actor.userId,
      };

      await transaction
        .insert(storeGeofences)
        .values({ ...values, organizationId })
        .onConflictDoUpdate({
          set: { ...values, updatedAt: new Date() },
          target: storeGeofences.organizationId,
        });

      // Der Radius entscheidet im scharfen Modus darueber, ob jemand
      // Arbeitszeit erfassen kann - eine Aenderung daran gehoert ins
      // Protokoll. Die Koordinate selbst nicht: sie steht in der
      // Tabelle, das Protokoll ist breiter einsehbar.
      await writeAuditEvent(transaction, {
        action: "TIME_GEOFENCE_SAVED",
        actorUserId: input.actor.userId,
        metadata: {
          enforced: parsed.enforced,
          radiusMeters: parsed.radiusMeters,
        },
        objectType: "store_geofence",
        organizationId,
      });
    },
  );
}

export async function deleteStoreGeofence(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
}): Promise<void> {
  const organizationId = procurementIdSchema.parse(input.organizationId);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER"],
        organizationId,
      });

      await transaction
        .delete(storeGeofences)
        .where(eq(storeGeofences.organizationId, organizationId));

      await writeAuditEvent(transaction, {
        action: "TIME_GEOFENCE_REMOVED",
        actorUserId: input.actor.userId,
        objectType: "store_geofence",
        organizationId,
      });
    },
  );
}
