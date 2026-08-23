import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./platform";

export const hygieneItemKind = pgEnum("hygiene_item_kind", [
  "CHECK",
  "TEMPERATURE",
]);

export const hygieneCheckStatus = pgEnum("hygiene_check_status", [
  "OK",
  "MANGEL",
]);

export const hygieneEntries = pgTable(
  "hygiene_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    completedByUserId: text("completed_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("hygiene_entries_org_date_unique").on(
      table.organizationId,
      table.entryDate,
    ),
  ],
).enableRLS();

export const hygieneItems = pgTable(
  "hygiene_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").notNull(),
    itemKey: varchar("item_key", { length: 40 }).notNull(),
    kind: hygieneItemKind("kind").notNull(),
    status: hygieneCheckStatus("status"),
    celsius: numeric("celsius", { precision: 4, scale: 1 }),
    note: varchar("note", { length: 300 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "hygiene_items_entry_organization_fk",
      columns: [table.entryId, table.organizationId],
      foreignColumns: [hygieneEntries.id, hygieneEntries.organizationId],
    }).onDelete("cascade"),
    check(
      "hygiene_items_check_has_status",
      sql`${table.kind} <> 'CHECK' or (${table.status} is not null and ${table.celsius} is null)`,
    ),
    check(
      "hygiene_items_temperature_has_celsius",
      sql`${table.kind} <> 'TEMPERATURE' or (${table.celsius} is not null and ${table.status} is null)`,
    ),
    index("hygiene_items_entry_idx").on(table.entryId),
  ],
).enableRLS();
