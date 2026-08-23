CREATE TYPE "public"."goods_receipt_reason" AS ENUM('SHORTAGE', 'QUALITY', 'WRONG_ITEM', 'OTHER');--> statement-breakpoint
CREATE TABLE "goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"demand_item_id" uuid,
	"product_name" varchar(180) NOT NULL,
	"specification" text,
	"unit" "demand_unit" NOT NULL,
	"ordered_quantity" numeric(12, 3) NOT NULL,
	"received_quantity" numeric(12, 3) NOT NULL,
	"missing_reason" "goods_receipt_reason",
	"reason_note" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipt_items_received_non_negative" CHECK ("goods_receipt_items"."received_quantity" >= 0),
	CONSTRAINT "goods_receipt_items_ordered_positive" CHECK ("goods_receipt_items"."ordered_quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"buying_round_id" uuid NOT NULL,
	"note" text,
	"saved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE public.goods_receipts ADD CONSTRAINT goods_receipts_id_organization_unique UNIQUE (id, organization_id);--> statement-breakpoint
ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_organization_fk" FOREIGN KEY ("receipt_id","organization_id") REFERENCES "public"."goods_receipts"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_buying_round_id_buying_rounds_id_fk" FOREIGN KEY ("buying_round_id") REFERENCES "public"."buying_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_saved_by_user_id_user_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goods_receipt_items_receipt_idx" ON "goods_receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_organization_round_unique" ON "goods_receipts" USING btree ("organization_id","buying_round_id");--> statement-breakpoint

-- === Mandantensicherheit Wareneingang (Muster 0001/0009) ===

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.goods_receipts,
  public.goods_receipt_items
TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.goods_receipts FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.goods_receipt_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY goods_receipts_select
ON public.goods_receipts
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY goods_receipts_write
ON public.goods_receipts
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY goods_receipt_items_select
ON public.goods_receipt_items
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY goods_receipt_items_write
ON public.goods_receipt_items
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));
