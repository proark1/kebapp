CREATE TYPE "public"."guest_consent_source" AS ENUM('STOREFRONT', 'LADEN');--> statement-breakpoint
CREATE TYPE "public"."guest_order_mode" AS ENUM('PICKUP', 'DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."guest_order_source" AS ENUM('STOREFRONT', 'PLATTFORM', 'MANUELL');--> statement-breakpoint
CREATE TYPE "public"."guest_order_status" AS ENUM('NEU', 'ABGESCHLOSSEN', 'STORNIERT');--> statement-breakpoint
CREATE TABLE "guest_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" varchar(80),
	"name" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_order_items_quantity_range" CHECK ("guest_order_items"."quantity" between 1 and 99),
	CONSTRAINT "guest_order_items_unit_price_non_negative" CHECK ("guest_order_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "guest_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guest_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "guest_order_source" NOT NULL,
	"mode" "guest_order_mode" NOT NULL,
	"status" "guest_order_status" DEFAULT 'NEU' NOT NULL,
	"total_cents" integer NOT NULL,
	"delivery_address" varchar(240),
	"note" varchar(300),
	"external_reference" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_orders_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "guest_orders_total_non_negative" CHECK ("guest_orders"."total_cents" >= 0),
	CONSTRAINT "guest_orders_delivery_has_address" CHECK ("guest_orders"."mode" <> 'DELIVERY' or "guest_orders"."delivery_address" is not null)
);
--> statement-breakpoint
ALTER TABLE "guest_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" varchar(120),
	"note" varchar(300),
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consent_source" "guest_consent_source" NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_org_phone_unique" UNIQUE("organization_id","phone"),
	CONSTRAINT "guests_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "guests_phone_digits" CHECK ("guests"."phone" ~ '^[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
ALTER TABLE "guests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loyalty_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stamps_used" integer NOT NULL,
	"reward_label" varchar(120) NOT NULL,
	"redeemed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_redemptions_stamps_positive" CHECK ("loyalty_redemptions"."stamps_used" > 0)
);
--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" varchar(60) NOT NULL,
	"file_name" varchar(200) NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by_user_id" text,
	"row_count" integer NOT NULL,
	"created_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	CONSTRAINT "platform_imports_counts_non_negative" CHECK ("platform_imports"."row_count" >= 0 and "platform_imports"."created_count" >= 0 and "platform_imports"."skipped_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "platform_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "guest_order_items" ADD CONSTRAINT "guest_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_order_items" ADD CONSTRAINT "guest_order_items_order_organization_fk" FOREIGN KEY ("order_id","organization_id") REFERENCES "public"."guest_orders"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_orders" ADD CONSTRAINT "guest_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_orders" ADD CONSTRAINT "guest_orders_guest_organization_fk" FOREIGN KEY ("guest_id","organization_id") REFERENCES "public"."guests"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_redeemed_by_user_id_user_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_guest_organization_fk" FOREIGN KEY ("guest_id","organization_id") REFERENCES "public"."guests"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_imports" ADD CONSTRAINT "platform_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_imports" ADD CONSTRAINT "platform_imports_imported_by_user_id_user_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_order_items_order_idx" ON "guest_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_orders_external_reference_unique" ON "guest_orders" USING btree ("organization_id","source","external_reference") WHERE "guest_orders"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "guest_orders_org_placed_idx" ON "guest_orders" USING btree ("organization_id","placed_at");--> statement-breakpoint
CREATE INDEX "guest_orders_guest_idx" ON "guest_orders" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "guests_org_last_order_idx" ON "guests" USING btree ("organization_id","last_order_at");--> statement-breakpoint
CREATE INDEX "loyalty_redemptions_guest_idx" ON "loyalty_redemptions" USING btree ("guest_id","redeemed_at");--> statement-breakpoint
CREATE INDEX "platform_imports_org_idx" ON "platform_imports" USING btree ("organization_id","imported_at");
-- === Mandantensicherheit Gaeste (Muster Hygiene) ===

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.guests,
  public.guest_orders,
  public.guest_order_items,
  public.loyalty_redemptions,
  public.platform_imports
TO kebapp_app;--> statement-breakpoint

