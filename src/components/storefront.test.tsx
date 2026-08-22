import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Storefront } from "@/components/storefront";
import { demoStoreProfile } from "@/test/fixtures/store-profile";

describe("Storefront", () => {
  it("shows only explicitly selected store features", () => {
    render(
      <Storefront
        profile={{ ...demoStoreProfile, features: ["HALAL", "HOMEMADE_SAUCES"] }}
        publicSlug="ocakbasi-rheydt"
      />,
    );

    expect(screen.getByText("Halal")).toBeInTheDocument();
    expect(screen.getByText("Hausgemachte Saucen")).toBeInTheDocument();
    expect(screen.queryByText("Frisches Gemüse")).not.toBeInTheDocument();
    expect(screen.queryByText("Vor Ort zubereitet")).not.toBeInTheDocument();
  });

  it("links to the real legal routes and never offers online ordering", () => {
    render(<Storefront profile={demoStoreProfile} publicSlug="ocakbasi-rheydt" />);

    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/laden/ocakbasi-rheydt/impressum",
    );
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
      "href",
      "/laden/ocakbasi-rheydt/datenschutz",
    );
    expect(screen.queryByRole("button", { name: /bestellen/i })).not.toBeInTheDocument();
  });
});
