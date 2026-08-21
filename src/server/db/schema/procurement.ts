import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./platform";

export const buyingRoundStatus = pgEnum("buying_round_status", [
  "PLANNING",
  "OPEN",
  "CLOSED",
  "SUBMITTED",
  "CANCELLED",
]);

export const demandSubmissionStatus = pgEnum("demand_submission_status", [
  "DRAFT",
  "CONFIRMED",
]);

export const demandUnit = pgEnum("demand_unit", ["KG", "PIECE"]);

export type PricingTier = {
  label: string;
  minimumQuantity: string;
  unitPrice: string;
};

function mutableTimestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  };
}

export const buyingRounds = pgTable(
  "buying_rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    regionalKey: varchar("regional_key", { length: 120 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    status: buyingRoundStatus("status").default("PLANNING").notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    deliveryStartsAt: timestamp("delivery_starts_at", {
      withTimezone: true,
    }).notNull(),
    deliveryEndsAt: timestamp("delivery_ends_at", {
      withTimezone: true,
    }).notNull(),
    targetQuantity: numeric("target_quantity", {
      precision: 12,
      scale: 3,
    }).notNull(),
    referenceUnitPrice: numeric("reference_unit_price", {
      precision: 12,
      scale: 2,
    }),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    pricingTiers: jsonb("pricing_tiers")
      .$type<PricingTier[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    ...mutableTimestamps(),
  },
  (table) => [
    check("buying_rounds_target_quantity_positive", sql`${table.targetQuantity} > 0`),
    check(
      "buying_rounds_reference_price_non_negative",
      sql`${table.referenceUnitPrice} is null or ${table.referenceUnitPrice} >= 0`,
    ),
    check(
      "buying_rounds_delivery_window_valid",
      sql`${table.deliveryStartsAt} < ${table.deliveryEndsAt}`,
    ),
    check(
      "buying_rounds_closes_before_delivery",
      sql`${table.closesAt} <= ${table.deliveryStartsAt}`,
    ),
    check(
      "buying_rounds_pricing_tiers_array",
      sql`jsonb_typeof(${table.pricingTiers}) = 'array'`,
    ),
    index("buying_rounds_organization_status_closes_idx").on(
      table.organizationId,
      table.status,
      table.closesAt,
    ),
    index("buying_rounds_regional_key_idx").on(table.regionalKey),
  ],
).enableRLS();

export const demandSubmissions = pgTable(
  "demand_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    buyingRoundId: uuid("buying_round_id")
      .notNull()
      .references(() => buyingRounds.id, { onDelete: "cascade" }),
    status: demandSubmissionStatus("status").default("DRAFT").notNull(),
    confirmedByUserId: text("confirmed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("demand_submissions_organization_round_unique").on(
      table.organizationId,
      table.buyingRoundId,
    ),
    unique("demand_submissions_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
    index("demand_submissions_round_status_idx").on(
      table.buyingRoundId,
      table.status,
    ),
  ],
).enableRLS();

export const demandItems = pgTable(
  "demand_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").notNull(),
    productName: varchar("product_name", { length: 180 }).notNull(),
    specification: text("specification"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: demandUnit("unit").notNull(),
    requestedDeliveryDate: date("requested_delivery_date", {
      mode: "string",
    }).notNull(),
    estimatedUnitPrice: numeric("estimated_unit_price", {
      precision: 12,
      scale: 2,
    }),
    currency: varchar("currency", { length: 3 }).default("EUR").notNull(),
    ...mutableTimestamps(),
  },
  (table) => [
    foreignKey({
      name: "demand_items_submission_organization_fk",
      columns: [table.submissionId, table.organizationId],
      foreignColumns: [
        demandSubmissions.id,
        demandSubmissions.organizationId,
      ],
    }).onDelete("cascade"),
    check("demand_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "demand_items_estimated_price_non_negative",
      sql`${table.estimatedUnitPrice} is null or ${table.estimatedUnitPrice} >= 0`,
    ),
    index("demand_items_organization_submission_idx").on(
      table.organizationId,
      table.submissionId,
    ),
  ],
).enableRLS();
