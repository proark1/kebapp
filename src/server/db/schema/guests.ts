import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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

// Gastdaten entstehen ausschliesslich nach ausdruecklicher Einwilligung. Ohne
// Einwilligung bleibt die Bestellung wie bisher eine reine WhatsApp-Nachricht
// und hinterlaesst keinen Datensatz.
export const guestConsentSource = pgEnum("guest_consent_source", [
  "STOREFRONT",
  "LADEN",
]);

export const guestOrderSource = pgEnum("guest_order_source", [
  "STOREFRONT",
  "PLATTFORM",
  "MANUELL",
]);

export const guestOrderMode = pgEnum("guest_order_mode", [
  "PICKUP",
  "DELIVERY",
]);

export const guestOrderStatus = pgEnum("guest_order_status", [
  "NEU",
  "ABGESCHLOSSEN",
  "STORNIERT",
]);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }),
    note: varchar("note", { length: 300 }),
    consentAt: timestamp("consent_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    consentSource: guestConsentSource("consent_source").notNull(),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("guests_org_phone_unique").on(table.organizationId, table.phone),
    unique("guests_id_organization_unique").on(table.id, table.organizationId),
    check("guests_phone_digits", sql`${table.phone} ~ '^[1-9][0-9]{7,14}$'`),
    index("guests_org_last_order_idx").on(
      table.organizationId,
      table.lastOrderAt,
    ),
  ],
).enableRLS();

export const guestOrders = pgTable(
  "guest_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    source: guestOrderSource("source").notNull(),
    mode: guestOrderMode("mode").notNull(),
    status: guestOrderStatus("status").default("NEU").notNull(),
    totalCents: integer("total_cents").notNull(),
    deliveryAddress: varchar("delivery_address", { length: 240 }),
    note: varchar("note", { length: 300 }),
    // Fremdschluessel der Lieferplattform, damit ein erneuter Import derselben
    // Datei keine Dubletten erzeugt.
    externalReference: varchar("external_reference", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("guest_orders_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
    foreignKey({
      name: "guest_orders_guest_organization_fk",
      columns: [table.guestId, table.organizationId],
      foreignColumns: [guests.id, guests.organizationId],
    }).onDelete("cascade"),
    check("guest_orders_total_non_negative", sql`${table.totalCents} >= 0`),
    check(
      "guest_orders_delivery_has_address",
      sql`${table.mode} <> 'DELIVERY' or ${table.deliveryAddress} is not null`,
    ),
    uniqueIndex("guest_orders_external_reference_unique")
      .on(table.organizationId, table.source, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
    index("guest_orders_org_placed_idx").on(
      table.organizationId,
      table.placedAt,
    ),
    index("guest_orders_guest_idx").on(table.guestId),
  ],
).enableRLS();

export const guestOrderItems = pgTable(
  "guest_order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").notNull(),
    menuItemId: varchar("menu_item_id", { length: 80 }),
    name: varchar("name", { length: 160 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "guest_order_items_order_organization_fk",
      columns: [table.orderId, table.organizationId],
      foreignColumns: [guestOrders.id, guestOrders.organizationId],
    }).onDelete("cascade"),
    check(
      "guest_order_items_quantity_range",
      sql`${table.quantity} between 1 and 99`,
    ),
    check(
      "guest_order_items_unit_price_non_negative",
      sql`${table.unitPriceCents} >= 0`,
    ),
    index("guest_order_items_order_idx").on(table.orderId),
  ],
).enableRLS();

// Eine Einloesung verbraucht die bis dahin gesammelten Stempel. Der aktuelle
// Stempelstand ist damit die Zahl abgeschlossener Bestellungen nach der
// juengsten Einloesung und muss nirgends denormalisiert gepflegt werden.
export const loyaltyRedemptions = pgTable(
  "loyalty_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    stampsUsed: integer("stamps_used").notNull(),
    rewardLabel: varchar("reward_label", { length: 120 }).notNull(),
    redeemedByUserId: text("redeemed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "loyalty_redemptions_guest_organization_fk",
      columns: [table.guestId, table.organizationId],
      foreignColumns: [guests.id, guests.organizationId],
    }).onDelete("cascade"),
    check("loyalty_redemptions_stamps_positive", sql`${table.stampsUsed} > 0`),
    index("loyalty_redemptions_guest_idx").on(
      table.guestId,
      table.redeemedAt,
    ),
  ],
).enableRLS();

export const platformImports = pgTable(
  "platform_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 60 }).notNull(),
    fileName: varchar("file_name", { length: 200 }).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    importedByUserId: text("imported_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rowCount: integer("row_count").notNull(),
    createdCount: integer("created_count").notNull(),
    skippedCount: integer("skipped_count").notNull(),
  },
  (table) => [
    check(
      "platform_imports_counts_non_negative",
      sql`${table.rowCount} >= 0 and ${table.createdCount} >= 0 and ${table.skippedCount} >= 0`,
    ),
    index("platform_imports_org_idx").on(
      table.organizationId,
      table.importedAt,
    ),
  ],
).enableRLS();
