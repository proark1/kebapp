-- Die Domain-Verwaltung des Prueftischs las store_profiles direkt. Die
-- Auswahlrichtlinie dieser Tabelle verlangt aber eine gesetzte
-- Organisation - im Adminkontext ist genau die leer. Die Liste blieb
-- deshalb immer leer, unabhaengig von den Daten.
--
-- Wie beim Ladenverzeichnis uebernimmt jetzt eine eng geschnittene
-- Definer-Funktion die Abfrage. Sie liefert ausschliesslich Domainfelder
-- und nur an die Adminrolle.
CREATE FUNCTION kebapp_private.admin_domain_requests()
RETURNS TABLE(
  organization_id uuid,
  store_name text,
  public_slug text,
  requested_domain text,
  connected_domain text,
  domain_request_status text,
  domain_requested_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT
    profile_record.organization_id,
    profile_record.name::text,
    profile_record.public_slug::text,
    profile_record.requested_domain::text,
    profile_record.custom_domain::text,
    profile_record.domain_request_status,
    profile_record.domain_requested_at
  FROM public.store_profiles AS profile_record
  WHERE kebapp_private.is_platform_admin()
    AND (
      profile_record.domain_request_status = 'REVIEW_REQUESTED'
      OR profile_record.custom_domain IS NOT NULL
    )
  ORDER BY profile_record.name
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.admin_domain_requests()
  OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.admin_domain_requests()
  FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.admin_domain_requests()
  TO kebapp_app;
