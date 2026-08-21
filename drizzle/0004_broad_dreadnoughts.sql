ALTER TABLE "buying_rounds" ADD COLUMN "regional_key" varchar(120);--> statement-breakpoint
UPDATE "buying_rounds"
SET "regional_key" = 'legacy-' || "id"::text
WHERE "regional_key" IS NULL;--> statement-breakpoint
ALTER TABLE "buying_rounds" ALTER COLUMN "regional_key" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "buying_rounds_regional_key_idx" ON "buying_rounds" USING btree ("regional_key");--> statement-breakpoint

GRANT SELECT ON TABLE
  public.buying_rounds,
  public.demand_items,
  public.demand_submissions
TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_edit_buying_round(
  target_organization_id uuid,
  target_round_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT kebapp_private.can_edit_demand(target_organization_id)
    AND EXISTS (
      SELECT 1
      FROM public.buying_rounds AS round_record
      WHERE round_record.id = target_round_id
        AND round_record.organization_id = target_organization_id
        AND round_record.status = 'OPEN'
        AND round_record.closes_at > now()
    )
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION kebapp_private.can_edit_submission(
  target_organization_id uuid,
  target_submission_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.demand_submissions AS submission_record
    WHERE submission_record.id = target_submission_id
      AND submission_record.organization_id = target_organization_id
      AND submission_record.status = 'DRAFT'
      AND kebapp_private.can_edit_buying_round(
        target_organization_id,
        submission_record.buying_round_id
      )
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.regional_confirmed_demand_kg(
  target_organization_id uuid,
  target_round_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT CASE
    WHEN kebapp_private.current_organization_id() = target_organization_id
      AND kebapp_private.can_access_organization(target_organization_id)
    THEN COALESCE((
      SELECT sum(item_record.quantity)
      FROM public.buying_rounds AS own_round
      JOIN public.buying_rounds AS regional_round
        ON regional_round.regional_key = own_round.regional_key
      JOIN public.demand_submissions AS submission_record
        ON submission_record.buying_round_id = regional_round.id
      JOIN public.demand_items AS item_record
        ON item_record.submission_id = submission_record.id
       AND item_record.organization_id = submission_record.organization_id
      WHERE own_round.id = target_round_id
        AND own_round.organization_id = target_organization_id
        AND submission_record.organization_id <> target_organization_id
        AND regional_round.status IN ('OPEN', 'CLOSED', 'SUBMITTED')
        AND submission_record.status = 'CONFIRMED'
        AND item_record.unit = 'KG'
    ), 0)
    ELSE 0
  END
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.can_edit_buying_round(uuid, uuid)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_edit_submission(uuid, uuid)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.regional_confirmed_demand_kg(uuid, uuid)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.can_edit_buying_round(uuid, uuid)
  FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.can_edit_submission(uuid, uuid)
  FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.regional_confirmed_demand_kg(uuid, uuid)
  FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.can_edit_buying_round(uuid, uuid)
  TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_edit_submission(uuid, uuid)
  TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.regional_confirmed_demand_kg(uuid, uuid)
  TO kebapp_app;--> statement-breakpoint

DROP POLICY demand_submissions_insert ON public.demand_submissions;--> statement-breakpoint
CREATE POLICY demand_submissions_insert
ON public.demand_submissions
FOR INSERT TO kebapp_app
WITH CHECK (
  status = 'DRAFT'
  AND kebapp_private.can_edit_buying_round(
    organization_id,
    buying_round_id
  )
);--> statement-breakpoint

DROP POLICY demand_submissions_update ON public.demand_submissions;--> statement-breakpoint
CREATE POLICY demand_submissions_update
ON public.demand_submissions
FOR UPDATE TO kebapp_app
USING (
  status = 'DRAFT'
  AND kebapp_private.can_edit_buying_round(
    organization_id,
    buying_round_id
  )
)
WITH CHECK (
  (
    status = 'DRAFT'
    AND kebapp_private.can_edit_buying_round(
      organization_id,
      buying_round_id
    )
  )
  OR (
    status = 'CONFIRMED'
    AND kebapp_private.can_confirm_demand(organization_id)
    AND kebapp_private.can_edit_buying_round(
      organization_id,
      buying_round_id
    )
  )
);
