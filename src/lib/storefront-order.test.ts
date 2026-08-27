import { describe, expect, it } from "vitest";
import {
  normalizeWhatsappPhone,
  prepareStorefrontOrder,
} from "@/lib/storefront-order";
import { demoStoreProfile } from "@/test/fixtures/store-profile";

const baseDraft = {
  address: "",
  consent: false,
  itemId: "menu-doener",
  mode: "PICKUP" as const,
  name: "Max",
  note: "Ohne Zwiebeln",
  phone: "",
  quantity: 2,
};

describe("storefront order helpers", () => {
  it("normalizes international WhatsApp numbers and rejects local numbers", () => {
    expect(normalizeWhatsappPhone("+49 (2166) 123 456")).toBe("492166123456");
    expect(normalizeWhatsappPhone("0049 2166 123456")).toBe("492166123456");
    expect(normalizeWhatsappPhone("02166 123456")).toBeNull();
  });

  it("creates a structured pickup message and encoded wa.me URL", () => {
    const result = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: baseDraft,
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalPrice).toBe(15);
    expect(result.message).toContain("2 × Döner im Fladenbrot (7,50 €)");
    expect(result.message).toContain("Bestellart: Abholung");
    expect(result.message).not.toContain("Lieferadresse");
    expect(result.url).toMatch(/^https:\/\/wa\.me\/492166123456\?text=/);
  });

  it("requires an address for delivery and accepts it when present", () => {
    const invalid = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: { ...baseDraft, mode: "DELIVERY" },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(invalid).toMatchObject({
      errors: { address: "Bitte gib die vollständige Lieferadresse ein." },
      ok: false,
    });

    const valid = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: {
        ...baseDraft,
        address: "Marktstraße 10, 41061 Mönchengladbach",
        mode: "DELIVERY",
      },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.message).toContain(
        "Lieferadresse: Marktstraße 10, 41061 Mönchengladbach",
      );
    }
  });

  it("rejects invalid quantities, unavailable modes, and unknown dishes", () => {
    const result = prepareStorefrontOrder({
      deliveryEnabled: false,
      draft: {
        ...baseDraft,
        itemId: "nicht-mehr-da",
        mode: "DELIVERY",
        quantity: 21,
      },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });

    expect(result).toMatchObject({
      errors: {
        itemId: "Bitte wähle ein Gericht aus.",
        mode: "Diese Bestellart wird aktuell nicht angeboten.",
        quantity: "Die Menge muss zwischen 1 und 20 liegen.",
      },
      ok: false,
    });
  });

  it("verlangt eine Nummer nur bei gesetzter Einwilligung", () => {
    const withoutConsent = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: { ...baseDraft, phone: "" },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(withoutConsent.ok).toBe(true);

    const withConsentButNoPhone = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: { ...baseDraft, consent: true, phone: "0176" },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(withConsentButNoPhone).toMatchObject({
      errors: {
        phone: "Für die Stempelkarte brauchen wir eine gültige Telefonnummer.",
      },
      ok: false,
    });
  });

  it("nimmt die Gastnummer nur mit Einwilligung in die Nachricht auf", () => {
    const withConsent = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: { ...baseDraft, consent: true, phone: "0176 1234567" },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(withConsent.ok).toBe(true);
    if (withConsent.ok) {
      expect(withConsent.message).toContain("Telefon: +491761234567");
    }

    const withoutConsent = prepareStorefrontOrder({
      deliveryEnabled: true,
      draft: { ...baseDraft, phone: "0176 1234567" },
      menu: demoStoreProfile.menu,
      pickupEnabled: true,
      storeName: demoStoreProfile.name,
      whatsappPhone: demoStoreProfile.whatsappPhone,
    });
    expect(withoutConsent.ok).toBe(true);
    if (withoutConsent.ok) {
      expect(withoutConsent.message).not.toContain("Telefon:");
    }
  });
});
