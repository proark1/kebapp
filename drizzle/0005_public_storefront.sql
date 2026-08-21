GRANT SELECT ON TABLE public.store_profiles
  TO kebapp_policy_executor;--> statement-breakpoint

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
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.public_storefront(text)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.public_storefront(text)
  FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.public_storefront(text)
  TO kebapp_app;
