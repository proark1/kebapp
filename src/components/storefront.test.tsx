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

  it("links to legal routes and offers direct WhatsApp ordering", () => {
    render(<Storefront profile={demoStoreProfile} publicSlug="ocakbasi-rheydt" />);

    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/laden/ocakbasi-rheydt/impressum",
    );
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute(
      "href",
      "/laden/ocakbasi-rheydt/datenschutz",
    );
    expect(
      screen.getAllByRole("button", { name: /bestellen|whatsapp/i }).length,
    ).toBeGreaterThan(1);
    expect(screen.getAllByRole("link", { name: /anrufen/i })[0]).toHaveAttribute(
      "href",
      "tel:+492166123456",
    );
  });

  it("uses telephone as the primary fallback without a WhatsApp number", () => {
    render(
      <Storefront
        profile={{ ...demoStoreProfile, whatsappPhone: "" }}
        publicSlug="ocakbasi-rheydt"
      />,
    );

    expect(screen.queryByRole("button", { name: /whatsapp|bestellen/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /anrufen/i }).length).toBeGreaterThan(1);
  });
});
