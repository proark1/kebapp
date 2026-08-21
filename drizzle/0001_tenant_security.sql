-- kebapp_app is the stable login role referenced by the policies below.
-- The narrow policy executor cannot log in and only owns vetted helper functions.
DO $role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'kebapp_policy_executor'
  ) THEN
    CREATE ROLE kebapp_policy_executor
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      BYPASSRLS;
  ELSE
    ALTER ROLE kebapp_policy_executor
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      BYPASSRLS;
  END IF;
END
$role$;--> statement-breakpoint

REVOKE kebapp_policy_executor FROM kebapp_app;--> statement-breakpoint

CREATE SCHEMA kebapp_private AUTHORIZATION kebapp_policy_executor;--> statement-breakpoint
REVOKE ALL ON SCHEMA kebapp_private FROM PUBLIC;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM kebapp_app;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO kebapp_policy_executor;--> statement-breakpoint
GRANT SELECT ON TABLE
  public.organizations,
  public.memberships,
  public.platform_roles,
  public.support_assignments,
  public.demand_submissions
TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT nullif(current_setting('kebapp.user_id', true), '')
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT nullif(current_setting('kebapp.organization_id', true), '')::uuid
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_roles AS role_record
    WHERE role_record.user_id = kebapp_private.current_user_id()
      AND role_record.role = 'ADMIN'
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.has_active_membership(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership_record
    JOIN public.organizations AS organization_record
      ON organization_record.id = membership_record.organization_id
    WHERE membership_record.user_id = kebapp_private.current_user_id()
      AND membership_record.organization_id = target_organization_id
      AND membership_record.status = 'ACTIVE'
      AND organization_record.status = 'ACTIVE'
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.has_active_owner_membership(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships AS membership_record
    JOIN public.organizations AS organization_record
      ON organization_record.id = membership_record.organization_id
    WHERE membership_record.user_id = kebapp_private.current_user_id()
      AND membership_record.organization_id = target_organization_id
      AND membership_record.role = 'OWNER'
      AND membership_record.status = 'ACTIVE'
      AND organization_record.status = 'ACTIVE'
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.has_active_support_assignment(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_assignments AS assignment_record
    JOIN public.platform_roles AS role_record
      ON role_record.user_id = assignment_record.support_user_id
     AND role_record.role = 'SUPPORT'
    JOIN public.organizations AS organization_record
      ON organization_record.id = assignment_record.organization_id
    WHERE assignment_record.support_user_id = kebapp_private.current_user_id()
      AND assignment_record.organization_id = target_organization_id
      AND assignment_record.status = 'ACTIVE'
      AND (
        assignment_record.expires_at IS NULL
        OR assignment_record.expires_at > CURRENT_TIMESTAMP
      )
      AND organization_record.status = 'ACTIVE'
  )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_access_organization(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND kebapp_private.current_organization_id() = target_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.organizations AS organization_record
      WHERE organization_record.id = target_organization_id
        AND organization_record.status = 'ACTIVE'
    )
    AND (
      kebapp_private.is_platform_admin()
      OR kebapp_private.has_active_membership(target_organization_id)
      OR kebapp_private.has_active_support_assignment(target_organization_id)
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_administer_organization(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_organization_id IS NOT NULL
    AND kebapp_private.current_organization_id() = target_organization_id
    AND kebapp_private.is_platform_admin()
    AND EXISTS (
      SELECT 1
      FROM public.organizations AS organization_record
      WHERE organization_record.id = target_organization_id
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_manage_storefront(
  target_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT kebapp_private.can_access_organization(target_organization_id)
    AND (
      kebapp_private.is_platform_admin()
      OR kebapp_private.has_active_owner_membership(target_organization_id)
      OR kebapp_private.has_active_support_assignment(target_organization_id)
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_edit_demand(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT kebapp_private.can_access_organization(target_organization_id)
    AND (
      kebapp_private.is_platform_admin()
      OR kebapp_private.has_active_membership(target_organization_id)
      OR kebapp_private.has_active_support_assignment(target_organization_id)
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_confirm_demand(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT kebapp_private.can_access_organization(target_organization_id)
    AND (
      kebapp_private.is_platform_admin()
      OR kebapp_private.has_active_owner_membership(target_organization_id)
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_manage_members(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT kebapp_private.can_access_organization(target_organization_id)
    AND (
      kebapp_private.is_platform_admin()
      OR kebapp_private.has_active_owner_membership(target_organization_id)
    )
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_edit_submission(
  target_organization_id uuid,
  target_submission_id uuid
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
      FROM public.demand_submissions AS submission_record
      WHERE submission_record.id = target_submission_id
        AND submission_record.organization_id = target_organization_id
        AND submission_record.status = 'DRAFT'
    )
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.current_user_id() OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.current_organization_id() OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.is_platform_admin() OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.has_active_membership(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.has_active_owner_membership(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.has_active_support_assignment(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_access_organization(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_administer_organization(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_manage_storefront(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_edit_demand(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_confirm_demand(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_manage_members(uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_edit_submission(uuid, uuid) OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kebapp_private FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE kebapp_policy_executor
  IN SCHEMA kebapp_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO kebapp_app;--> statement-breakpoint
GRANT USAGE ON SCHEMA kebapp_private TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.current_user_id() TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.current_organization_id() TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.is_platform_admin() TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.has_active_membership(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.has_active_owner_membership(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.has_active_support_assignment(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_access_organization(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_administer_organization(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_manage_storefront(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_edit_demand(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_confirm_demand(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_manage_members(uuid) TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_edit_submission(uuid, uuid) TO kebapp_app;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."user",
  public.session,
  public.account,
  public.verification,
  public.rate_limit,
  public.user_profiles,
  public.platform_roles,
  public.organizations,
  public.memberships,
  public.registration_requests,
  public.invitations,
  public.support_assignments,
  public.audit_events,
  public.buying_rounds,
  public.demand_submissions,
  public.demand_items,
  public.store_profiles
TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.platform_roles FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.registration_requests FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.support_assignments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.support_assignments FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.buying_rounds ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.buying_rounds FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.demand_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.demand_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.demand_submissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.demand_submissions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.store_profiles FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY user_profiles_select
ON public.user_profiles
FOR SELECT TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
);--> statement-breakpoint
CREATE POLICY user_profiles_insert
ON public.user_profiles
FOR INSERT TO kebapp_app
WITH CHECK (user_id = kebapp_private.current_user_id());--> statement-breakpoint
CREATE POLICY user_profiles_update
ON public.user_profiles
FOR UPDATE TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
)
WITH CHECK (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
);--> statement-breakpoint
CREATE POLICY user_profiles_delete
ON public.user_profiles
FOR DELETE TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
);--> statement-breakpoint

CREATE POLICY platform_roles_select
ON public.platform_roles
FOR SELECT TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.is_platform_admin()
);--> statement-breakpoint
CREATE POLICY platform_roles_admin_write
ON public.platform_roles
FOR ALL TO kebapp_app
USING (kebapp_private.is_platform_admin())
WITH CHECK (kebapp_private.is_platform_admin());--> statement-breakpoint

CREATE POLICY organizations_select
ON public.organizations
FOR SELECT TO kebapp_app
USING (
  kebapp_private.can_access_organization(id)
  OR kebapp_private.can_administer_organization(id)
);--> statement-breakpoint
CREATE POLICY organizations_register
ON public.organizations
FOR INSERT TO kebapp_app
WITH CHECK (
  kebapp_private.current_user_id() IS NOT NULL
  AND kebapp_private.current_organization_id() = id
  AND status = 'PENDING'
);--> statement-breakpoint
CREATE POLICY organizations_admin_write
ON public.organizations
FOR UPDATE TO kebapp_app
USING (kebapp_private.can_administer_organization(id))
WITH CHECK (kebapp_private.can_administer_organization(id));--> statement-breakpoint
CREATE POLICY organizations_admin_delete
ON public.organizations
FOR DELETE TO kebapp_app
USING (kebapp_private.can_administer_organization(id));--> statement-breakpoint

CREATE POLICY memberships_select
ON public.memberships
FOR SELECT TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.can_access_organization(organization_id)
  OR kebapp_private.can_administer_organization(organization_id)
);--> statement-breakpoint
CREATE POLICY memberships_manage
ON public.memberships
FOR ALL TO kebapp_app
USING (kebapp_private.can_manage_members(organization_id))
WITH CHECK (kebapp_private.can_manage_members(organization_id));--> statement-breakpoint

CREATE POLICY registration_requests_select
ON public.registration_requests
FOR SELECT TO kebapp_app
USING (
  user_id = kebapp_private.current_user_id()
  OR kebapp_private.can_administer_organization(organization_id)
);--> statement-breakpoint
CREATE POLICY registration_requests_insert
ON public.registration_requests
FOR INSERT TO kebapp_app
WITH CHECK (
  user_id = kebapp_private.current_user_id()
  AND organization_id = kebapp_private.current_organization_id()
  AND status = 'PENDING'
);--> statement-breakpoint
CREATE POLICY registration_requests_admin_update
ON public.registration_requests
FOR UPDATE TO kebapp_app
USING (kebapp_private.can_administer_organization(organization_id))
WITH CHECK (kebapp_private.can_administer_organization(organization_id));--> statement-breakpoint

CREATE POLICY invitations_select
ON public.invitations
FOR SELECT TO kebapp_app
USING (kebapp_private.can_manage_members(organization_id));--> statement-breakpoint
CREATE POLICY invitations_manage
ON public.invitations
FOR ALL TO kebapp_app
USING (kebapp_private.can_manage_members(organization_id))
WITH CHECK (kebapp_private.can_manage_members(organization_id));--> statement-breakpoint

CREATE POLICY support_assignments_select
ON public.support_assignments
FOR SELECT TO kebapp_app
USING (
  support_user_id = kebapp_private.current_user_id()
  OR kebapp_private.can_administer_organization(organization_id)
);--> statement-breakpoint
CREATE POLICY support_assignments_admin_write
ON public.support_assignments
FOR ALL TO kebapp_app
USING (kebapp_private.can_administer_organization(organization_id))
WITH CHECK (kebapp_private.can_administer_organization(organization_id));--> statement-breakpoint

CREATE POLICY audit_events_select
ON public.audit_events
FOR SELECT TO kebapp_app
USING (
  (
    organization_id IS NOT NULL
    AND kebapp_private.can_administer_organization(organization_id)
  )
  OR (
    organization_id IS NOT NULL
    AND kebapp_private.has_active_support_assignment(organization_id)
    AND kebapp_private.current_organization_id() = organization_id
  )
  OR (
    organization_id IS NULL
    AND kebapp_private.is_platform_admin()
  )
);--> statement-breakpoint
CREATE POLICY audit_events_insert
ON public.audit_events
FOR INSERT TO kebapp_app
WITH CHECK (
  actor_user_id = kebapp_private.current_user_id()
  AND (
    (
      organization_id IS NOT NULL
      AND kebapp_private.can_access_organization(organization_id)
    )
    OR (
      organization_id IS NULL
      AND kebapp_private.is_platform_admin()
    )
  )
);--> statement-breakpoint

CREATE POLICY buying_rounds_select
ON public.buying_rounds
FOR SELECT TO kebapp_app
USING (kebapp_private.can_access_organization(organization_id));--> statement-breakpoint
CREATE POLICY buying_rounds_admin_write
ON public.buying_rounds
FOR ALL TO kebapp_app
USING (kebapp_private.can_administer_organization(organization_id))
WITH CHECK (kebapp_private.can_administer_organization(organization_id));--> statement-breakpoint

CREATE POLICY demand_submissions_select
ON public.demand_submissions
FOR SELECT TO kebapp_app
USING (kebapp_private.can_access_organization(organization_id));--> statement-breakpoint
CREATE POLICY demand_submissions_insert
ON public.demand_submissions
FOR INSERT TO kebapp_app
WITH CHECK (
  (
    status = 'DRAFT'
    AND kebapp_private.can_edit_demand(organization_id)
  )
  OR (
    status = 'CONFIRMED'
    AND kebapp_private.can_confirm_demand(organization_id)
  )
);--> statement-breakpoint
CREATE POLICY demand_submissions_update
ON public.demand_submissions
FOR UPDATE TO kebapp_app
USING (
  status = 'DRAFT'
  AND kebapp_private.can_edit_demand(organization_id)
)
WITH CHECK (
  (
    status = 'DRAFT'
    AND kebapp_private.can_edit_demand(organization_id)
  )
  OR (
    status = 'CONFIRMED'
    AND kebapp_private.can_confirm_demand(organization_id)
  )
);--> statement-breakpoint
CREATE POLICY demand_submissions_delete
ON public.demand_submissions
FOR DELETE TO kebapp_app
USING (
  status = 'DRAFT'
  AND kebapp_private.can_edit_demand(organization_id)
);--> statement-breakpoint

CREATE POLICY demand_items_select
ON public.demand_items
FOR SELECT TO kebapp_app
USING (kebapp_private.can_access_organization(organization_id));--> statement-breakpoint
CREATE POLICY demand_items_insert
ON public.demand_items
FOR INSERT TO kebapp_app
WITH CHECK (
  kebapp_private.can_edit_submission(organization_id, submission_id)
);--> statement-breakpoint
CREATE POLICY demand_items_update
ON public.demand_items
FOR UPDATE TO kebapp_app
USING (
  kebapp_private.can_edit_submission(organization_id, submission_id)
)
WITH CHECK (
  kebapp_private.can_edit_submission(organization_id, submission_id)
);--> statement-breakpoint
CREATE POLICY demand_items_delete
ON public.demand_items
FOR DELETE TO kebapp_app
USING (
  kebapp_private.can_edit_submission(organization_id, submission_id)
);--> statement-breakpoint

CREATE POLICY store_profiles_select
ON public.store_profiles
FOR SELECT TO kebapp_app
USING (kebapp_private.can_access_organization(organization_id));--> statement-breakpoint
CREATE POLICY store_profiles_insert
ON public.store_profiles
FOR INSERT TO kebapp_app
WITH CHECK (kebapp_private.can_manage_storefront(organization_id));--> statement-breakpoint
CREATE POLICY store_profiles_update
ON public.store_profiles
FOR UPDATE TO kebapp_app
USING (kebapp_private.can_manage_storefront(organization_id))
WITH CHECK (kebapp_private.can_manage_storefront(organization_id));--> statement-breakpoint
CREATE POLICY store_profiles_delete
ON public.store_profiles
FOR DELETE TO kebapp_app
USING (kebapp_private.can_manage_storefront(organization_id));
