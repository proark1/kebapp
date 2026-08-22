import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontOrderSheet } from "@/components/storefront-order-sheet";
import { demoStoreProfile } from "@/test/fixtures/store-profile";

function renderSheet(preview = false) {
  return render(
    <StorefrontOrderSheet
      deliveryEnabled
      menu={demoStoreProfile.menu}
      pickupEnabled
      preview={preview}
      storeName={demoStoreProfile.name}
      whatsappPhone={demoStoreProfile.whatsappPhone}
    >
      <button
        data-storefront-order-item="menu-doener"
        data-storefront-order-trigger
        type="button"
      >
        Döner bestellen
      </button>
    </StorefrontOrderSheet>,
  );
}

describe("StorefrontOrderSheet", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens with the dish selected and returns focus after Escape", () => {
    renderSheet();
    const trigger = screen.getByRole("button", { name: "Döner bestellen" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Bestellung vorbereiten" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Gericht" })).toHaveValue("menu-doener");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("requires a delivery address before opening WhatsApp", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Döner bestellen" }));
    fireEvent.click(screen.getByRole("radio", { name: "Lieferung" }));
    fireEvent.click(screen.getByRole("button", { name: "In WhatsApp öffnen" }));

    expect(screen.getByRole("alert")).toHaveTextContent("vollständige Lieferadresse");
    expect(open).not.toHaveBeenCalled();
  });

  it("opens a prefilled WhatsApp URL after valid delivery input", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Döner bestellen" }));
    fireEvent.click(screen.getByRole("radio", { name: "Lieferung" }));
    fireEvent.change(screen.getByLabelText("Lieferadresse"), {
      target: { value: "Marktstraße 10, 41061 Mönchengladbach" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Menge erhöhen" }));
    fireEvent.click(screen.getByRole("button", { name: "In WhatsApp öffnen" }));

    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0]?.[0]).toContain("https://wa.me/492166123456?text=");
    expect(
      new URL(String(open.mock.calls[0]?.[0])).searchParams.get("text"),
    ).toContain("2 × Döner im Fladenbrot");
    expect(screen.getByRole("link", { name: "WhatsApp erneut öffnen" })).toBeInTheDocument();
  });

  it("never opens an external window inside the editor preview", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSheet(true);
    fireEvent.click(screen.getByRole("button", { name: "Döner bestellen" }));
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp-Nachricht prüfen" }));

    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("WhatsApp wird im Editor nicht geöffnet");
  });
});
