import "server-only";

import { z } from "zod";

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

export const storefrontProfileSchema = z
  .object({
    accent: z.string().trim().toLowerCase().regex(/^#[0-9a-f]{6}$/),
    city: z.string().trim().max(120),
    description: z.string().trim().max(2_000),
    eyebrow: z.string().trim().max(180),
    menu: z.array(menuItemSchema).max(40),
    name: z.string().trim().min(1).max(180),
    openingHours: z.array(openingHourSchema).max(14),
    phone: z.string().trim().max(40),
    postalCode: z.string().trim().max(16),
    schemaVersion: z.literal(1),
    shortName: z.string().trim().min(1).max(12),
    street: z.string().trim().max(220),
    tagline: z.string().trim().max(240),
  })
  .strict();

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
      profile.menu.length > 0,
  );
}
