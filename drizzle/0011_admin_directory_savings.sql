-- Admin-Laedendirectory und regionaler Ersparnis-Report (Muster 0009).

GRANT SELECT ON TABLE public.store_profiles TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.admin_store_directory()
RETURNS TABLE (
  organization_id uuid,
  store_name text,
  slug text,
  status public.organization_status,
  member_count bigint,
  website_published boolean,
  website_slug text,
  latest_round_status public.buying_round_status,
  latest_round_closes_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    organization_record.id,
    organization_record.store_name::text,
    organization_record.slug::text,
    organization_record.status,
    (
      SELECT count(*)
      FROM public.memberships AS membership_record
      WHERE membership_record.organization_id = organization_record.id
        AND membership_record.status = 'ACTIVE'
    ),
    (
      SELECT profile_record.is_published
      FROM public.store_profiles AS profile_record
      WHERE profile_record.organization_id = organization_record.id
      LIMIT 1
    ),
    (
      SELECT profile_record.public_slug::text
      FROM public.store_profiles AS profile_record
      WHERE profile_record.organization_id = organization_record.id
      LIMIT 1
    ),
    (
      SELECT round_record.status
      FROM public.buying_rounds AS round_record
      WHERE round_record.organization_id = organization_record.id
      ORDER BY round_record.closes_at DESC
      LIMIT 1
    ),
    (
      SELECT round_record.closes_at
      FROM public.buying_rounds AS round_record
      WHERE round_record.organization_id = organization_record.id
      ORDER BY round_record.closes_at DESC
      LIMIT 1
    ),
    organization_record.reviewed_at,
    organization_record.created_at
  FROM public.organizations AS organization_record
  WHERE kebapp_private.is_platform_admin()
  ORDER BY organization_record.created_at
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.regional_savings_report(
  target_round_id uuid
)
RETURNS TABLE (
  organization_id uuid,
  store_name text,
  confirmed_kg numeric,
  reference_price numeric,
  effective_price numeric,
  savings_eur numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  WITH region AS (
    SELECT source_record.regional_key
    FROM public.buying_rounds AS source_record
    WHERE source_record.id = target_round_id
  ),
  finalized AS (
    SELECT
      round_record.id,
      round_record.organization_id,
      round_record.reference_unit_price
    FROM public.buying_rounds AS round_record
    CROSS JOIN region
    WHERE round_record.regional_key = region.regional_key
      AND round_record.status IN ('CLOSED', 'SUBMITTED')
  ),
  group_totals AS (
    SELECT
      finalized.organization_id,
      coalesce(
        sum(item_record.quantity) FILTER (WHERE item_record.unit = 'KG'),
        0
      ) AS store_kg
    FROM finalized
    JOIN public.demand_submissions AS submission_record
      ON submission_record.buying_round_id = finalized.id
     AND submission_record.organization_id = finalized.organization_id
     AND submission_record.status = 'CONFIRMED'
    LEFT JOIN public.demand_items AS item_record
      ON item_record.submission_id = submission_record.id
     AND item_record.organization_id = submission_record.organization_id
    GROUP BY finalized.organization_id
  ),
  region_total AS (
    SELECT sum(store_kg) AS total_kg FROM group_totals
  ),
  active_tier AS (
    SELECT candidate.unit_price, candidate.minimum_quantity
    FROM region_total
    CROSS JOIN LATERAL (
      SELECT
        (tier_entry.value ->> 'minimumQuantity')::numeric AS minimum_quantity,
        (tier_entry.value ->> 'unitPrice')::numeric AS unit_price
      FROM public.buying_rounds AS source_record
      CROSS JOIN LATERAL jsonb_array_elements(source_record.pricing_tiers)
        AS tier_entry(value)
      WHERE source_record.id = target_round_id
    ) AS candidate
    WHERE candidate.minimum_quantity <= region_total.total_kg
    ORDER BY candidate.minimum_quantity DESC
    LIMIT 1
  )
  SELECT
    organization_record.id,
    organization_record.store_name::text,
    totals.store_kg,
    finalized.reference_unit_price,
    coalesce(active_tier.unit_price, finalized.reference_unit_price),
    CASE
      WHEN active_tier.unit_price IS NOT NULL
        AND finalized.reference_unit_price IS NOT NULL
      THEN round(
        (finalized.reference_unit_price - active_tier.unit_price)
          * totals.store_kg,
        2
      )
      ELSE NULL
    END
  FROM finalized
  JOIN public.organizations AS organization_record
    ON organization_record.id = finalized.organization_id
  JOIN group_totals AS totals
    ON totals.organization_id = finalized.organization_id
  LEFT JOIN active_tier ON true
  WHERE kebapp_private.is_platform_admin()
  ORDER BY totals.store_kg DESC
$function$;

REVOKE ALL ON FUNCTION kebapp_private.admin_store_directory() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.regional_savings_report(uuid) FROM PUBLIC;--> statement-breakpoint

ALTER FUNCTION kebapp_private.admin_store_directory() OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.regional_savings_report(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.admin_store_directory() TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.regional_savings_report(uuid) TO kebapp_app;
