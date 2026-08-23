CREATE TYPE "public"."invoice_status" AS ENUM('OFFEN', 'BEZAHLT');--> statement-breakpoint
CREATE TABLE "incoming_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_name" varchar(180) NOT NULL,
	"invoice_number" varchar(80) NOT NULL,
	"document_date" date NOT NULL,
	"due_date" date,
	"net_cents_7" integer DEFAULT 0 NOT NULL,
	"net_cents_19" integer DEFAULT 0 NOT NULL,
	"status" "invoice_status" DEFAULT 'OFFEN' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incoming_invoices_org_number_unique" UNIQUE("organization_id","supplier_name","invoice_number"),
	CONSTRAINT "incoming_invoices_amounts_present" CHECK ("incoming_invoices"."net_cents_7" > 0 or "incoming_invoices"."net_cents_19" > 0)
);
--> statement-breakpoint
ALTER TABLE "incoming_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incoming_invoices" ADD CONSTRAINT "incoming_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_invoices" ADD CONSTRAINT "incoming_invoices_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incoming_invoices_org_date_idx" ON "incoming_invoices" USING btree ("organization_id","document_date");
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incoming_invoices TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.incoming_invoices FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY incoming_invoices_select ON public.incoming_invoices FOR SELECT TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY incoming_invoices_write ON public.incoming_invoices FOR ALL TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id)) WITH CHECK (kebapp_private.can_edit_demand(organization_id));