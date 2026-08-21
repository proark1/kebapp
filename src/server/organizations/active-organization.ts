import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import { memberships, organizations } from "@/server/db/schema";
import {
  type ActiveOrganizationDTO,
  type OrganizationChoiceDTO,
  type StoreRole,
  toOrganizationChoiceDTO,
} from "@/server/organizations/organization-dto";

export const ACTIVE_ORGANIZATION_COOKIE = "kebapp_active_organization";

const organizationIdSchema = z.uuid();

export type OrganizationCandidate = {
  membershipStatus: "ACTIVE" | "INVITED" | "REMOVED" | "SUSPENDED";
  organizationId: string;
  organizationStatus: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
  role: StoreRole;
  storeName: string;
};

export type ActiveOrganizationResolution =
  | {
      choices: OrganizationChoiceDTO[];
      kind: "READY";
      organization: ActiveOrganizationDTO;
    }
  | { choices: OrganizationChoiceDTO[]; kind: "SELECTION_REQUIRED" }
  | { choices: []; kind: "UNAVAILABLE" };

const organizationNameCollator = new Intl.Collator("de-DE", {
  sensitivity: "base",
});

export function chooseActiveOrganization(input: {
  candidates: readonly OrganizationCandidate[];
  preferredOrganizationId?: string;
}): ActiveOrganizationResolution {
  const choices = input.candidates
    .filter(
      (candidate) =>
        candidate.membershipStatus === "ACTIVE" &&
        candidate.organizationStatus === "ACTIVE",
    )
    .map(toOrganizationChoiceDTO)
    .sort((left, right) =>
      organizationNameCollator.compare(left.storeName, right.storeName),
    );

  if (choices.length === 0) {
    return { choices: [], kind: "UNAVAILABLE" };
  }

  if (choices.length === 1) {
    return {
      choices,
      kind: "READY",
      organization: { ...choices[0]!, organizationCount: 1 },
    };
  }

  const preferredId = organizationIdSchema.safeParse(
    input.preferredOrganizationId,
  );
  const selected = preferredId.success
    ? choices.find(
        (choice) => choice.organizationId === preferredId.data,
      )
    : undefined;

  if (!selected) {
    return { choices, kind: "SELECTION_REQUIRED" };
  }

  return {
    choices,
    kind: "READY",
    organization: { ...selected, organizationCount: choices.length },
  };
}

export async function listActiveOrganizationCandidates(input: {
  actor: { userId: string };
  database?: KebappDatabase;
}): Promise<OrganizationCandidate[]> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${input.actor.userId}, true),
        set_config('kebapp.organization_id', '', true)
    `);

    const membershipRows = await transaction
      .select({
        organizationId: memberships.organizationId,
        role: memberships.role,
        status: memberships.status,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, input.actor.userId),
          eq(memberships.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(memberships.createdAt));

    const candidates: OrganizationCandidate[] = [];

    for (const membership of membershipRows) {
      await transaction.execute(sql`
        select set_config(
          'kebapp.organization_id',
          ${membership.organizationId},
          true
        )
      `);

      const [organization] = await transaction
        .select({
          id: organizations.id,
          status: organizations.status,
          storeName: organizations.storeName,
        })
        .from(organizations)
        .where(
          and(
            eq(organizations.id, membership.organizationId),
            eq(organizations.status, "ACTIVE"),
          ),
        )
        .limit(1);

      if (organization) {
        candidates.push({
          membershipStatus: membership.status,
          organizationId: organization.id,
          organizationStatus: organization.status,
          role: membership.role,
          storeName: organization.storeName,
        });
      }
    }

    return candidates;
  });
}

export async function resolveActiveOrganization(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  preferredOrganizationId?: string;
}): Promise<ActiveOrganizationResolution> {
  const candidates = await listActiveOrganizationCandidates(input);

  return chooseActiveOrganization({
    candidates,
    preferredOrganizationId: input.preferredOrganizationId,
  });
}

export async function validateActiveOrganizationSelection(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
}): Promise<OrganizationChoiceDTO | null> {
  const organizationId = organizationIdSchema.safeParse(input.organizationId);
  if (!organizationId.success) {
    return null;
  }

  const resolution = await resolveActiveOrganization({
    actor: input.actor,
    database: input.database,
    preferredOrganizationId: organizationId.data,
  });

  if (resolution.kind !== "READY") {
    return null;
  }

  return resolution.organization.organizationId === organizationId.data
    ? resolution.organization
    : null;
}
