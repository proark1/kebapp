CREATE TABLE "round_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"buying_round_id" uuid NOT NULL,
	"regional_key" varchar(120) NOT NULL,
	"supplier_name" varchar(180) NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"note" varchar(500),
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_awards_org_round_unique" UNIQUE("organization_id","buying_round_id"),
	CONSTRAINT "round_awards_price_positive" CHECK ("round_awards"."unit_price_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "round_awards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "round_awards" ADD CONSTRAINT "round_awards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_awards" ADD CONSTRAINT "round_awards_buying_round_id_buying_rounds_id_fk" FOREIGN KEY ("buying_round_id") REFERENCES "public"."buying_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_awards" ADD CONSTRAINT "round_awards_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "round_awards_regional_idx" ON "round_awards" USING btree ("regional_key");
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.round_awards TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.round_awards FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY round_awards_select ON public.round_awards FOR SELECT TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY round_awards_write ON public.round_awards FOR ALL TO kebapp_app USING (kebapp_private.can_edit_demand(organization_id)) WITH CHECK (kebapp_private.can_edit_demand(organization_id));