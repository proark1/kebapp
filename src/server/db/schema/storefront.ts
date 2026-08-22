import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./platform";

export type StoreOpeningHour = {
  days: string;
  hours: string;
};

export type StoreMenuItem = {
  category: string;
  description: string;
  id: string;
  name: string;
  price: string;
};

export type StoreFeature =
  | "HALAL"
  | "FRESH_VEGETABLES"
  | "HOMEMADE_SAUCES"
  | "PREPARED_ON_SITE";

export type StoreDomainRequestStatus = "NONE" | "REVIEW_REQUESTED";

export const storeProfiles = pgTable(
  "store_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    publicSlug: varchar("public_slug", { length: 100 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    shortName: varchar("short_name", { length: 12 }).notNull(),
    eyebrow: varchar("eyebrow", { length: 180 }),
    tagline: varchar("tagline", { length: 240 }),
    description: text("description"),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 320 }),
    street: varchar("street", { length: 220 }),
    postalCode: varchar("postal_code", { length: 16 }),
    city: varchar("city", { length: 120 }),
    accentColor: varchar("accent_color", { length: 7 })
      .default("#f3b83f")
      .notNull(),
    logoUrl: text("logo_url"),
    customDomain: varchar("custom_domain", { length: 253 }),
    requestedDomain: varchar("requested_domain", { length: 253 }),
    domainRequestStatus: text("domain_request_status")
      .$type<StoreDomainRequestStatus>()
      .default("NONE")
      .notNull(),
    domainRequestedAt: timestamp("domain_requested_at", {
      withTimezone: true,
    }),
    features: jsonb("features")
      .$type<StoreFeature[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    openingHours: jsonb("opening_hours")
      .$type<StoreOpeningHour[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    menu: jsonb("menu")
      .$type<StoreMenuItem[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    schemaVersion: integer("schema_version").default(2).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("store_profiles_organization_unique").on(table.organizationId),
    uniqueIndex("store_profiles_public_slug_unique").on(
      sql`lower(${table.publicSlug})`,
    ),
    uniqueIndex("store_profiles_custom_domain_unique")
      .on(sql`lower(${table.customDomain})`)
      .where(sql`${table.customDomain} is not null`),
    check(
      "store_profiles_opening_hours_array",
      sql`jsonb_typeof(${table.openingHours}) = 'array'`,
    ),
    check(
      "store_profiles_menu_array",
      sql`jsonb_typeof(${table.menu}) = 'array'`,
    ),
    check(
      "store_profiles_features_array",
      sql`jsonb_typeof(${table.features}) = 'array'`,
    ),
    check(
      "store_profiles_domain_request_status_values",
      sql`${table.domainRequestStatus} in ('NONE', 'REVIEW_REQUESTED')`,
    ),
    check(
      "store_profiles_schema_version_positive",
      sql`${table.schemaVersion} > 0`,
    ),
    index("store_profiles_publication_idx").on(
      table.isPublished,
      table.publicSlug,
    ),
  ],
).enableRLS();
