import { normalizeGuestPhone } from "@/lib/guest-identity";
import type { MenuItem } from "@/lib/types";

export type StorefrontOrderMode = "PICKUP" | "DELIVERY";

export type StorefrontOrderDraft = {
  address: string;
  // Nur mit gesetztem Haken entsteht ein Gastdatensatz. Ohne Haken bleibt die
  // Bestellung eine reine WhatsApp-Nachricht wie zuvor.
  consent: boolean;
  itemId: string;
  mode: StorefrontOrderMode;
  name: string;
  note: string;
  phone: string;
  quantity: number;
};

export type StorefrontOrderErrors = Partial<
  Record<keyof StorefrontOrderDraft | "storePhone", string>
>;

type PrepareStorefrontOrderInput = {
  deliveryEnabled: boolean;
  draft: StorefrontOrderDraft;
  menu: MenuItem[];
  pickupEnabled: boolean;
  storeName: string;
  whatsappPhone: string;
};

type PreparedStorefrontOrder =
  | {
      errors: StorefrontOrderErrors;
      ok: false;
    }
  | {
      message: string;
      ok: true;
      totalPrice: number;
      url: string;
    };

const euroFormatter = new Intl.NumberFormat("de-DE", {
  currency: "EUR",
  style: "currency",
});

export function formatStorefrontPrice(value: number): string {
  return euroFormatter.format(value);
}

export function normalizeWhatsappPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) return null;
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function validateStorefrontOrder(
  input: PrepareStorefrontOrderInput,
): StorefrontOrderErrors {
  const errors: StorefrontOrderErrors = {};
  if (!normalizeWhatsappPhone(input.whatsappPhone)) {
    errors.storePhone = "Die WhatsApp-Nummer des Ladens ist nicht verfügbar.";
  }
  if (input.draft.consent && !normalizeGuestPhone(input.draft.phone)) {
    errors.phone =
      "Für die Stempelkarte brauchen wir eine gültige Telefonnummer.";
  }
  if (!input.menu.some((item) => item.id === input.draft.itemId)) {
    errors.itemId = "Bitte wähle ein Gericht aus.";
  }
  if (
    !Number.isInteger(input.draft.quantity) ||
    input.draft.quantity < 1 ||
    input.draft.quantity > 20
  ) {
    errors.quantity = "Die Menge muss zwischen 1 und 20 liegen.";
  }
  if (
    (input.draft.mode === "PICKUP" && !input.pickupEnabled) ||
    (input.draft.mode === "DELIVERY" && !input.deliveryEnabled)
  ) {
    errors.mode = "Diese Bestellart wird aktuell nicht angeboten.";
  }
  if (input.draft.mode === "DELIVERY" && input.draft.address.trim().length < 5) {
    errors.address = "Bitte gib die vollständige Lieferadresse ein.";
  }
  if (input.draft.name.trim().length > 120) {
    errors.name = "Der Name darf höchstens 120 Zeichen enthalten.";
  }
  if (input.draft.address.trim().length > 240) {
    errors.address = "Die Adresse darf höchstens 240 Zeichen enthalten.";
  }
  if (input.draft.note.trim().length > 300) {
    errors.note = "Die Anmerkung darf höchstens 300 Zeichen enthalten.";
  }
  return errors;
}

export function prepareStorefrontOrder(
  input: PrepareStorefrontOrderInput,
): PreparedStorefrontOrder {
  const errors = validateStorefrontOrder(input);
  if (Object.keys(errors).length > 0) return { errors, ok: false };

  const item = input.menu.find((candidate) => candidate.id === input.draft.itemId)!;
  const totalPrice = item.price * input.draft.quantity;
  const lines = [
    `Hallo ${input.storeName},`,
    "ich möchte gerne bestellen:",
    "",
    `${input.draft.quantity} × ${item.name} (${formatStorefrontPrice(item.price)})`,
    `Bestellart: ${input.draft.mode === "DELIVERY" ? "Lieferung" : "Abholung"}`,
  ];
  const name = input.draft.name.trim();
  const address = input.draft.address.trim();
  const note = input.draft.note.trim();
  if (name) lines.push(`Name: ${name}`);
  const guestPhone = input.draft.consent
    ? normalizeGuestPhone(input.draft.phone)
    : null;
  if (guestPhone) lines.push(`Telefon: +${guestPhone}`);
  if (input.draft.mode === "DELIVERY") lines.push(`Lieferadresse: ${address}`);
  if (note) lines.push(`Anmerkung: ${note}`);
  lines.push("", `Angezeigter Gesamtpreis: ${formatStorefrontPrice(totalPrice)}`);
  const message = lines.join("\n");
  const phone = normalizeWhatsappPhone(input.whatsappPhone)!;
  const params = new URLSearchParams({ text: message });

  return {
    message,
    ok: true,
    totalPrice,
    url: `https://wa.me/${phone}?${params.toString()}`,
  };
}
