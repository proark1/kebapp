import "server-only";

import { eq, sql } from "drizzle-orm";
import type {
  PublicStorefrontData,
  StoreProfile,
  StorefrontEditorData,
} from "@/lib/types";
import type { KebappDatabase } from "@/server/db/client";
import { organizations, storeProfiles } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import {
  isStorefrontProfilePublishable,
  publicStorefrontSlugSchema,
  storefrontOrganizationIdSchema,
  storefrontProfileSchema,
} from "@/server/storefront/validation";

type StoredProfile = {
  accentColor: string;
  city: string | null;
  description: string | null;
  eyebrow: string | null;
  features: unknown;
  logoUrl: string | null;
  menu: unknown;
  name: string;
  openingHours: unknown;
  phone: string | null;
  postalCode: string | null;
  schemaVersion: number;
  shortName: string;
  street: string | null;
  tagline: string | null;
};

type PublicStorefrontRow = {
  accent_color: string;
  city: string | null;
  description: string | null;
  eyebrow: string | null;
  features: unknown;
  logo_url: string | null;
  menu: unknown;
  name: string;
  opening_hours: unknown;
  phone: string | null;
  postal_code: string | null;
  public_slug: string;
  schema_version: number;
  short_name: string;
  street: string | null;
  tagline: string | null;
};

export class StorefrontDataInvalidError extends Error {
  constructor() {
    super("Das gespeicherte Website-Profil ist ungültig.");
    this.name = "StorefrontDataInvalidError";
  }
}

function toStoreProfile(record: StoredProfile): StoreProfile {
  const parsed = storefrontProfileSchema.safeParse({
    accent: record.accentColor,
    city: record.city ?? "",
    description: record.description ?? "",
    eyebrow: record.eyebrow ?? "",
    features: record.features,
    logoUrl: record.logoUrl ?? "",
    menu: record.menu,
    name: record.name,
    openingHours: record.openingHours,
    phone: record.phone ?? "",
    postalCode: record.postalCode ?? "",
    schemaVersion: record.schemaVersion,
    shortName: record.shortName,
    street: record.street ?? "",
    tagline: record.tagline ?? "",
  });

  if (!parsed.success) {
    throw new StorefrontDataInvalidError();
  }
  return parsed.data;
}

function createShortName(storeName: string): string {
  const initials = storeName
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .toLocaleUpperCase("de-DE")
    .slice(0, 3);
  return initials || "LD";
}

function createDefaultProfile(storeName: string): StoreProfile {
  return {
    accent: "#f3b83f",
    city: "",
    description:
      "Döner, Tellergerichte und vegetarische Auswahl – frisch für dich zubereitet.",
    eyebrow: `Willkommen bei ${storeName}`,
    features: [],
    logoUrl: "",
    menu: [
      {
        category: "Döner",
        description: "Drehspieß, Salat und Sauce nach Wahl",
        id: "menu-doener",
        name: "Döner im Fladenbrot",
        price: 7.5,
      },
      {
        category: "Döner",
        description: "Dünnes Fladenbrot, Drehspieß, Salat und Sauce",
        id: "menu-dueruem",
        name: "Dürüm",
        price: 8.5,
      },
      {
        category: "Teller",
        description: "Drehspieß, Beilage, Salat und Sauce",
        id: "menu-teller",
        name: "Döner-Teller",
        price: 13.9,
      },
      {
        category: "Vegetarisch",
        description: "Falafel, Salat und Sauce",
        id: "menu-falafel",
        name: "Falafel-Tasche",
        price: 7,
      },
    ],
    name: storeName,
    openingHours: [
      { days: "Montag–Donnerstag", hours: "11:00–23:00" },
      { days: "Freitag–Samstag", hours: "11:00–00:00" },
      { days: "Sonntag", hours: "12:00–22:00" },
    ],
    phone: "",
    postalCode: "",
    schemaVersion: 2,
    shortName: createShortName(storeName),
    street: "",
    tagline: "Frisch zubereitet. Direkt bei uns im Laden.",
  };
}

