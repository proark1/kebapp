CREATE INDEX "support_assignments_user_status_expiry_idx" ON "support_assignments" USING btree ("support_user_id","status","expires_at");--> statement-breakpoint

DROP POLICY organizations_select ON public.organizations;--> statement-breakpoint
CREATE POLICY organizations_select
ON public.organizations
FOR SELECT TO kebapp_app
USING (
  kebapp_private.is_platform_admin()
  OR kebapp_private.has_active_support_assignment(id)
  OR kebapp_private.can_access_organization(id)
  OR kebapp_private.can_administer_organization(id)
);--> statement-breakpoint

DROP POLICY audit_events_select ON public.audit_events;--> statement-breakpoint
CREATE POLICY audit_events_select
ON public.audit_events
FOR SELECT TO kebapp_app
USING (
  kebapp_private.is_platform_admin()
  OR (
    organization_id IS NOT NULL
    AND kebapp_private.has_active_support_assignment(organization_id)
    AND kebapp_private.current_organization_id() = organization_id
  )
);
