CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"note" varchar(300),
	"corrected_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_end_after_start" CHECK ("time_entries"."ended_at" is null or "time_entries"."ended_at" > "time_entries"."started_at")
);
--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_corrected_by_user_id_user_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_open_shift_unique" ON "time_entries" USING btree ("organization_id","user_id") WHERE "time_entries"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "time_entries_org_user_started_idx" ON "time_entries" USING btree ("organization_id","user_id","started_at");
-- === Mandantensicherheit Zeiterfassung ===

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.time_entries TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY time_entries_select
ON public.time_entries
FOR SELECT TO kebapp_app
USING (
  kebapp_private.can_access_organization(organization_id)
  AND (
    user_id = kebapp_private.current_user_id()
    OR kebapp_private.has_active_owner_membership(organization_id)
    OR kebapp_private.is_platform_admin()
    OR kebapp_private.has_active_support_assignment(organization_id)
  )
);--> statement-breakpoint
CREATE POLICY time_entries_insert
ON public.time_entries
FOR INSERT TO kebapp_app
WITH CHECK (
  kebapp_private.can_access_organization(organization_id)
  AND (
    user_id = kebapp_private.current_user_id()
    OR kebapp_private.has_active_owner_membership(organization_id)
    OR kebapp_private.is_platform_admin()
  )
);--> statement-breakpoint
CREATE POLICY time_entries_update
ON public.time_entries
FOR UPDATE TO kebapp_app
USING (
  kebapp_private.can_access_organization(organization_id)
  AND (
    (user_id = kebapp_private.current_user_id() AND ended_at IS NULL)
    OR kebapp_private.has_active_owner_membership(organization_id)
    OR kebapp_private.is_platform_admin()
    OR kebapp_private.has_active_support_assignment(organization_id)
  )
)
WITH CHECK (
  kebapp_private.can_access_organization(organization_id)
);--> statement-breakpoint
CREATE POLICY time_entries_delete
ON public.time_entries
FOR DELETE TO kebapp_app
USING (
  kebapp_private.can_access_organization(organization_id)
  AND (
    kebapp_private.has_active_owner_membership(organization_id)
    OR kebapp_private.is_platform_admin()
  )
);
