CREATE TABLE "store_geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"radius_meters" integer DEFAULT 150 NOT NULL,
	"label" varchar(180),
	"enforced" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_geofences_coordinates_valid" CHECK ("store_geofences"."latitude" between -90 and 90 and "store_geofences"."longitude" between -180 and 180),
	CONSTRAINT "store_geofences_radius_range" CHECK ("store_geofences"."radius_meters" between 25 and 5000)
);
--> statement-breakpoint
ALTER TABLE "store_geofences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "started_distance_meters" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "started_accuracy_meters" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "ended_distance_meters" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "ended_accuracy_meters" integer;--> statement-breakpoint
ALTER TABLE "store_geofences" ADD CONSTRAINT "store_geofences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_geofences" ADD CONSTRAINT "store_geofences_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_geofences_organization_unique" ON "store_geofences" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_distances_non_negative" CHECK (("time_entries"."started_distance_meters" is null or "time_entries"."started_distance_meters" >= 0)
        and ("time_entries"."ended_distance_meters" is null or "time_entries"."ended_distance_meters" >= 0)
        and ("time_entries"."started_accuracy_meters" is null or "time_entries"."started_accuracy_meters" >= 0)
        and ("time_entries"."ended_accuracy_meters" is null or "time_entries"."ended_accuracy_meters" >= 0));

-- === Mandantensicherheit Ladenstandort ===
-- Lesen darf jedes aktive Teammitglied: ohne Radius kann das Telefon
-- beim Stempeln nicht sagen, ob es am Laden steht. Aendern darf nur die
-- Inhaberschaft - der Radius entscheidet im scharfen Modus darueber, ob
-- Arbeitszeit angenommen wird.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.store_geofences TO kebapp_app;--> statement-breakpoint

ALTER TABLE public.store_geofences FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY store_geofences_select
ON public.store_geofences
FOR SELECT TO kebapp_app
USING (kebapp_private.can_edit_demand(organization_id));--> statement-breakpoint

CREATE POLICY store_geofences_write
ON public.store_geofences
FOR ALL TO kebapp_app
USING (kebapp_private.can_confirm_demand(organization_id))
WITH CHECK (kebapp_private.can_confirm_demand(organization_id));
