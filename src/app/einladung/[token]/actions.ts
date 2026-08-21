"use server";

import { redirect } from "next/navigation";
import { getOptionalSession } from "@/server/auth/session";
import {
  acceptEmployeeInvitation,
  ExistingMembershipError,
  InvitationAlreadyUsedError,
  InvitationExpiredError,
  InvitationUnavailableError,
} from "@/server/invitations/service";

export async function acceptInvitationAction(token: string): Promise<void> {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect(`/anmelden?weiter=${encodeURIComponent(`/einladung/${token}`)}`);
  }

  try {
    await acceptEmployeeInvitation({ actor, token });
  } catch (error) {
    if (error instanceof InvitationExpiredError) {
      redirect(`/einladung/${token}?fehler=abgelaufen`);
    }
    if (error instanceof InvitationAlreadyUsedError) {
      redirect(`/einladung/${token}?fehler=verwendet`);
    }
    if (error instanceof ExistingMembershipError) {
      redirect(`/einladung/${token}?fehler=mitglied`);
    }
    if (error instanceof InvitationUnavailableError) {
      redirect(`/einladung/${token}?fehler=ungueltig`);
    }
    throw error;
  }

  redirect("/app");
}
