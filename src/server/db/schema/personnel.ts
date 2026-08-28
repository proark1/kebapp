import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
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

    // Geofencing: gespeichert wird ausschliesslich der Abstand zum Laden
    // und die Messgenauigkeit des Geraets - nie die Koordinate selbst.
    // Die Frage, die ein Zeitnachweis beantworten muss, lautet "war die
    // Person im Laden?"; wo jemand sonst war, geht den Betrieb nichts an
    // und waere ein Bewegungsprofil (Datenminimierung, Art. 5 DSGVO).
    // `null` heisst: ohne Standort gestempelt (kein GPS, abgelehnt oder
    // am Rechner erfasst).
    startedDistanceMeters: integer("started_distance_meters"),
    startedAccuracyMeters: integer("started_accuracy_meters"),
    endedDistanceMeters: integer("ended_distance_meters"),
    endedAccuracyMeters: integer("ended_accuracy_meters"),

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
    check(
      "time_entries_distances_non_negative",
      sql`(${table.startedDistanceMeters} is null or ${table.startedDistanceMeters} >= 0)
        and (${table.endedDistanceMeters} is null or ${table.endedDistanceMeters} >= 0)
        and (${table.startedAccuracyMeters} is null or ${table.startedAccuracyMeters} >= 0)
        and (${table.endedAccuracyMeters} is null or ${table.endedAccuracyMeters} >= 0)`,
    ),
  ],
).enableRLS();

// Der Standort des Ladens fuer die Zeiterfassung. Bewusst nicht im
// `store_profiles` abgelegt: das ist die Website, die erst existiert,
// wenn jemand den Seiteneditor gespeichert hat - die Stempeluhr darf
// davon nicht abhaengen.
export const storeGeofences = pgTable(
  "store_geofences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    latitude: numeric("latitude", { mode: "number", precision: 9, scale: 6 })
      .notNull(),
    longitude: numeric("longitude", { mode: "number", precision: 9, scale: 6 })
      .notNull(),
    // 150 m deckt Laden, Hof und Parkplatz ab, ohne die halbe Strasse
    // einzuschliessen. Handy-GPS liegt in einer Stadt bei 20-60 m.
    radiusMeters: integer("radius_meters").default(150).notNull(),
    label: varchar("label", { length: 180 }),
    // Aus: der Abstand wird nur vermerkt. An: ausserhalb des Radius wird
    // das Stempeln abgelehnt. Standard ist aus, weil eine Ablehnung im
    // Zweifel Arbeitszeit kostet - erst einrichten, dann scharfstellen.
    enforced: boolean("enforced").default(false).notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
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
    uniqueIndex("store_geofences_organization_unique").on(table.organizationId),
    check(
      "store_geofences_coordinates_valid",
      sql`${table.latitude} between -90 and 90 and ${table.longitude} between -180 and 180`,
    ),
    check(
      "store_geofences_radius_range",
      sql`${table.radiusMeters} between 25 and 5000`,
    ),
  ],
).enableRLS();