-- Die oeffentliche Ladenseite hat keinen Mandantenkontext. Die Bestellung
-- laeuft deshalb ueber eine geprueft eng geschnittene Definer-Funktion, die
-- nur diese drei Tabellen beschreibt.
GRANT SELECT, INSERT, UPDATE ON TABLE
  public.guests,
  public.guest_orders,
  public.guest_order_items
TO kebapp_policy_executor;--> statement-breakpoint

GRANT SELECT ON TABLE public.loyalty_redemptions
TO kebapp_policy_executor;--> statement-breakpoint

ALTER TABLE public.guests FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.guest_orders FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.guest_order_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.loyalty_redemptions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.platform_imports FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Gaeste lesen und pflegen darf jede Person mit Bedarfsrecht. Das Loeschen
-- eines Gastes ist eine Betroffenenanfrage nach DSGVO und bleibt der
-- Inhaberrolle vorbehalten.
CREATE POLICY guests_select
ON public.guests
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY guests_insert
ON public.guests
FOR INSERT TO kebapp_app
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY guests_update
ON public.guests
FOR UPDATE TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY guests_delete
ON public.guests
FOR DELETE TO kebapp_app
USING (kebapp_private.can_confirm_demand(organization_id));--> statement-breakpoint

CREATE POLICY guest_orders_select
ON public.guest_orders
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY guest_orders_write
ON public.guest_orders
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY guest_order_items_select
ON public.guest_order_items
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY guest_order_items_write
ON public.guest_order_items
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY loyalty_redemptions_select
ON public.loyalty_redemptions
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY loyalty_redemptions_write
ON public.loyalty_redemptions
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY platform_imports_select
ON public.platform_imports
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY platform_imports_write
ON public.platform_imports
FOR ALL TO kebapp_app
USING (kebapp_private.can_confirm_demand(organization_id))
WITH CHECK (kebapp_private.can_confirm_demand(organization_id));--> statement-breakpoint

