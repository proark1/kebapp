"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getRuntimeEnv } from "@/lib/env";
import { chooseSafeContinueDestination } from "@/lib/post-login-destination";
import { getOptionalSession } from "@/server/auth/session";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  validateActiveOrganizationSelection,
} from "@/server/organizations/active-organization";

const selectionSchema = z.object({
  continueTo: z.string().max(500).optional(),
  organizationId: z.uuid(),
});

function formValue(formData: FormData, name: string) {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate : undefined;
}

export async function selectActiveOrganizationAction(
  formData: FormData,
): Promise<void> {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/app/organisation-waehlen");
  }

  const parsed = selectionSchema.safeParse({
    continueTo: formValue(formData, "continueTo"),
    organizationId: formValue(formData, "organizationId"),
  });
  if (!parsed.success) {
    redirect("/app/organisation-waehlen?fehler=ungueltig");
  }

  const organization = await validateActiveOrganizationSelection({
    actor,
    organizationId: parsed.data.organizationId,
  });
  if (!organization) {
    redirect("/app/organisation-waehlen?fehler=ungueltig");
  }

  const runtimeEnv = getRuntimeEnv();
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, organization.organizationId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/app",
    priority: "high",
    sameSite: "lax",
    secure: new URL(runtimeEnv.BETTER_AUTH_URL).protocol === "https:",
  });

  const destination = chooseSafeContinueDestination(
    "/app",
    parsed.data.continueTo,
  );
  redirect(
    destination === "/app/organisation-waehlen" ? "/app" : destination,
  );
}

export async function signOutAction(): Promise<void> {
  const actor = await getOptionalSession();
  if (actor) {
    await auth.api.signOut({ headers: await headers() });
  }

  const runtimeEnv = getRuntimeEnv();
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/app",
    sameSite: "lax",
    secure: new URL(runtimeEnv.BETTER_AUTH_URL).protocol === "https:",
  });
  redirect("/anmelden");
}
