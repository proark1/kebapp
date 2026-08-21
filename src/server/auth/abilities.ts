export const abilities = {
  assignSupport: "ASSIGN_SUPPORT",
  confirmDemand: "CONFIRM_DEMAND",
  editDemand: "EDIT_DEMAND",
  manageDomains: "MANAGE_DOMAINS",
  manageMembers: "MANAGE_MEMBERS",
  manageOrganization: "MANAGE_ORGANIZATION",
  manageRoles: "MANAGE_ROLES",
  manageStorefront: "MANAGE_STOREFRONT",
  reviewRegistration: "REVIEW_REGISTRATION",
  viewOrganization: "VIEW_ORGANIZATION",
} as const;

export type Ability = (typeof abilities)[keyof typeof abilities];
export type MembershipRole = "EMPLOYEE" | "OWNER";
export type PlatformRole = "ADMIN" | "SUPPORT";

export const administratorAbilities: ReadonlySet<Ability> = new Set(
  Object.values(abilities),
);

export const administrativeAbilitiesWithoutActiveOrganization: ReadonlySet<Ability> =
  new Set([
    abilities.assignSupport,
    abilities.manageDomains,
    abilities.manageOrganization,
    abilities.reviewRegistration,
  ]);

export const ownerAbilities: ReadonlySet<Ability> = new Set([
  abilities.confirmDemand,
  abilities.editDemand,
  abilities.manageMembers,
  abilities.manageRoles,
  abilities.manageStorefront,
  abilities.viewOrganization,
]);

export const employeeAbilities: ReadonlySet<Ability> = new Set([
  abilities.editDemand,
  abilities.viewOrganization,
]);

export const assignedSupportAbilities: ReadonlySet<Ability> = new Set([
  abilities.editDemand,
  abilities.manageStorefront,
  abilities.viewOrganization,
]);