-- === Oeffentliche Bestellannahme ===
-- Preis und Verfuegbarkeit stammen ausschliesslich aus dem gespeicherten
-- Menue, nie aus der Anfrage. Der Aufrufer bestimmt nur Gericht, Menge und
-- Kontaktdaten.
CREATE FUNCTION kebapp_private.record_storefront_order(
  target_slug text,
  guest_phone text,
  guest_name text,
  order_mode text,
  delivery_address text,
  order_note text,
  item_id text,
  item_quantity integer
)
RETURNS TABLE (
  created_order_id uuid,
  matched_guest_id uuid,
  stamp_count integer,
  order_total_cents integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  profile_record record;
  menu_entry jsonb;
  normalized_phone text;
  resolved_guest uuid;
  resolved_order uuid;
  unit_price integer;
  computed_total integer;
  recent_orders integer;
  consumed integer;
  collected integer;
BEGIN
  normalized_phone := regexp_replace(coalesce(guest_phone, ''), '\D', '', 'g');

  IF normalized_phone !~ '^[1-9][0-9]{7,14}$' THEN
    RAISE EXCEPTION 'kebapp_invalid_phone' USING ERRCODE = '22023';
  END IF;

  IF order_mode NOT IN ('PICKUP', 'DELIVERY') THEN
    RAISE EXCEPTION 'kebapp_invalid_mode' USING ERRCODE = '22023';
  END IF;

  IF item_quantity IS NULL OR item_quantity < 1 OR item_quantity > 20 THEN
    RAISE EXCEPTION 'kebapp_invalid_quantity' USING ERRCODE = '22023';
  END IF;

  SELECT
    profile_row.organization_id,
    profile_row.menu,
    profile_row.pickup_enabled,
    profile_row.delivery_enabled
  INTO profile_record
  FROM public.store_profiles AS profile_row
  JOIN public.organizations AS organization_row
    ON organization_row.id = profile_row.organization_id
  WHERE lower(profile_row.public_slug) = lower(btrim(target_slug))
    AND organization_row.status = 'ACTIVE'
    AND profile_row.is_published = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kebapp_store_not_found' USING ERRCODE = '22023';
  END IF;

  IF (order_mode = 'PICKUP' AND profile_record.pickup_enabled IS NOT TRUE)
     OR (order_mode = 'DELIVERY' AND profile_record.delivery_enabled IS NOT TRUE)
  THEN
    RAISE EXCEPTION 'kebapp_mode_unavailable' USING ERRCODE = '22023';
  END IF;

  IF order_mode = 'DELIVERY'
     AND coalesce(btrim(coalesce(delivery_address, '')), '') = ''
  THEN
    RAISE EXCEPTION 'kebapp_address_required' USING ERRCODE = '22023';
  END IF;

  SELECT menu_row.entry INTO menu_entry
  FROM jsonb_array_elements(
    coalesce(profile_record.menu, '[]'::jsonb)
  ) AS menu_row(entry)
  WHERE menu_row.entry ->> 'id' = item_id
  LIMIT 1;

  IF menu_entry IS NULL THEN
    RAISE EXCEPTION 'kebapp_item_not_found' USING ERRCODE = '22023';
  END IF;

  unit_price := round((menu_entry ->> 'price')::numeric * 100)::integer;
  computed_total := unit_price * item_quantity;

  -- Einfache Missbrauchsbremse fuer den offenen Endpunkt.
  SELECT count(*)::integer INTO recent_orders
  FROM public.guest_orders AS order_row
  JOIN public.guests AS guest_row
    ON guest_row.id = order_row.guest_id
  WHERE guest_row.organization_id = profile_record.organization_id
    AND guest_row.phone = normalized_phone
    AND order_row.source = 'STOREFRONT'
    AND order_row.placed_at > now() - interval '1 hour';

  IF recent_orders >= 10 THEN
    RAISE EXCEPTION 'kebapp_rate_limited' USING ERRCODE = '53400';
  END IF;

  INSERT INTO public.guests AS guest_row (
    organization_id,
    phone,
    name,
    consent_source,
    first_order_at,
    last_order_at
  )
  VALUES (
    profile_record.organization_id,
    normalized_phone,
    nullif(btrim(coalesce(guest_name, '')), ''),
    'STOREFRONT',
    now(),
    now()
  )
  ON CONFLICT (organization_id, phone) DO UPDATE
    SET name = coalesce(
          nullif(btrim(coalesce(guest_name, '')), ''),
          guest_row.name
        ),
        first_order_at = coalesce(guest_row.first_order_at, now()),
        last_order_at = now(),
        updated_at = now()
  RETURNING guest_row.id INTO resolved_guest;

  INSERT INTO public.guest_orders (
    organization_id,
    guest_id,
    source,
    mode,
    status,
    total_cents,
    delivery_address,
    note
  )
  VALUES (
    profile_record.organization_id,
    resolved_guest,
    'STOREFRONT',
    order_mode::public.guest_order_mode,
    'NEU',
    computed_total,
    CASE
      WHEN order_mode = 'DELIVERY'
        THEN left(btrim(delivery_address), 240)
      ELSE NULL
    END,
    nullif(left(btrim(coalesce(order_note, '')), 300), '')
  )
  RETURNING id INTO resolved_order;

  INSERT INTO public.guest_order_items (
    organization_id,
    order_id,
    menu_item_id,
    name,
    quantity,
    unit_price_cents
  )
  VALUES (
    profile_record.organization_id,
    resolved_order,
    left(item_id, 80),
    left(coalesce(menu_entry ->> 'name', 'Gericht'), 160),
    item_quantity,
    unit_price
  );

  -- Stempel werden gezaehlt, nicht auf Zeit zurueckgesetzt: eine Einloesung
  -- verbraucht genau die dafuer noetigen Stempel, ueberzaehlige bleiben stehen.
  SELECT coalesce(sum(redemption_row.stamps_used), 0)::integer INTO consumed
  FROM public.loyalty_redemptions AS redemption_row
  WHERE redemption_row.guest_id = resolved_guest;

  SELECT count(*)::integer INTO collected
  FROM public.guest_orders AS order_row
  WHERE order_row.guest_id = resolved_guest
    AND order_row.status <> 'STORNIERT';

  RETURN QUERY
  SELECT
    resolved_order,
    resolved_guest,
    greatest(collected - consumed, 0),
    computed_total;
END
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.record_storefront_order(
  text, text, text, text, text, text, text, integer
) OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.record_storefront_order(
  text, text, text, text, text, text, text, integer
) FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.record_storefront_order(
  text, text, text, text, text, text, text, integer
) TO kebapp_app;
