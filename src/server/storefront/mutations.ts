import "server-only";

import { and, eq } from "drizzle-orm";
import type { StoreProfile } from "@/lib/types";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  memberships,
  organizations,
  storeProfiles,
} from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import {
  isStorefrontProfilePublishable,
  storefrontOrganizationIdSchema,
  storefrontUpdateSchema,
} from "@/server/storefront/validation";

export class StorefrontPermissionDeniedError extends Error {
  constructor() {
    super("Nur Inhaber:innen dürfen die Ladenwebsite bearbeiten.");
    this.name = "StorefrontPermissionDeniedError";
  }
}

export class StorefrontPublicationError extends Error {
  constructor() {
    super(
      "Vor der Veröffentlichung müssen Kontakt, Adresse, Öffnungszeiten und Speisekarte vollständig sein.",
    );
    this.name = "StorefrontPublicationError";
  }
}

function assertPublishable(profile: StoreProfile) {
  if (!isStorefrontProfilePublishable(profile)) {
    throw new StorefrontPublicationError();
  }
}

export async function updateStorefrontProfile(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  isPublished: boolean;
  organizationId: string;
  profile: StoreProfile;
}): Promise<{ isPublished: boolean; publicSlug: string }> {
  const organizationId = storefrontOrganizationIdSchema.parse(
    input.organizationId,
  );
  const values = storefrontUpdateSchema.parse({
    isPublished: input.isPublished,
    profile: input.profile,
  });

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const [membership] = await transaction
        .select({ role: memberships.role })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, organizationId),
            eq(memberships.userId, input.actor.userId),
            eq(memberships.status, "ACTIVE"),
          ),
        )
        .limit(1);
      if (membership?.role !== "OWNER") {
        throw new StorefrontPermissionDeniedError();
      }
      if (values.isPublished) {
        assertPublishable(values.profile);
      }

      const [organization] = await transaction
        .select({ slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      if (!organization) {
        throw new StorefrontPermissionDeniedError();
      }

      const [existing] = await transaction
        .select({
          id: storeProfiles.id,
          isPublished: storeProfiles.isPublished,
          publicSlug: storeProfiles.publicSlug,
          publishedAt: storeProfiles.publishedAt,
        })
        .from(storeProfiles)
        .where(eq(storeProfiles.organizationId, organizationId))
        .limit(1);
      const now = new Date();
      const storedValues = {
        accentColor: values.profile.accent,
        city: values.profile.city,
        description: values.profile.description,
        eyebrow: values.profile.eyebrow,
        isPublished: values.isPublished,
        menu: values.profile.menu.map((item) => ({
          ...item,
          price: item.price.toFixed(2),
        })),
        name: values.profile.name,
        openingHours: values.profile.openingHours,
        phone: values.profile.phone,
        postalCode: values.profile.postalCode,
        publishedAt: values.isPublished ? (existing?.publishedAt ?? now) : null,
        schemaVersion: values.profile.schemaVersion,
        shortName: values.profile.shortName,
        street: values.profile.street,
        tagline: values.profile.tagline,
        updatedAt: now,
      };

      const [saved] = await transaction
        .insert(storeProfiles)
        .values({
          ...storedValues,
          organizationId,
          publicSlug: organization.slug,
        })
        .onConflictDoUpdate({
          target: storeProfiles.organizationId,
          set: storedValues,
        })
        .returning({ id: storeProfiles.id, publicSlug: storeProfiles.publicSlug });

      const publicationChanged =
        (existing?.isPublished ?? false) !== values.isPublished;
      await writeAuditEvent(transaction, {
        action: publicationChanged
          ? values.isPublished
            ? "STOREFRONT_PUBLISHED"
            : "STOREFRONT_UNPUBLISHED"
          : "STOREFRONT_UPDATED",
        actorUserId: input.actor.userId,
        objectId: saved!.id,
        objectType: "store_profile",
        organizationId,
      });

      return {
        isPublished: values.isPublished,
        publicSlug: saved!.publicSlug,
      };
    },
  );
}
