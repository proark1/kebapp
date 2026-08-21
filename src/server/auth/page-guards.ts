import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPostLoginDestination } from "@/server/auth/destination";
import { getOptionalSession, type SessionActor } from "@/server/auth/session";
import {
  assertPlatformAdmin,
  PlatformAdminRequiredError,
} from "@/server/organizations/admin";
import {
  assertPlatformSupport,
  PlatformSupportRequiredError,
} from "@/server/support/service";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  type ActiveOrganizationResolution,
  resolveActiveOrganization,
} from "@/server/organizations/active-organization";
import type {
  ActiveOrganizationDTO,
  OrganizationChoiceDTO,
} from "@/server/organizations/organization-dto";

type OperatorResolution =
  | { destination: "/admin" | "/support"; kind: "PLATFORM_AREA" }
  | { kind: "STORE_AREA"; resolution: ActiveOrganizationResolution };

const resolveOperatorRequest = cache(
  async (
    actor: SessionActor,
    preferredOrganizationId?: string,
  ): Promise<OperatorResolution> => {
    const destination = await getPostLoginDestination(actor.userId);
    if (destination === "/admin" || destination === "/support") {
      return { destination, kind: "PLATFORM_AREA" };
    }

    return {
      kind: "STORE_AREA",
      resolution: await resolveActiveOrganization({
        actor,
        preferredOrganizationId,
      }),
    };
  },
);

async function requireActor(continueTo: string): Promise<SessionActor> {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect(`/anmelden?weiter=${encodeURIComponent(continueTo)}`);
  }

  return actor;
}

async function redirectUnavailableOperator(actor: SessionActor): Promise<never> {
  const destination = await getPostLoginDestination(actor.userId);
  redirect(destination.startsWith("/app") ? "/status" : destination);
}

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

export async function requirePlatformSupportPage(
  continueTo: string,
): Promise<SessionActor> {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect(`/anmelden?weiter=${encodeURIComponent(continueTo)}`);
  }

  try {
    await assertPlatformSupport({ actor });
  } catch (error) {
    if (error instanceof PlatformSupportRequiredError) {
      redirect(await getPostLoginDestination(actor.userId));
    }
    throw error;
  }

  return actor;
}

export type OperatorLayoutContext = {
  actor: SessionActor;
  organization: ActiveOrganizationDTO | null;
};

export async function getOperatorLayoutContext(): Promise<OperatorLayoutContext> {
  const actor = await requireActor("/app");
  const preferredOrganizationId = (await cookies()).get(
    ACTIVE_ORGANIZATION_COOKIE,
  )?.value;
  const result = await resolveOperatorRequest(actor, preferredOrganizationId);

  if (result.kind === "PLATFORM_AREA") {
    redirect(result.destination);
  }
  if (result.resolution.kind === "UNAVAILABLE") {
    return redirectUnavailableOperator(actor);
  }

  return {
    actor,
    organization:
      result.resolution.kind === "READY"
        ? result.resolution.organization
        : null,
  };
}

export type OperatorPageContext = {
  actor: SessionActor;
  organization: ActiveOrganizationDTO;
};

export async function requireActiveOrganizationPage(
  continueTo: string,
): Promise<OperatorPageContext> {
  const actor = await requireActor(continueTo);
  const preferredOrganizationId = (await cookies()).get(
    ACTIVE_ORGANIZATION_COOKIE,
  )?.value;
  const result = await resolveOperatorRequest(actor, preferredOrganizationId);

  if (result.kind === "PLATFORM_AREA") {
    redirect(result.destination);
  }
  if (result.resolution.kind === "UNAVAILABLE") {
    return redirectUnavailableOperator(actor);
  }
  if (result.resolution.kind === "SELECTION_REQUIRED") {
    redirect(
      `/app/organisation-waehlen?weiter=${encodeURIComponent(continueTo)}`,
    );
  }

  return { actor, organization: result.resolution.organization };
}

export async function getOrganizationChoicesPage(): Promise<{
  actor: SessionActor;
  choices: OrganizationChoiceDTO[];
}> {
  const actor = await requireActor("/app/organisation-waehlen");
  const result = await resolveOperatorRequest(actor, undefined);

  if (result.kind === "PLATFORM_AREA") {
    redirect(result.destination);
  }
  if (result.resolution.kind === "UNAVAILABLE") {
    return redirectUnavailableOperator(actor);
  }

  return { actor, choices: result.resolution.choices };
}
