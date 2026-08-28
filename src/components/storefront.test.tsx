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

  // Der Hinweis "Kontaktdaten und Speisekarte sind Beispieldaten" hing
  // frueher an `preview` und erschien damit genau verkehrt herum: auf
  // jeder echten Ladenseite, nie in der Editorvorschau. Der Laden hat
  // seine eigenen Preise als erfunden gekennzeichnet.
  const demoNote = /Kontaktdaten und Speisekarte sind Beispieldaten/;

  it("keeps the demo note off a real store page", () => {
    render(<Storefront profile={demoStoreProfile} publicSlug="ocakbasi-rheydt" />);

    expect(screen.queryByText(demoNote)).not.toBeInTheDocument();
  });

  it("shows the demo note only in a public demo installation", () => {
    render(
      <Storefront demoMode profile={demoStoreProfile} publicSlug="ocakbasi-rheydt" />,
    );

    expect(screen.getByText(demoNote)).toBeInTheDocument();
  });

  it("hides the demo note in the editor preview even in a demo installation", () => {
    render(<Storefront demoMode preview profile={demoStoreProfile} />);

    expect(screen.queryByText(demoNote)).not.toBeInTheDocument();
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
