import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./platform";

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    note: varchar("note", { length: 300 }),
    correctedByUserId: text("corrected_by_user_id").references(() => user.id, {
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
    uniqueIndex("time_entries_one_open_shift_unique")
      .on(table.organizationId, table.userId)
      .where(sql`${table.endedAt} is null`),
    check(
      "time_entries_end_after_start",
      sql`${table.endedAt} is null or ${table.endedAt} > ${table.startedAt}`,
    ),
    index("time_entries_org_user_started_idx").on(
      table.organizationId,
      table.userId,
      table.startedAt,
    ),
  ],
).enableRLS();
