CREATE UNIQUE INDEX "registration_requests_user_pending_unique" ON "registration_requests" USING btree ("user_id") WHERE "registration_requests"."status" = 'PENDING';--> statement-breakpoint

GRANT SELECT ON TABLE
  public."user",
  public.registration_requests
TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_start_registration(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND kebapp_private.current_user_id() IS NOT NULL
    AND kebapp_private.current_organization_id() = target_organization_id
    AND EXISTS (
      SELECT 1
      FROM public."user" AS user_record
      WHERE user_record.id = kebapp_private.current_user_id()
        AND user_record.email_verified = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.registration_requests AS request_record
      WHERE request_record.user_id = kebapp_private.current_user_id()
        AND request_record.status = 'PENDING'
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_register_owner_membership(
  target_organization_id uuid,
  target_user_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND target_user_id = kebapp_private.current_user_id()
    AND kebapp_private.current_organization_id() = target_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.organizations AS organization_record
      WHERE organization_record.id = target_organization_id
        AND organization_record.status = 'PENDING'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.memberships AS membership_record
      WHERE membership_record.organization_id = target_organization_id
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_submit_registration(
  target_organization_id uuid,
  target_user_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND target_user_id = kebapp_private.current_user_id()
    AND kebapp_private.current_organization_id() = target_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.organizations AS organization_record
      JOIN public.memberships AS membership_record
        ON membership_record.organization_id = organization_record.id
      WHERE organization_record.id = target_organization_id
        AND organization_record.status = 'PENDING'
        AND membership_record.user_id = target_user_id
        AND membership_record.role = 'OWNER'
        AND membership_record.status = 'INVITED'
    )
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.can_start_registration(uuid)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_register_owner_membership(uuid, text)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_submit_registration(uuid, text)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.can_start_registration(uuid)
  FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.can_register_owner_membership(uuid, text)
  FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.can_submit_registration(uuid, text)
  FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.can_start_registration(uuid)
  TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_register_owner_membership(uuid, text)
  TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_submit_registration(uuid, text)
  TO kebapp_app;--> statement-breakpoint

DROP POLICY organizations_register ON public.organizations;--> statement-breakpoint
CREATE POLICY organizations_register
ON public.organizations
FOR INSERT TO kebapp_app
WITH CHECK (
  status = 'PENDING'
  AND kebapp_private.can_start_registration(id)
);--> statement-breakpoint

CREATE POLICY memberships_register_owner
ON public.memberships
FOR INSERT TO kebapp_app
WITH CHECK (
  role = 'OWNER'
  AND status = 'INVITED'
  AND invited_by_user_id IS NULL
  AND joined_at IS NULL
  AND kebapp_private.can_register_owner_membership(
    organization_id,
    user_id
  )
);--> statement-breakpoint

CREATE POLICY memberships_admin_review
ON public.memberships
FOR UPDATE TO kebapp_app
USING (kebapp_private.can_administer_organization(organization_id))
WITH CHECK (kebapp_private.can_administer_organization(organization_id));--> statement-breakpoint

DROP POLICY registration_requests_select
ON public.registration_requests;--> statement-breakpoint
CREATE POLICY registration_requests_select
ON public.registration_requests
FOR SELECT TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
);--> statement-breakpoint

DROP POLICY registration_requests_insert
ON public.registration_requests;--> statement-breakpoint
CREATE POLICY registration_requests_insert
ON public.registration_requests
FOR INSERT TO kebapp_app
WITH CHECK (
  status = 'PENDING'
  AND kebapp_private.can_submit_registration(organization_id, user_id)
);--> statement-breakpoint

DROP POLICY audit_events_insert ON public.audit_events;--> statement-breakpoint
CREATE POLICY audit_events_insert
ON public.audit_events
FOR INSERT TO kebapp_app
WITH CHECK (
  actor_user_id = kebapp_private.current_user_id()
  AND (
    (
      organization_id IS NOT NULL
      AND (
        kebapp_private.can_access_organization(organization_id)
        OR kebapp_private.can_administer_organization(organization_id)
      )
    )
    OR (
      organization_id IS NULL
      AND kebapp_private.is_platform_admin()
    )
  )
);