export async function getStorefrontEditor(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
}): Promise<StorefrontEditorData> {
  const organizationId = storefrontOrganizationIdSchema.parse(
    input.organizationId,
  );

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const [row] = await transaction
        .select({
          accentColor: storeProfiles.accentColor,
          city: storeProfiles.city,
          customDomain: storeProfiles.customDomain,
          description: storeProfiles.description,
          domainRequestStatus: storeProfiles.domainRequestStatus,
          eyebrow: storeProfiles.eyebrow,
          features: storeProfiles.features,
          isPublished: storeProfiles.isPublished,
          logoUrl: storeProfiles.logoUrl,
          menu: storeProfiles.menu,
          name: storeProfiles.name,
          openingHours: storeProfiles.openingHours,
          phone: storeProfiles.phone,
          postalCode: storeProfiles.postalCode,
          profileId: storeProfiles.id,
          publicSlug: storeProfiles.publicSlug,
          requestedDomain: storeProfiles.requestedDomain,
          schemaVersion: storeProfiles.schemaVersion,
          shortName: storeProfiles.shortName,
          storeName: organizations.storeName,
          street: storeProfiles.street,
          tagline: storeProfiles.tagline,
          organizationSlug: organizations.slug,
        })
        .from(organizations)
        .leftJoin(
          storeProfiles,
          eq(storeProfiles.organizationId, organizations.id),
        )
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!row) {
        throw new StorefrontDataInvalidError();
      }

      const publicSlug = row.publicSlug ?? row.organizationSlug;
      const profile = row.profileId
        ? toStoreProfile({
            accentColor: row.accentColor!,
            city: row.city,
            description: row.description,
            eyebrow: row.eyebrow,
            features: row.features,
            logoUrl: row.logoUrl,
            menu: row.menu,
            name: row.name!,
            openingHours: row.openingHours,
            phone: row.phone,
            postalCode: row.postalCode,
            schemaVersion: row.schemaVersion!,
            shortName: row.shortName!,
            street: row.street,
            tagline: row.tagline,
          })
        : createDefaultProfile(row.storeName);

      return {
        customDomain: row.customDomain,
        domainRequestStatus: row.domainRequestStatus ?? "NONE",
        isPublished: row.isPublished ?? false,
        profile,
        publicPath: `/laden/${publicSlug}`,
        publicSlug,
        requestedDomain: row.requestedDomain,
      };
    },
  );
}

export async function getPublicStorefrontBySlug(input: {
  database?: KebappDatabase;
  slug: string;
}): Promise<PublicStorefrontData | null> {
  const parsedSlug = publicStorefrontSlugSchema.safeParse(input.slug);
  if (!parsedSlug.success) {
    return null;
  }

  const database =
    input.database ?? (await import("@/server/db/client")).database;
  const result = await database.execute<PublicStorefrontRow>(sql`
    select *
    from kebapp_private.public_storefront(${parsedSlug.data})
  `);
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  let profile: StoreProfile;
  try {
    profile = toStoreProfile({
      accentColor: row.accent_color,
      city: row.city,
      description: row.description,
      eyebrow: row.eyebrow,
      features: row.features,
      logoUrl: row.logo_url,
      menu: row.menu,
      name: row.name,
      openingHours: row.opening_hours,
      phone: row.phone,
      postalCode: row.postal_code,
      schemaVersion: row.schema_version,
      shortName: row.short_name,
      street: row.street,
      tagline: row.tagline,
    });
  } catch (error) {
    if (error instanceof StorefrontDataInvalidError) {
      return null;
    }
    throw error;
  }
  if (!isStorefrontProfilePublishable(profile)) {
    return null;
  }

  return {
    profile,
    publicSlug: row.public_slug,
  };
}
