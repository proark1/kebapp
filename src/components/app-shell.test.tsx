import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/app"),
}));

vi.mock("next/navigation", () => ({ usePathname }));

const baseOrganization = {
  initials: "OR",
  organizationCount: 2,
  organizationId: "10000000-0000-4000-8000-000000000001",
  role: "OWNER" as const,
  roleLabel: "Inhaberbereich" as const,
  storeName: "Ocakbasi Rheydt",
};

describe("AppShell role navigation", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/app");
  });

  it("shows owner management areas and organization switching", () => {
    render(
      <AppShell
        demoMode={false}
        organization={baseOrganization}
        signOutAction={vi.fn()}
        user={{ initials: "MB", name: "Meral Betreiberin" }}
      >
        <p>Inhalt</p>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /Ocakbasi Rheydt/ })).toHaveAttribute(
      "href",
      "/app/organisation-waehlen",
    );
    expect(screen.getAllByRole("link", { name: "Website" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Übersicht" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("hides owner, domain, security, and website controls from employees", () => {
    render(
      <AppShell
        demoMode={false}
        organization={{
          ...baseOrganization,
          organizationCount: 1,
          role: "EMPLOYEE",
          roleLabel: "Mitarbeiterzugang",
        }}
        signOutAction={vi.fn()}
        user={{ initials: "AY", name: "Ali Yilmaz" }}
      >
        <p>Inhalt</p>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: "Website" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Einkauf" })).not.toHaveLength(0);
  });
});
