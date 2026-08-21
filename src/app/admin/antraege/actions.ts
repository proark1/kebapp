"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AdminReviewState } from "@/lib/admin-review-state";
import { getOptionalSession } from "@/server/auth/session";
import {
  approveRegistrationRequest,
  rejectRegistrationRequest,
  RegistrationTransitionError,
  suspendOrganization,
} from "@/server/organizations/admin";

const requestSchema = z.object({ requestId: z.uuid() });
const rejectionSchema = requestSchema.extend({
  reason: z.string().trim().min(10, "Bitte den Grund kurz dokumentieren.").max(600),
});
const suspensionSchema = z.object({
  organizationId: z.uuid(),
  reason: z.string().trim().min(10, "Bitte den Grund kurz dokumentieren.").max(600),
  requestId: z.uuid(),
});

function value(formData: FormData, field: string) {
  const candidate = formData.get(field);
  return typeof candidate === "string" ? candidate : "";
}

function errorState(message: string): AdminReviewState {
  return { message, status: "error" };
}

async function requireActorOrRedirect() {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/admin/antraege");
  }
  return actor;
}

export async function approveRegistrationAction(
  _state: AdminReviewState,
  formData: FormData,
): Promise<AdminReviewState> {
  const actor = await requireActorOrRedirect();
  const parsed = requestSchema.safeParse({ requestId: value(formData, "requestId") });
  if (!parsed.success) {
    return errorState("Der Antrag ist ungültig.");
  }

  try {
    await approveRegistrationRequest({ actor, requestId: parsed.data.requestId });
  } catch (error) {
    if (error instanceof RegistrationTransitionError) {
      return errorState(error.message);
    }
    console.error("Die lokale Antragsfreigabe ist fehlgeschlagen.");
    return errorState("Die Freigabe konnte nicht gespeichert werden.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/antraege");
  redirect(`/admin/antraege/${parsed.data.requestId}?aktion=freigegeben`);
}

export async function rejectRegistrationAction(
  _state: AdminReviewState,
  formData: FormData,
): Promise<AdminReviewState> {
  const actor = await requireActorOrRedirect();
  const parsed = rejectionSchema.safeParse({
    reason: value(formData, "reason"),
    requestId: value(formData, "requestId"),
  });
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Bitte Angaben prüfen.");
  }

  try {
    await rejectRegistrationRequest({ actor, ...parsed.data });
  } catch (error) {
    if (error instanceof RegistrationTransitionError) {
      return errorState(error.message);
    }
    console.error("Die lokale Antragsablehnung ist fehlgeschlagen.");
    return errorState("Die Entscheidung konnte nicht gespeichert werden.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/antraege");
  redirect(`/admin/antraege/${parsed.data.requestId}?aktion=abgelehnt`);
}

export async function suspendOrganizationAction(
  _state: AdminReviewState,
  formData: FormData,
): Promise<AdminReviewState> {
  const actor = await requireActorOrRedirect();
  const parsed = suspensionSchema.safeParse({
    organizationId: value(formData, "organizationId"),
    reason: value(formData, "reason"),
    requestId: value(formData, "requestId"),
  });
  if (!parsed.success) {
    return errorState(parsed.error.issues[0]?.message ?? "Bitte Angaben prüfen.");
  }

  try {
    await suspendOrganization({
      actor,
      organizationId: parsed.data.organizationId,
      reason: parsed.data.reason,
    });
  } catch (error) {
    if (error instanceof RegistrationTransitionError) {
      return errorState(error.message);
    }
    console.error("Die lokale Betriebssperrung ist fehlgeschlagen.");
    return errorState("Die Sperrung konnte nicht gespeichert werden.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/antraege");
  redirect(`/admin/antraege/${parsed.data.requestId}?aktion=gesperrt`);
}
