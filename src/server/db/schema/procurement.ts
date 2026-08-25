import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
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

export const invoiceCategory = pgEnum("invoice_category", [
  "FLEISCH",
  "GEMUESE",
  "TROCKEN",
  "GETRAENKE",
  "VERPACKUNG",
  "SONSTIGES",
]);

export const goodsReceiptReason = pgEnum("goods_receipt_reason", [
  "SHORTAGE",
  "QUALITY",
  "WRONG_ITEM",
  "OTHER",
]);

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
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
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

export const demandTemplates = pgTable(
  "demand_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).default("Stammbedarf").notNull(),
    ...mutableTimestamps(),
  },
  (table) => [
    unique("demand_templates_id_organization_unique").on(
      table.id,
      table.organizationId,
    ),
    uniqueIndex("demand_templates_organization_unique").on(
      table.organizationId,
    ),
  ],
).enableRLS();

export const demandTemplateItems = pgTable(
  "demand_template_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => demandTemplates.id, { onDelete: "cascade" }),
    productName: varchar("product_name", { length: 180 }).notNull(),
    specification: text("specification"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: demandUnit("unit").notNull(),
    ...mutableTimestamps(),
  },
  (table) => [
    foreignKey({
      name: "demand_template_items_template_organization_fk",
      columns: [table.templateId, table.organizationId],
      foreignColumns: [demandTemplates.id, demandTemplates.organizationId],
    }).onDelete("cascade"),
    check(
      "demand_template_items_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    index("demand_template_items_template_idx").on(table.templateId),
  ],
).enableRLS();

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    buyingRoundId: uuid("buying_round_id")
      .notNull()
      .references(() => buyingRounds.id, { onDelete: "cascade" }),
    note: text("note"),
    savedByUserId: text("saved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("goods_receipts_organization_round_unique").on(
      table.organizationId,
      table.buyingRoundId,
    ),
  ],
).enableRLS();

export const goodsReceiptItems = pgTable(
  "goods_receipt_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    receiptId: uuid("receipt_id").notNull(),
    demandItemId: uuid("demand_item_id"),
    productName: varchar("product_name", { length: 180 }).notNull(),
    specification: text("specification"),
    unit: demandUnit("unit").notNull(),
    orderedQuantity: numeric("ordered_quantity", {
      precision: 12,
      scale: 3,
    }).notNull(),
    receivedQuantity: numeric("received_quantity", {
      precision: 12,
      scale: 3,
    }).notNull(),
    missingReason: goodsReceiptReason("missing_reason"),
    reasonNote: varchar("reason_note", { length: 300 }),
    ...mutableTimestamps(),
  },
  (table) => [
    foreignKey({
      name: "goods_receipt_items_receipt_organization_fk",
      columns: [table.receiptId, table.organizationId],
      foreignColumns: [goodsReceipts.id, goodsReceipts.organizationId],
    }).onDelete("cascade"),
    check(
      "goods_receipt_items_received_non_negative",
      sql`${table.receivedQuantity} >= 0`,
    ),
    check(
      "goods_receipt_items_ordered_positive",
      sql`${table.orderedQuantity} > 0`,
    ),
    index("goods_receipt_items_receipt_idx").on(table.receiptId),
  ],
).enableRLS();

export const salesSource = pgEnum("sales_source", ["CSV", "MANUAL"]);

export const salesDaily = pgTable(
  "sales_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    businessDate: date("business_date", { mode: "string" }).notNull(),
    netSalesCents: integer("net_sales_cents").notNull(),
    guestCount: integer("guest_count"),
    source: salesSource("source").default("MANUAL").notNull(),
    importedByUserId: text("imported_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("sales_daily_org_date_unique").on(
      table.organizationId,
      table.businessDate,
    ),
    check(
      "sales_daily_net_non_negative",
      sql`${table.netSalesCents} >= 0`,
    ),
    index("sales_daily_org_date_idx").on(table.organizationId, table.businessDate),
  ],
).enableRLS();

export const invoiceStatus = pgEnum("invoice_status", ["OFFEN", "BEZAHLT"]);

export const incomingInvoices = pgTable(
  "incoming_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    supplierName: varchar("supplier_name", { length: 180 }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 80 }).notNull(),
    documentDate: date("document_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    netCents7: integer("net_cents_7").default(0).notNull(),
    netCents19: integer("net_cents_19").default(0).notNull(),
    status: invoiceStatus("status").default("OFFEN").notNull(),
    eInvoiceXml: text("e_invoice_xml"),
    sourceFileName: varchar("source_file_name", { length: 255 }),
    category: invoiceCategory("category").default("SONSTIGES").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("incoming_invoices_org_number_unique").on(
      table.organizationId,
      table.supplierName,
      table.invoiceNumber,
    ),
    check(
      "incoming_invoices_amounts_present",
      sql`${table.netCents7} > 0 or ${table.netCents19} > 0`,
    ),
    index("incoming_invoices_org_date_idx").on(
      table.organizationId,
      table.documentDate,
    ),
  ],
).enableRLS();

// E-Rechnung Stufe B (MVP): Original-XRechnung (UBL-XML) zum Beleg.


export type CalculationIngredient = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export const menuCalculations = pgTable(
  "menu_calculations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    menuItemKey: varchar("menu_item_key", { length: 80 }).notNull(),
    menuName: varchar("menu_name", { length: 180 }).notNull(),
    ingredients: jsonb("ingredients")
      .$type<CalculationIngredient[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    totalCostCents: integer("total_cost_cents").notNull(),
    salePriceCents: integer("sale_price_cents"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("menu_calculations_org_item_unique").on(
      table.organizationId,
      table.menuItemKey,
    ),
    check(
      "menu_calculations_total_non_negative",
      sql`${table.totalCostCents} >= 0`,
    ),
  ],
).enableRLS();
