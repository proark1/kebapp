import { describe, expect, it } from "vitest";
import { abilities } from "./abilities";
import {
  can,
  type AuthorizationActor,
  type AuthorizationTarget,
} from "./authorization";

const organizationA = "10000000-0000-4000-8000-000000000001";
const organizationB = "10000000-0000-4000-8000-000000000002";
const now = new Date("2026-08-21T10:00:00.000Z");

const activeTarget: AuthorizationTarget = {
  organizationId: organizationA,
  organizationStatus: "ACTIVE",
};

function actor(
  input: Partial<AuthorizationActor> & Pick<AuthorizationActor, "userId">,
): AuthorizationActor {
  return {
    platformRoles: [],
    memberships: [],
    supportAssignments: [],
    ...input,
  };
}

describe("authorization abilities", () => {
  it("allows an administrator to perform global and tenant-scoped operations", () => {
    const admin = actor({
      userId: "admin-user",
      platformRoles: ["ADMIN"],
    });

    expect(can(admin, abilities.reviewRegistration, undefined, now)).toBe(true);
    expect(can(admin, abilities.manageOrganization, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.assignSupport, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.manageStorefront, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.confirmDemand, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.manageMembers, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.manageDomains, activeTarget, now)).toBe(true);
    expect(can(admin, abilities.manageStorefront, undefined, now)).toBe(false);
    expect(
      can(
        admin,
        abilities.editDemand,
        { ...activeTarget, organizationStatus: "SUSPENDED" },
        now,
      ),
    ).toBe(false);
    expect(
      can(
        admin,
        abilities.manageOrganization,
        { ...activeTarget, organizationStatus: "SUSPENDED" },
        now,
      ),
    ).toBe(true);
  });

  it("denies an unassigned support user access to a store", () => {
    const support = actor({
      userId: "support-user",
      platformRoles: ["SUPPORT"],
    });

    expect(can(support, abilities.viewOrganization, activeTarget, now)).toBe(
      false,
    );
    expect(can(support, abilities.editDemand, activeTarget, now)).toBe(false);
    expect(can(support, abilities.manageStorefront, activeTarget, now)).toBe(
      false,
    );
    expect(can(support, abilities.reviewRegistration, undefined, now)).toBe(
      false,
    );
  });

  it("limits assigned support to documented operational capabilities", () => {
    const support = actor({
      userId: "support-user",
      platformRoles: ["SUPPORT"],
      supportAssignments: [
        {
          organizationId: organizationA,
          status: "ACTIVE",
          expiresAt: new Date("2026-08-22T10:00:00.000Z"),
        },
      ],
    });

    expect(can(support, abilities.viewOrganization, activeTarget, now)).toBe(
      true,
    );
    expect(can(support, abilities.manageStorefront, activeTarget, now)).toBe(
      true,
    );
    expect(can(support, abilities.editDemand, activeTarget, now)).toBe(true);
    expect(can(support, abilities.confirmDemand, activeTarget, now)).toBe(false);
    expect(can(support, abilities.manageMembers, activeTarget, now)).toBe(false);
    expect(can(support, abilities.manageRoles, activeTarget, now)).toBe(false);
    expect(can(support, abilities.manageDomains, activeTarget, now)).toBe(false);
  });

  it("allows an active owner to manage the own store but not the platform", () => {
    const owner = actor({
      userId: "owner-user",
      memberships: [
        {
          organizationId: organizationA,
          role: "OWNER",
          status: "ACTIVE",
        },
      ],
    });

    expect(can(owner, abilities.viewOrganization, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.manageStorefront, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.editDemand, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.confirmDemand, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.manageMembers, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.manageRoles, activeTarget, now)).toBe(true);
    expect(can(owner, abilities.manageOrganization, activeTarget, now)).toBe(
      false,
    );
    expect(can(owner, abilities.manageDomains, activeTarget, now)).toBe(false);
  });

  it("keeps employee capabilities deliberately narrow", () => {
    const employee = actor({
      userId: "employee-user",
      memberships: [
        {
          organizationId: organizationA,
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
      ],
    });

    expect(can(employee, abilities.viewOrganization, activeTarget, now)).toBe(
      true,
    );
    expect(can(employee, abilities.editDemand, activeTarget, now)).toBe(true);
    expect(can(employee, abilities.confirmDemand, activeTarget, now)).toBe(
      false,
    );
    expect(can(employee, abilities.manageStorefront, activeTarget, now)).toBe(
      false,
    );
    expect(can(employee, abilities.manageMembers, activeTarget, now)).toBe(
      false,
    );
  });

  it("does not let a valid role cross into another or suspended organization", () => {
    const owner = actor({
      userId: "owner-user",
      memberships: [
        {
          organizationId: organizationA,
          role: "OWNER",
          status: "ACTIVE",
        },
      ],
    });

    expect(
      can(
        owner,
        abilities.editDemand,
        { ...activeTarget, organizationId: organizationB },
        now,
      ),
    ).toBe(false);
    expect(
      can(
        owner,
        abilities.editDemand,
        { ...activeTarget, organizationStatus: "SUSPENDED" },
        now,
      ),
    ).toBe(false);
  });
});
