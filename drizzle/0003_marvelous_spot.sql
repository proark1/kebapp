ALTER TABLE "invitations" ADD COLUMN "revoked_by_user_id" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

GRANT SELECT ON TABLE
  public."user",
  public.invitations,
  public.organizations
TO kebapp_policy_executor;--> statement-breakpoint

CREATE FUNCTION kebapp_private.current_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT lower(user_record.email)
  FROM public."user" AS user_record
  WHERE user_record.id = kebapp_private.current_user_id()
    AND user_record.email_verified = true
$function$;--> statement-breakpoint

CREATE FUNCTION kebapp_private.can_accept_employee_invitation(
  target_organization_id uuid,
  target_user_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT target_user_id = kebapp_private.current_user_id()
    AND kebapp_private.current_organization_id() = target_organization_id
    AND EXISTS (
      SELECT 1
      FROM public.invitations AS invitation_record
      JOIN public.organizations AS organization_record
        ON organization_record.id = invitation_record.organization_id
      WHERE invitation_record.organization_id = target_organization_id
        AND lower(invitation_record.email) =
          kebapp_private.current_verified_email()
        AND invitation_record.role = 'EMPLOYEE'
        AND invitation_record.status = 'PENDING'
        AND invitation_record.token_hash = nullif(
          current_setting('kebapp.invitation_token_hash', true),
          ''
        )
        AND invitation_record.expires_at > now()
        AND organization_record.status = 'ACTIVE'
    )
$function$;--> statement-breakpoint

ALTER FUNCTION kebapp_private.current_verified_email()
  OWNER TO kebapp_policy_executor;--> statement-breakpoint
ALTER FUNCTION kebapp_private.can_accept_employee_invitation(uuid, text)
  OWNER TO kebapp_policy_executor;--> statement-breakpoint

REVOKE ALL ON FUNCTION kebapp_private.current_verified_email()
  FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION kebapp_private.can_accept_employee_invitation(uuid, text)
  FROM PUBLIC;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION kebapp_private.current_verified_email()
  TO kebapp_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kebapp_private.can_accept_employee_invitation(uuid, text)
  TO kebapp_app;--> statement-breakpoint

CREATE POLICY invitations_recipient_select
ON public.invitations
FOR SELECT TO kebapp_app
USING (
  lower(email) = kebapp_private.current_verified_email()
);--> statement-breakpoint

CREATE POLICY invitations_recipient_update
ON public.invitations
FOR UPDATE TO kebapp_app
USING (
  lower(email) = kebapp_private.current_verified_email()
)
WITH CHECK (
  lower(email) = kebapp_private.current_verified_email()
  AND (
    (
      status = 'ACCEPTED'
      AND accepted_by_user_id = kebapp_private.current_user_id()
      AND accepted_at IS NOT NULL
      AND revoked_by_user_id IS NULL
      AND revoked_at IS NULL
    )
    OR (
      status = 'EXPIRED'
      AND expires_at <= now()
      AND accepted_by_user_id IS NULL
      AND accepted_at IS NULL
    )
  )
);--> statement-breakpoint

CREATE POLICY memberships_accept_employee_invitation
ON public.memberships
FOR INSERT TO kebapp_app
WITH CHECK (
  user_id = kebapp_private.current_user_id()
  AND role = 'EMPLOYEE'
  AND status = 'ACTIVE'
  AND invited_by_user_id IS NOT NULL
  AND joined_at IS NOT NULL
  AND kebapp_private.can_accept_employee_invitation(
    organization_id,
    user_id
  )
);
