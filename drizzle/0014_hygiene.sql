CREATE TYPE "public"."hygiene_check_status" AS ENUM('OK', 'MANGEL');--> statement-breakpoint
CREATE TYPE "public"."hygiene_item_kind" AS ENUM('CHECK', 'TEMPERATURE');--> statement-breakpoint
CREATE TABLE "hygiene_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"completed_by_user_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hygiene_entries_org_date_unique" UNIQUE("organization_id","entry_date")
);
--> statement-breakpoint
ALTER TABLE public.hygiene_entries ADD CONSTRAINT hygiene_entries_id_organization_unique UNIQUE (id, organization_id);--> statement-breakpoint
ALTER TABLE "hygiene_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hygiene_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"item_key" varchar(40) NOT NULL,
	"kind" "hygiene_item_kind" NOT NULL,
	"status" "hygiene_check_status",
	"celsius" numeric(4, 1),
	"note" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hygiene_items_check_has_status" CHECK ("hygiene_items"."kind" <> 'CHECK' or ("hygiene_items"."status" is not null and "hygiene_items"."celsius" is null)),
	CONSTRAINT "hygiene_items_temperature_has_celsius" CHECK ("hygiene_items"."kind" <> 'TEMPERATURE' or ("hygiene_items"."celsius" is not null and "hygiene_items"."status" is null))
);
--> statement-breakpoint
ALTER TABLE "hygiene_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hygiene_entries" ADD CONSTRAINT "hygiene_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hygiene_entries" ADD CONSTRAINT "hygiene_entries_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hygiene_items" ADD CONSTRAINT "hygiene_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hygiene_items" ADD CONSTRAINT "hygiene_items_entry_organization_fk" FOREIGN KEY ("entry_id","organization_id") REFERENCES "public"."hygiene_entries"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hygiene_items_entry_idx" ON "hygiene_items" USING btree ("entry_id");
-- === Mandantensicherheit Hygiene (Muster Wareneingang) ===

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.hygiene_entries,
  public.hygiene_items
TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.hygiene_entries FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.hygiene_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY hygiene_entries_select
ON public.hygiene_entries
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY hygiene_entries_write
ON public.hygiene_entries
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY hygiene_items_select
ON public.hygiene_items
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY hygiene_items_write
ON public.hygiene_items
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));
