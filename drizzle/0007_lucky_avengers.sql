ALTER TABLE "store_profiles" ALTER COLUMN "schema_version" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "requested_domain" varchar(253);--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "domain_request_status" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "domain_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD COLUMN "features" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_features_array" CHECK (jsonb_typeof("store_profiles"."features") = 'array');--> statement-breakpoint
ALTER TABLE "store_profiles" ADD CONSTRAINT "store_profiles_domain_request_status_values" CHECK ("store_profiles"."domain_request_status" in ('NONE', 'REVIEW_REQUESTED'));
--> statement-breakpoint
UPDATE "store_profiles" SET "schema_version" = 2;
--> statement-breakpoint
DROP FUNCTION kebapp_private.public_storefront(text);
--> statement-breakpoint
CREATE FUNCTION kebapp_private.public_storefront(target_slug text)
RETURNS TABLE (
  public_slug varchar(100),
  name varchar(180),
  short_name varchar(12),
  eyebrow varchar(180),
  tagline varchar(240),
  description text,
  phone varchar(40),
  street varchar(220),
  postal_code varchar(16),
  city varchar(120),
  accent_color varchar(7),
  logo_url text,
  features jsonb,
  opening_hours jsonb,
  menu jsonb,
  schema_version integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    profile_record.public_slug,
    profile_record.name,
    profile_record.short_name,
    profile_record.eyebrow,
    profile_record.tagline,
    profile_record.description,
    profile_record.phone,
    profile_record.street,
    profile_record.postal_code,
    profile_record.city,
    profile_record.accent_color,
    profile_record.logo_url,
    profile_record.features,
    profile_record.opening_hours,
    profile_record.menu,
    profile_record.schema_version
  FROM public.store_profiles AS profile_record
  JOIN public.organizations AS organization_record
    ON organization_record.id = profile_record.organization_id
  WHERE lower(profile_record.public_slug) = lower(trim(target_slug))
    AND organization_record.status = 'ACTIVE'
    AND profile_record.is_published = true
  LIMIT 1
$function$;
--> statement-breakpoint
ALTER FUNCTION kebapp_private.public_storefront(text)
  OWNER TO kebapp_policy_executor;
--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.public_storefront(text)
  FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.public_storefront(text)
  TO kebapp_app;
