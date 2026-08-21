"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRuntimeEnv } from "@/lib/env";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  createEmployeeInvitation,
  ExistingMembershipError,
  InvitationAlreadyPendingError,
  InvitationPermissionDeniedError,
  revokeEmployeeInvitation,
} from "@/server/invitations/service";

const invitationFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Bitte eine gültige E-Mail-Adresse angeben.")
    .max(320),
});
const revokeSchema = z.object({ invitationId: z.uuid() });

export type InvitationFormState = {
  message?: string;
  status: "ERROR" | "IDLE" | "SUCCESS";
};

export async function createInvitationAction(
  _previousState: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einstellungen/team",
  );
  if (organization.role !== "OWNER") {
    return {
      message: "Nur Inhaber:innen dürfen Mitarbeitende einladen.",
      status: "ERROR",
    };
  }

  const parsed = invitationFormSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Eingabe ungültig.",
      status: "ERROR",
    };
  }

  try {
    await createEmployeeInvitation({
      actor,
      appBaseUrl: getRuntimeEnv().BETTER_AUTH_URL,
      email: parsed.data.email,
      organizationId: organization.organizationId,
    });
    revalidatePath("/app/einstellungen/team");
    return {
      message: `Einladung an ${parsed.data.email} wurde versendet.`,
      status: "SUCCESS",
    };
  } catch (error) {
    if (
      error instanceof ExistingMembershipError ||
      error instanceof InvitationAlreadyPendingError ||
      error instanceof InvitationPermissionDeniedError
    ) {
      return { message: error.message, status: "ERROR" };
    }
    throw error;
  }
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einstellungen/team",
  );
  if (organization.role !== "OWNER") {
    return;
  }

  const parsed = revokeSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) {
    return;
  }

  await revokeEmployeeInvitation({
    actor,
    invitationId: parsed.data.invitationId,
    organizationId: organization.organizationId,
  });
  revalidatePath("/app/einstellungen/team");
}
