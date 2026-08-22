import "server-only";

import { z } from "zod";
import { normalizeWhatsappPhone } from "@/lib/storefront-order";
import { STORE_FEATURES } from "@/lib/types";

const MAX_LOGO_BYTES = 350 * 1_024;
const MAX_HERO_BYTES = 1_024 * 1_024;
const imageDataUrlPattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function isValidImageDataUrl(value: string, maxBytes: number): boolean {
  if (value === "") {
    return true;
  }
  const match = imageDataUrlPattern.exec(value);
  if (!match?.[2]) {
    return false;
  }
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((match[2].length * 3) / 4) - padding;
  return byteLength > 0 && byteLength <= maxBytes;
}

export const storefrontOrganizationIdSchema = z.uuid();

export const publicStorefrontSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const openingHourSchema = z
  .object({
    days: z.string().trim().min(2).max(80),
    hours: z.string().trim().min(3).max(80),
  })
  .strict();

const menuItemSchema = z
  .object({
    category: z.enum(["Döner", "Teller", "Vegetarisch", "Getränke"]),
    description: z.string().trim().max(300),
    id: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/),
    name: z.string().trim().min(1).max(120),
    price: z.coerce.number().finite().min(0).max(1_000),
  })
  .strict();

const logoUrlSchema = z
  .string()
  .max(500_000)
  .refine((value) => isValidImageDataUrl(value, MAX_LOGO_BYTES), {
    message: "Das Logo muss PNG, JPEG oder WebP sein und darf höchstens 350 KiB groß sein.",
  });

const heroImageUrlSchema = z
  .string()
  .max(1_500_000)
  .refine((value) => isValidImageDataUrl(value, MAX_HERO_BYTES), {
    message: "Das Headerbild muss PNG, JPEG oder WebP sein und darf höchstens 1 MiB groß sein.",
  });

export const storefrontProfileSchema = z
  .object({
    accent: z.string().trim().toLowerCase().regex(/^#[0-9a-f]{6}$/),
    city: z.string().trim().max(120),
    description: z.string().trim().max(2_000),
    eyebrow: z.string().trim().max(180),
    deliveryEnabled: z.boolean(),
    features: z.array(z.enum(STORE_FEATURES)).max(STORE_FEATURES.length),
    heroImageUrl: heroImageUrlSchema,
    logoUrl: logoUrlSchema,
    menu: z.array(menuItemSchema).max(40),
    name: z.string().trim().min(1).max(180),
    openingHours: z.array(openingHourSchema).max(14),
    phone: z.string().trim().max(40),
    pickupEnabled: z.boolean(),
    postalCode: z.string().trim().max(16),
    schemaVersion: z.literal(3),
    shortName: z.string().trim().min(1).max(12),
    street: z.string().trim().max(220),
    tagline: z.string().trim().max(240),
    whatsappPhone: z
      .string()
      .trim()
      .max(40)
      .refine((value) => value === "" || normalizeWhatsappPhone(value) !== null, {
        message: "Die WhatsApp-Nummer muss im internationalen Format angegeben werden.",
      }),
  })
  .strict();

export const requestedDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Bitte eine Domain ohne https://, Pfad oder Leerzeichen eingeben.",
  );

export const storefrontUpdateSchema = z
  .object({
    isPublished: z.boolean(),
    profile: storefrontProfileSchema,
  })
  .strict();

export type StorefrontProfileValues = z.infer<typeof storefrontProfileSchema>;

export function isStorefrontProfilePublishable(
  profile: StorefrontProfileValues,
): boolean {
  return Boolean(
    profile.name.trim() &&
      profile.tagline.trim() &&
      profile.description.trim() &&
      profile.phone.trim() &&
      profile.street.trim() &&
      profile.postalCode.trim() &&
      profile.city.trim() &&
      profile.openingHours.length > 0 &&
      profile.menu.length > 0 &&
      (!profile.whatsappPhone.trim() ||
        profile.pickupEnabled ||
        profile.deliveryEnabled),
  );
}
