import {
  administrativeAbilitiesWithoutActiveOrganization,
  administratorAbilities,
  assignedSupportAbilities,
  employeeAbilities,
  ownerAbilities,
  type Ability,
  type MembershipRole,
  type PlatformRole,
} from "./abilities";

export type AuthorizationActor = {
  userId: string;
  platformRoles: readonly PlatformRole[];
  memberships: readonly {
    organizationId: string;
    role: MembershipRole;
    status: "ACTIVE" | "INVITED" | "REMOVED" | "SUSPENDED";
  }[];
  supportAssignments: readonly {
    organizationId: string;
    status: "ACTIVE" | "ENDED";
    expiresAt: Date | null;
  }[];
};

export type AuthorizationTarget = {
  organizationId: string;
  organizationStatus: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
};

export class AuthorizationError extends Error {
  constructor() {
    super("Für diese Aktion fehlt die Berechtigung.");
    this.name = "AuthorizationError";
  }
}

function isAssignedSupport(
  actor: AuthorizationActor,
  target: AuthorizationTarget,
  now: Date,
): boolean {
  if (!actor.platformRoles.includes("SUPPORT")) {
    return false;
  }

  return actor.supportAssignments.some(
    (assignment) =>
      assignment.organizationId === target.organizationId &&
      assignment.status === "ACTIVE" &&
      (assignment.expiresAt === null || assignment.expiresAt > now),
  );
}

export function can(
  actor: AuthorizationActor,
  ability: Ability,
  target?: AuthorizationTarget,
  now = new Date(),
): boolean {
  const isAdministrator = actor.platformRoles.includes("ADMIN");

  if (isAdministrator && administratorAbilities.has(ability)) {
    if (ability === "REVIEW_REGISTRATION") {
      return true;
    }

    if (!target) {
      return false;
    }

    if (administrativeAbilitiesWithoutActiveOrganization.has(ability)) {
      return true;
    }

    return target.organizationStatus === "ACTIVE";
  }

  if (!target || target.organizationStatus !== "ACTIVE") {
    return false;
  }

  if (
    isAssignedSupport(actor, target, now) &&
    assignedSupportAbilities.has(ability)
  ) {
    return true;
  }

  const membership = actor.memberships.find(
    (candidate) =>
      candidate.organizationId === target.organizationId &&
      candidate.status === "ACTIVE",
  );

  if (!membership) {
    return false;
  }

  const membershipAbilities =
    membership.role === "OWNER" ? ownerAbilities : employeeAbilities;

  return membershipAbilities.has(ability);
}

export function authorize(
  actor: AuthorizationActor,
  ability: Ability,
  target?: AuthorizationTarget,
  now = new Date(),
): void {
  if (!can(actor, ability, target, now)) {
    throw new AuthorizationError();
  }
}
