import "server-only";

import { redirect } from "next/navigation";
import { getPostLoginDestination } from "@/server/auth/destination";
import { getOptionalSession, type SessionActor } from "@/server/auth/session";
import {
  assertPlatformAdmin,
  PlatformAdminRequiredError,
} from "@/server/organizations/admin";

export async function requirePlatformAdminPage(
  continueTo: string,
): Promise<SessionActor> {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect(`/anmelden?weiter=${encodeURIComponent(continueTo)}`);
  }

  try {
    await assertPlatformAdmin({ actor });
  } catch (error) {
    if (error instanceof PlatformAdminRequiredError) {
      redirect(await getPostLoginDestination(actor.userId));
    }
    throw error;
  }

  return actor;
}
