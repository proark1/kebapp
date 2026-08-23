CREATE TYPE "public"."sales_source" AS ENUM('CSV', 'MANUAL');--> statement-breakpoint
CREATE TABLE "sales_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"net_sales_cents" integer NOT NULL,
	"guest_count" integer,
	"source" "sales_source" DEFAULT 'MANUAL' NOT NULL,
	"imported_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_daily_org_date_unique" UNIQUE("organization_id","business_date"),
	CONSTRAINT "sales_daily_net_non_negative" CHECK ("sales_daily"."net_sales_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales_daily" ADD CONSTRAINT "sales_daily_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_daily" ADD CONSTRAINT "sales_daily_imported_by_user_id_user_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_daily_org_date_idx" ON "sales_daily" USING btree ("organization_id","business_date");
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_daily TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.sales_daily FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY sales_daily_select ON public.sales_daily FOR SELECT TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY sales_daily_write ON public.sales_daily FOR ALL TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id)) WITH CHECK (kebapp_private.can_edit_demand(organization_id));