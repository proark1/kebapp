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
    expect(screen.getByText("Team & Rollen")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute(
      "href",
      "/app/einstellungen/team",
    );
    expect(screen.getByText("Domain & Sicherheit")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Website" })).not.toHaveLength(0);
  });

  it("hides owner, domain, security, and website controls from employees", () => {
    render(
      <AppShell
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

    expect(screen.queryByText("Team & Rollen")).not.toBeInTheDocument();
    expect(screen.queryByText("Domain & Sicherheit")).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Website" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Einkauf" })).not.toHaveLength(0);
  });
});
