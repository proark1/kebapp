"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  deleteStoreGeofence,
  geofenceInputSchema,
  readPositionFix,
  saveStoreGeofence,
} from "@/server/personnel/geofence";
import {
  clockIn,
  clockOut,
  NoOpenTimeEntryError,
  OutsideGeofenceError,
  TimeEntryAlreadyOpenError,
  TimeEntryNotFoundError,
  correctTimeEntry,
} from "@/server/personnel/timesheets";

function value(formData: FormData, name: string): string {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate : "";
}

export async function clockInAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage("/app/zeit");
  try {
    await clockIn({
      actor,
      organizationId: organization.organizationId,
      position: readPositionFix(formData),
    });
  } catch (error) {
    if (error instanceof TimeEntryAlreadyOpenError) {
      redirect("/app/zeit?meldung=laeuft-bereits");
    }
    if (error instanceof OutsideGeofenceError) {
      redirect("/app/zeit?meldung=ausserhalb");
    }
    throw error;
  }
  revalidatePath("/app/zeit");
  revalidatePath("/app");
  redirect("/app/zeit?meldung=gestartet");
}

export async function clockOutAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage("/app/zeit");
  try {
    await clockOut({
      actor,
      note: value(formData, "note") || undefined,
      organizationId: organization.organizationId,
      position: readPositionFix(formData),
    });
  } catch (error) {
    if (error instanceof NoOpenTimeEntryError) {
      redirect("/app/zeit?meldung=keine-offene");
    }
    if (error instanceof OutsideGeofenceError) {
      redirect("/app/zeit?meldung=ausserhalb");
    }
    throw error;
  }
  revalidatePath("/app/zeit");
  revalidatePath("/app");
  redirect("/app/zeit?meldung=beendet");
}

const correctionSchema = z
  .object({
    endedAt: z.string().min(1),
    entryId: z.string().uuid(),
    note: z.string().trim().max(300).optional(),
    startedAt: z.string().min(1),
  })
  .refine((value) => new Date(value.endedAt) > new Date(value.startedAt), {
    message: "Das Ende muss nach dem Start liegen.",
    path: ["endedAt"],
  });

export async function correctTimeEntryAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage("/app/zeit");
  const parsed = correctionSchema.safeParse({
    endedAt: value(formData, "endedAt"),
    entryId: value(formData, "entryId"),
    note: value(formData, "note") || undefined,
    startedAt: value(formData, "startedAt"),
  });
  if (!parsed.success) {
    redirect("/app/zeit?meldung=ungueltig");
  }

  try {
    await correctTimeEntry({
      actor,
      correction: parsed.data,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    if (error instanceof TimeEntryNotFoundError) {
      redirect("/app/zeit?meldung=nicht-gefunden");
    }
    throw error;
  }
  revalidatePath("/app/zeit");
  redirect("/app/zeit?meldung=korrigiert");
}

export async function saveGeofenceAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage("/app/zeit");

  if (value(formData, "intent") === "entfernen") {
    await deleteStoreGeofence({
      actor,
      organizationId: organization.organizationId,
    });
    revalidatePath("/app/zeit");
    redirect("/app/zeit?meldung=standort-entfernt");
  }

  const parsed = geofenceInputSchema.safeParse({
    enforced: formData.get("enforced") === "on",
    label: value(formData, "label"),
    latitude: value(formData, "latitude").replace(",", "."),
    longitude: value(formData, "longitude").replace(",", "."),
    radiusMeters: value(formData, "radiusMeters"),
  });
  if (!parsed.success) {
    redirect("/app/zeit?meldung=standort-ungueltig");
  }

  await saveStoreGeofence({
    actor,
    geofence: parsed.data,
    organizationId: organization.organizationId,
  });
  revalidatePath("/app/zeit");
  redirect("/app/zeit?meldung=standort-gespeichert");
}
