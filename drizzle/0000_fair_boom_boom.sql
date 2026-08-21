CREATE TYPE "public"."audit_result" AS ENUM('SUCCESS', 'DENIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('OWNER', 'EMPLOYEE');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('ADMIN', 'SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."registration_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."support_assignment_status" AS ENUM('ACTIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."user_profile_status" AS ENUM('ACTIVE', 'SUSPENDED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."buying_round_status" AS ENUM('PLANNING', 'OPEN', 'CLOSED', 'SUBMITTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."demand_submission_status" AS ENUM('DRAFT', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."demand_unit" AS ENUM('KG', 'PIECE');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"organization_id" uuid,
	"action" varchar(120) NOT NULL,
	"object_type" varchar(120) NOT NULL,
	"object_id" text,
	"result" "audit_result" NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "membership_role" NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"accepted_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'INVITED' NOT NULL,
	"invited_by_user_id" text,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"store_name" varchar(180) NOT NULL,
	"legal_name" varchar(220),
	"status" "organization_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by_user_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_name" varchar(180) NOT NULL,
	"legal_name" varchar(220),
	"contact_name" varchar(180) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(40) NOT NULL,
	"street" varchar(220) NOT NULL,
	"postal_code" varchar(16) NOT NULL,
	"city" varchar(120) NOT NULL,
	"status" "registration_request_status" DEFAULT 'PENDING' NOT NULL,
	"review_note" text,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"support_user_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"purpose" text,
	"status" "support_assignment_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"locale" varchar(10) DEFAULT 'de' NOT NULL,
	"status" "user_profile_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buying_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"status" "buying_round_status" DEFAULT 'PLANNING' NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"delivery_starts_at" timestamp with time zone NOT NULL,
	"delivery_ends_at" timestamp with time zone NOT NULL,
	"target_quantity" numeric(12, 3) NOT NULL,
	"reference_unit_price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"pricing_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buying_rounds_target_quantity_positive" CHECK ("buying_rounds"."target_quantity" > 0),
	CONSTRAINT "buying_rounds_reference_price_non_negative" CHECK ("buying_rounds"."reference_unit_price" is null or "buying_rounds"."reference_unit_price" >= 0),
	CONSTRAINT "buying_rounds_delivery_window_valid" CHECK ("buying_rounds"."delivery_starts_at" < "buying_rounds"."delivery_ends_at"),
	CONSTRAINT "buying_rounds_closes_before_delivery" CHECK ("buying_rounds"."closes_at" <= "buying_rounds"."delivery_starts_at"),
	CONSTRAINT "buying_rounds_pricing_tiers_array" CHECK (jsonb_typeof("buying_rounds"."pricing_tiers") = 'array')
);
--> statement-breakpoint
CREATE TABLE "demand_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"product_name" varchar(180) NOT NULL,
	"specification" text,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" "demand_unit" NOT NULL,
	"requested_delivery_date" date NOT NULL,
	"estimated_unit_price" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demand_items_quantity_positive" CHECK ("demand_items"."quantity" > 0),
	CONSTRAINT "demand_items_estimated_price_non_negative" CHECK ("demand_items"."estimated_unit_price" is null or "demand_items"."estimated_unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "demand_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"buying_round_id" uuid NOT NULL,
	"status" "demand_submission_status" DEFAULT 'DRAFT' NOT NULL,
	"confirmed_by_user_id" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demand_submissions_id_organization_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "store_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"public_slug" varchar(100) NOT NULL,
	"name" varchar(180) NOT NULL,
	"short_name" varchar(12) NOT NULL,
	"eyebrow" varchar(180),
	"tagline" varchar(240),
	"description" text,
	"phone" varchar(40),
	"email" varchar(320),
	"street" varchar(220),
	"postal_code" varchar(16),
	"city" varchar(120),
	"accent_color" varchar(7) DEFAULT '#f3b83f' NOT NULL,
	"logo_url" text,
	"custom_domain" varchar(253),
	"opening_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"menu" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_profiles_opening_hours_array" CHECK (jsonb_typeof("store_profiles"."opening_hours") = 'array'),
	CONSTRAINT "store_profiles_menu_array" CHECK (jsonb_typeof("store_profiles"."menu") = 'array'),
	CONSTRAINT "store_profiles_schema_version_positive" CHECK ("store_profiles"."schema_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_roles" ADD CONSTRAINT "platform_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_roles" ADD CONSTRAINT "platform_roles_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_support_user_id_user_id_fk" FOREIGN KEY ("support_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_assignments" ADD CONSTRAINT "support_assignments_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_rounds" ADD CONSTRAINT "buying_rounds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buying_rounds" ADD CONSTRAINT "buying_rounds_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_items" ADD CONSTRAINT "demand_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_items" ADD CONSTRAINT "demand_items_submission_organization_fk" FOREIGN KEY ("submission_id","organization_id") REFERENCES "public"."demand_submissions"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_submissions" ADD CONSTRAINT "demand_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_submissions" ADD CONSTRAINT "demand_submissions_buying_round_id_buying_rounds_id_fk" FOREIGN KEY ("buying_round_id") REFERENCES "public"."buying_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_submissions" ADD CONSTRAINT "demand_submissions_confirmed_by_user_id_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_events_organization_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_unique" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_active_unique" ON "invitations" USING btree ("organization_id",lower("email"),"role") WHERE "invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "invitations_organization_status_idx" ON "invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_organization_unique" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "memberships_organization_status_idx" ON "memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "platform_roles_user_role_unique" ON "platform_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_requests_organization_unique" ON "registration_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "registration_requests_status_created_idx" ON "registration_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_assignments_active_unique" ON "support_assignments" USING btree ("support_user_id","organization_id") WHERE "support_assignments"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "support_assignments_organization_status_idx" ON "support_assignments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_unique" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "buying_rounds_organization_status_closes_idx" ON "buying_rounds" USING btree ("organization_id","status","closes_at");--> statement-breakpoint
CREATE INDEX "demand_items_organization_submission_idx" ON "demand_items" USING btree ("organization_id","submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "demand_submissions_organization_round_unique" ON "demand_submissions" USING btree ("organization_id","buying_round_id");--> statement-breakpoint
CREATE INDEX "demand_submissions_round_status_idx" ON "demand_submissions" USING btree ("buying_round_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "store_profiles_organization_unique" ON "store_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_profiles_public_slug_unique" ON "store_profiles" USING btree (lower("public_slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "store_profiles_custom_domain_unique" ON "store_profiles" USING btree (lower("custom_domain")) WHERE "store_profiles"."custom_domain" is not null;--> statement-breakpoint
CREATE INDEX "store_profiles_publication_idx" ON "store_profiles" USING btree ("is_published","public_slug");