"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOptionalSession } from "@/server/auth/session";
import {
  connectDomain,
  DomainNotRequestedError,
  DomainRequestNotFoundError,
  rejectDomain,
} from "@/server/storefront/admin-domains";

function value(formData: FormData, name: string): string {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate : "";
}

async function requireActorOrRedirect() {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/admin/domains");
  }
  return actor;
}

function done(message: string): never {
  revalidatePath("/admin/domains");
  redirect(`/admin/domains?meldung=${message}`);
}

export async function connectDomainAction(formData: FormData): Promise<void> {
  const actor = await requireActorOrRedirect();
  const parsed = z.uuid().safeParse(value(formData, "organizationId"));
  if (!parsed.success) {
    return done("ungueltig");
  }

  try {
    await connectDomain({ actor, organizationId: parsed.data });
  } catch (error) {
    if (
      error instanceof DomainNotRequestedError ||
      error instanceof DomainRequestNotFoundError
    ) {
      return done("nicht-gefunden");
    }
    throw error;
  }
  done("verbunden");
}

export async function rejectDomainAction(formData: FormData): Promise<void> {
  const actor = await requireActorOrRedirect();
  const parsed = z
    .object({
      organizationId: z.uuid(),
      reason: z.string().trim().min(10).max(600),
    })
    .safeParse({
      organizationId: value(formData, "organizationId"),
      reason: value(formData, "reason"),
    });
  if (!parsed.success) {
    return done("ungueltig");
  }

  try {
    await rejectDomain({ actor, ...parsed.data });
  } catch (error) {
    if (
      error instanceof DomainNotRequestedError ||
      error instanceof DomainRequestNotFoundError
    ) {
      return done("nicht-gefunden");
    }
    throw error;
  }
  done("abgelehnt");
}
