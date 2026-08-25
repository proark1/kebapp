CREATE TYPE "public"."invoice_category" AS ENUM('FLEISCH', 'GEMUESE', 'TROCKEN', 'GETRAENKE', 'VERPACKUNG', 'SONSTIGES');--> statement-breakpoint
CREATE TABLE "menu_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"menu_item_key" varchar(80) NOT NULL,
	"menu_name" varchar(180) NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_cost_cents" integer NOT NULL,
	"sale_price_cents" integer,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_calculations_org_item_unique" UNIQUE("organization_id","menu_item_key"),
	CONSTRAINT "menu_calculations_total_non_negative" CHECK ("menu_calculations"."total_cost_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "menu_calculations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incoming_invoices" ADD COLUMN "category" "invoice_category" DEFAULT 'SONSTIGES' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_calculations" ADD CONSTRAINT "menu_calculations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_calculations" ADD CONSTRAINT "menu_calculations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.menu_calculations TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.menu_calculations FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY menu_calculations_select ON public.menu_calculations FOR SELECT TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY menu_calculations_write ON public.menu_calculations FOR ALL TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id)) WITH CHECK (kebapp_private.can_edit_demand(organization_id));