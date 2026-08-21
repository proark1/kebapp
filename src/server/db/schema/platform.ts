import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const userProfileStatus = pgEnum("user_profile_status", [
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
]);

export const platformRole = pgEnum("platform_role", ["ADMIN", "SUPPORT"]);

export const organizationStatus = pgEnum("organization_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "REJECTED",
]);

export const membershipRole = pgEnum("membership_role", [
  "OWNER",
  "EMPLOYEE",
]);

export const membershipStatus = pgEnum("membership_status", [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "REMOVED",
]);

export const registrationRequestStatus = pgEnum(
  "registration_request_status",
  ["PENDING", "APPROVED", "REJECTED"],
);

export const invitationStatus = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);

export const supportAssignmentStatus = pgEnum("support_assignment_status", [
  "ACTIVE",
  "ENDED",
]);

export const auditResult = pgEnum("audit_result", [
  "SUCCESS",
  "DENIED",
  "FAILED",
]);

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

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    locale: varchar("locale", { length: 10 }).default("de").notNull(),
    status: userProfileStatus("status").default("ACTIVE").notNull(),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("user_profiles_user_id_unique").on(table.userId),
  ],
).enableRLS();

export const platformRoles = pgTable(
  "platform_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: platformRole("role").notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("platform_roles_user_role_unique").on(
      table.userId,
      table.role,
    ),
  ],
).enableRLS();

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    storeName: varchar("store_name", { length: 180 }).notNull(),
    legalName: varchar("legal_name", { length: 220 }),
    status: organizationStatus("status").default("PENDING").notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("organizations_slug_unique").on(sql`lower(${table.slug})`),
  ],
).enableRLS();

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull(),
    status: membershipStatus("status").default("INVITED").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("memberships_user_organization_unique").on(
      table.userId,
      table.organizationId,
    ),
    index("memberships_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
).enableRLS();

export const registrationRequests = pgTable(
  "registration_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    storeName: varchar("store_name", { length: 180 }).notNull(),
    legalName: varchar("legal_name", { length: 220 }),
    contactName: varchar("contact_name", { length: 180 }).notNull(),
    contactEmail: varchar("contact_email", { length: 320 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 40 }).notNull(),
    street: varchar("street", { length: 220 }).notNull(),
    postalCode: varchar("postal_code", { length: 16 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    status: registrationRequestStatus("status")
      .default("PENDING")
      .notNull(),
    reviewNote: text("review_note"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("registration_requests_organization_unique").on(
      table.organizationId,
    ),
    uniqueIndex("registration_requests_user_pending_unique")
      .on(table.userId)
      .where(sql`${table.status} = 'PENDING'`),
    index("registration_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
).enableRLS();

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: membershipRole("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatus("status").default("PENDING").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("invitations_active_unique")
      .on(table.organizationId, sql`lower(${table.email})`, table.role)
      .where(sql`${table.status} = 'PENDING'`),
    index("invitations_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
).enableRLS();

export const supportAssignments = pgTable(
  "support_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supportUserId: text("support_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    purpose: text("purpose"),
    status: supportAssignmentStatus("status").default("ACTIVE").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    ...mutableTimestamps(),
  },
  (table) => [
    uniqueIndex("support_assignments_active_unique")
      .on(table.supportUserId, table.organizationId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("support_assignments_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
).enableRLS();

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    objectType: varchar("object_type", { length: 120 }).notNull(),
    objectId: text("object_id"),
    result: auditResult("result").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
  ],
).enableRLS();
