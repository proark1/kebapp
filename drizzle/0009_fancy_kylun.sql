CREATE TABLE "demand_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"product_name" varchar(180) NOT NULL,
	"specification" text,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" "demand_unit" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demand_template_items_quantity_positive" CHECK ("demand_template_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "demand_template_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "demand_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(180) DEFAULT 'Stammbedarf' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE public.demand_templates ADD CONSTRAINT demand_templates_id_organization_unique UNIQUE (id, organization_id);--> statement-breakpoint
ALTER TABLE "demand_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "buying_rounds" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "demand_template_items" ADD CONSTRAINT "demand_template_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_template_items" ADD CONSTRAINT "demand_template_items_template_id_demand_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."demand_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_template_items" ADD CONSTRAINT "demand_template_items_template_organization_fk" FOREIGN KEY ("template_id","organization_id") REFERENCES "public"."demand_templates"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demand_templates" ADD CONSTRAINT "demand_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demand_template_items_template_idx" ON "demand_template_items" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "demand_templates_organization_unique" ON "demand_templates" USING btree ("organization_id");--> statement-breakpoint
-- === Mandantensicherheit fuer die neuen Vorlagen-Tabellen (Muster 0001) ===

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.demand_templates,
  public.demand_template_items
TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.demand_templates FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.demand_template_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY demand_templates_select
ON public.demand_templates
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY demand_templates_write
ON public.demand_templates
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY demand_template_items_select
ON public.demand_template_items
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint
CREATE POLICY demand_template_items_write
ON public.demand_template_items
FOR ALL TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id))
WITH CHECK (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

-- Plattform-Admins duerfen Sammelrunden ueberregional einsehen (Muster
-- registration_requests_select aus Migration 0002), schreiben duerfen sie
-- weiterhin nur ueber can_administer_organization je Organisation.
DROP POLICY buying_rounds_select ON public.buying_rounds;--> statement-breakpoint
CREATE POLICY buying_rounds_select
ON public.buying_rounds
FOR SELECT TO kebapp_app
USING (
  kebapp_private.can_access_organization(organization_id)
  OR kebapp_private.is_platform_admin()
);

-- === SECURITY DEFINER Hilfsfunktionen fuer Runden-Automatisierung ===
-- Besitzer und Rechte folgen exakt dem Muster der Prueffunktionen aus 0001.

GRANT SELECT ON TABLE public.demand_items TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.admin_organization_name(
  target_organization_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT (
    SELECT organization_record.store_name AS name
    FROM public.organizations AS organization_record
    WHERE organization_record.id = target_organization_id
      AND kebapp_private.is_platform_admin()
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.admin_active_organizations()
RETURNS TABLE (
  organization_id uuid,
  organization_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    organization_record.id,
    organization_record.store_name::text
  FROM public.organizations AS organization_record
  WHERE organization_record.status = 'ACTIVE'
    AND kebapp_private.is_platform_admin()
  ORDER BY organization_record.store_name
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.round_bundle(
  target_round_id uuid
)
RETURNS TABLE (
  product_name text,
  specification text,
  unit public.demand_unit,
  total_quantity numeric,
  position_count bigint,
  shop_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    item_record.product_name::text,
    coalesce(item_record.specification, 'Standardspezifikation')::text,
    item_record.unit,
    sum(item_record.quantity),
    count(*),
    count(DISTINCT submission_record.organization_id)
  FROM public.demand_items AS item_record
  JOIN public.demand_submissions AS submission_record
    ON submission_record.id = item_record.submission_id
   AND submission_record.organization_id = item_record.organization_id
  JOIN public.buying_rounds AS round_record
    ON round_record.id = submission_record.buying_round_id
  WHERE round_record.regional_key = (
    SELECT source_record.regional_key
    FROM public.buying_rounds AS source_record
    WHERE source_record.id = target_round_id
  )
    AND submission_record.status = 'CONFIRMED'
    AND round_record.status IN ('CLOSED', 'SUBMITTED')
    AND kebapp_private.is_platform_admin()
  GROUP BY 1, 2, 3
  ORDER BY 1, 2
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.close_due_buying_rounds(
  now_ts timestamptz
)
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH closed AS (
    UPDATE public.buying_rounds
    SET status = 'CLOSED', updated_at = now_ts
    WHERE status = 'OPEN'
      AND closes_at < now_ts
    RETURNING 1
  )
  SELECT count(*) FROM closed
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.due_round_reminders(
  now_ts timestamptz,
  reminder_horizon interval
)
RETURNS TABLE (
  round_id uuid,
  round_name varchar,
  closes_at timestamptz,
  organization_id uuid,
  store_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    round_record.id,
    round_record.name,
    round_record.closes_at,
    round_record.organization_id,
    organization_record.store_name::text
  FROM public.buying_rounds AS round_record
  JOIN public.organizations AS organization_record
    ON organization_record.id = round_record.organization_id
  WHERE round_record.status = 'OPEN'
    AND round_record.reminder_sent_at IS NULL
    AND round_record.closes_at > now_ts
    AND round_record.closes_at <= now_ts + reminder_horizon
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.mark_due_round_reminders(
  now_ts timestamptz,
  reminder_horizon interval
)
RETURNS bigint
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH marked AS (
    UPDATE public.buying_rounds AS round_record
    SET reminder_sent_at = now_ts, updated_at = now_ts
    WHERE round_record.status = 'OPEN'
      AND round_record.reminder_sent_at IS NULL
      AND round_record.closes_at <= now_ts + reminder_horizon
    RETURNING 1
  )
  SELECT count(*) FROM marked
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.round_recipients(
  target_organization_id uuid
)
RETURNS TABLE (
  recipient_user_id text,
  recipient_email text,
  recipient_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    membership_record.user_id,
    user_record.email,
    coalesce(nullif(user_record.name, ''), user_record.email)
  FROM public.memberships AS membership_record
  JOIN public."user" AS user_record
    ON user_record.id = membership_record.user_id
  JOIN public.organizations AS organization_record
    ON organization_record.id = membership_record.organization_id
  WHERE membership_record.organization_id = target_organization_id
    AND membership_record.status = 'ACTIVE'
    AND organization_record.status = 'ACTIVE'
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.mark_round_reminder_sent(
  target_round_id uuid,
  now_ts timestamptz
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  UPDATE public.buying_rounds
  SET reminder_sent_at = now_ts, updated_at = now_ts
  WHERE id = target_round_id
    AND reminder_sent_at IS NULL
$function$;

REVOKE ALL ON FUNCTION kebapp_private.admin_organization_name(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.admin_active_organizations() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.round_bundle(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.close_due_buying_rounds(timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.due_round_reminders(timestamptz, interval) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.mark_due_round_reminders(timestamptz, interval) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.round_recipients(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.mark_round_reminder_sent(uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint

ALTER FUNCTION kebapp_private.admin_organization_name(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.admin_active_organizations() OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.round_bundle(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.close_due_buying_rounds(timestamptz) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.due_round_reminders(timestamptz, interval) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.mark_due_round_reminders(timestamptz, interval) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.round_recipients(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.mark_round_reminder_sent(uuid, timestamptz) OWNER TO kebapp_policy_executor;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.admin_organization_name(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.admin_active_organizations() TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.round_bundle(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.close_due_buying_rounds(timestamptz) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.due_round_reminders(timestamptz, interval) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.mark_due_round_reminders(timestamptz, interval) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.round_recipients(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.mark_round_reminder_sent(uuid, timestamptz) TO kebapp_app;
