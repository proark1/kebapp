import "server-only";

import { eq } from "drizzle-orm";
import type { StoreProfile } from "@/lib/types";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { organizations, storeProfiles } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import {
  isStorefrontProfilePublishable,
  requestedDomainSchema,
  storefrontOrganizationIdSchema,
  storefrontUpdateSchema,
} from "@/server/storefront/validation";
import {
  authorizeOperationalMutation,
  SupportOperationDeniedError,
} from "@/server/support/service";

export class StorefrontPermissionDeniedError extends Error {
  constructor() {
    super("Nur Inhaber:innen dürfen die Ladenwebsite bearbeiten.");
    this.name = "StorefrontPermissionDeniedError";
  }
}

export class StorefrontPublicationError extends Error {
  constructor() {
    super(
      "Vor der Veröffentlichung müssen Kontakt, Adresse, Öffnungszeiten, Speisekarte und Bestelloptionen vollständig sein.",
    );
    this.name = "StorefrontPublicationError";
  }
}

export class StorefrontDomainRequestError extends Error {
  constructor() {
    super("Die gewünschte Domain konnte nicht zur Prüfung vorgemerkt werden.");
    this.name = "StorefrontDomainRequestError";
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
  supportReason?: string;
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
      let authorization: Awaited<
        ReturnType<typeof authorizeOperationalMutation>
      >;
      try {
        authorization = await authorizeOperationalMutation(transaction, {
          actorUserId: input.actor.userId,
          allowedMembershipRoles: ["OWNER"],
          organizationId,
          supportReason: input.supportReason,
        });
      } catch (error) {
        if (error instanceof SupportOperationDeniedError) {
          throw new StorefrontPermissionDeniedError();
        }
        throw error;
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
        deliveryEnabled: values.profile.deliveryEnabled,
        description: values.profile.description,
        eyebrow: values.profile.eyebrow,
        features: values.profile.features,
        heroImageUrl: values.profile.heroImageUrl || null,
        isPublished: values.isPublished,
        logoUrl: values.profile.logoUrl || null,
        menu: values.profile.menu.map((item) => ({
          ...item,
          price: item.price.toFixed(2),
        })),
        name: values.profile.name,
        openingHours: values.profile.openingHours,
        phone: values.profile.phone,
        pickupEnabled: values.profile.pickupEnabled,
        postalCode: values.profile.postalCode,
        publishedAt: values.isPublished ? (existing?.publishedAt ?? now) : null,
        schemaVersion: values.profile.schemaVersion,
        shortName: values.profile.shortName,
        street: values.profile.street,
        tagline: values.profile.tagline,
        whatsappPhone: values.profile.whatsappPhone || null,
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
        action:
          authorization.kind === "SUPPORT"
            ? "SUPPORT_STOREFRONT_UPDATED"
            : publicationChanged
              ? values.isPublished
                ? "STOREFRONT_PUBLISHED"
                : "STOREFRONT_UNPUBLISHED"
              : "STOREFRONT_UPDATED",
        actorUserId: input.actor.userId,
        metadata:
          authorization.kind === "SUPPORT"
            ? {
                change: publicationChanged ? "PUBLICATION_AND_PROFILE" : "PROFILE",
                isPublished: values.isPublished,
              }
            : undefined,
        objectId: saved!.id,
        objectType: "store_profile",
        organizationId,
        reason: authorization.reason,
      });

      return {
        isPublished: values.isPublished,
        publicSlug: saved!.publicSlug,
      };
    },
  );
}

export async function requestStorefrontDomain(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  organizationId: string;
  requestedDomain: string;
  supportReason?: string;
}): Promise<{ requestedDomain: string }> {
  const organizationId = storefrontOrganizationIdSchema.parse(
    input.organizationId,
  );
  const requestedDomain = requestedDomainSchema.parse(input.requestedDomain);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      let authorization: Awaited<
        ReturnType<typeof authorizeOperationalMutation>
      >;
      try {
        authorization = await authorizeOperationalMutation(transaction, {
          actorUserId: input.actor.userId,
          allowedMembershipRoles: ["OWNER"],
          organizationId,
          supportReason: input.supportReason,
        });
      } catch (error) {
        if (error instanceof SupportOperationDeniedError) {
          throw new StorefrontPermissionDeniedError();
        }
        throw error;
      }

      const [saved] = await transaction
        .update(storeProfiles)
        .set({
          domainRequestedAt: new Date(),
          domainRequestStatus: "REVIEW_REQUESTED",
          requestedDomain,
          updatedAt: new Date(),
        })
        .where(eq(storeProfiles.organizationId, organizationId))
        .returning({ id: storeProfiles.id });
      if (!saved) {
        throw new StorefrontDomainRequestError();
      }

      await writeAuditEvent(transaction, {
        action:
          authorization.kind === "SUPPORT"
            ? "SUPPORT_STOREFRONT_DOMAIN_REVIEW_REQUESTED"
            : "STOREFRONT_DOMAIN_REVIEW_REQUESTED",
        actorUserId: input.actor.userId,
        metadata: { requestedDomain },
        objectId: saved.id,
        objectType: "store_profile",
        organizationId,
        reason: authorization.reason,
      });

      return { requestedDomain };
    },
  );
}
