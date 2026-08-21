import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { chooseActiveOrganization } from "@/server/organizations/active-organization";

const candidates = {
  eicken: {
    membershipStatus: "ACTIVE",
    organizationId: "10000000-0000-4000-8000-000000000001",
    organizationStatus: "ACTIVE",
    role: "EMPLOYEE",
    storeName: "Eicken Grill",
  },
  rheydt: {
    membershipStatus: "ACTIVE",
    organizationId: "10000000-0000-4000-8000-000000000002",
    organizationStatus: "ACTIVE",
    role: "OWNER",
    storeName: "Ocakbasi Rheydt",
  },
} as const;

describe("chooseActiveOrganization", () => {
  it("selects the only active organization automatically", () => {
    expect(
      chooseActiveOrganization({
        candidates: [candidates.rheydt],
        preferredOrganizationId: undefined,
      }),
    ).toMatchObject({
      kind: "READY",
      organization: { organizationId: candidates.rheydt.organizationId },
    });
  });

  it("requires an explicit choice when several active organizations exist", () => {
    expect(
      chooseActiveOrganization({
        candidates: [candidates.rheydt, candidates.eicken],
        preferredOrganizationId: undefined,
      }),
    ).toMatchObject({ kind: "SELECTION_REQUIRED" });
  });

  it("accepts a valid remembered organization among several memberships", () => {
    expect(
      chooseActiveOrganization({
        candidates: [candidates.rheydt, candidates.eicken],
        preferredOrganizationId: candidates.eicken.organizationId,
      }),
    ).toMatchObject({
      kind: "READY",
      organization: { organizationId: candidates.eicken.organizationId },
    });
  });

  it("does not grant access through an unknown remembered organization", () => {
    expect(
      chooseActiveOrganization({
        candidates: [candidates.rheydt, candidates.eicken],
        preferredOrganizationId: "10000000-0000-4000-8000-999999999999",
      }),
    ).toMatchObject({ kind: "SELECTION_REQUIRED" });
  });

  it("excludes a removed membership", () => {
    expect(
      chooseActiveOrganization({
        candidates: [
          { ...candidates.rheydt, membershipStatus: "REMOVED" },
        ],
        preferredOrganizationId: candidates.rheydt.organizationId,
      }),
    ).toEqual({ choices: [], kind: "UNAVAILABLE" });
  });

  it("excludes a suspended organization", () => {
    expect(
      chooseActiveOrganization({
        candidates: [
          { ...candidates.rheydt, organizationStatus: "SUSPENDED" },
        ],
        preferredOrganizationId: candidates.rheydt.organizationId,
      }),
    ).toEqual({ choices: [], kind: "UNAVAILABLE" });
  });
});
