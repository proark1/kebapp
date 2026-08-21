import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import {
  memberships,
  organizations,
  registrationRequests,
  user,
  userProfiles,
} from "@/server/db/schema";

export const storeRegistrationSchema = z.object({
  city: z.string().trim().min(2, "Bitte den Ort angeben.").max(120),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Bitte eine gültige E-Mail-Adresse angeben.")
    .max(320),
  contactName: z
    .string()
    .trim()
    .min(2, "Bitte eine Kontaktperson angeben.")
    .max(180),
  contactPhone: z
    .string()
    .trim()
    .min(5, "Bitte eine Telefonnummer angeben.")
    .max(40),
  legalName: z
    .string()
    .trim()
    .max(220)
    .transform((value) => value || undefined)
    .optional(),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl angeben."),
  storeName: z
    .string()
    .trim()
    .min(2, "Bitte den Namen des Ladens angeben.")
    .max(180),
  street: z.string().trim().min(3, "Bitte die Straße angeben.").max(220),
});

export type StoreRegistrationInput = z.input<typeof storeRegistrationSchema>;

export type RegistrationActor = {
  email: string;
  emailVerified: boolean;
  name: string;
  userId: string;
};

export type RegistrationState =
  | { status: "NONE" }
  | {
      organizationId: string;
      requestId: string;
      status: "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED";
      storeName: string;
      submittedAt: Date;
      reviewNote?: string;
    };

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super("Bitte bestätige zuerst deine E-Mail-Adresse.");
    this.name = "EmailVerificationRequiredError";
  }
}

export class DuplicatePendingRegistrationError extends Error {
  constructor() {
    super("Für dieses Konto liegt bereits ein offener Antrag vor.");
    this.name = "DuplicatePendingRegistrationError";
  }
}

function createOrganizationSlug(storeName: string, organizationId: string) {
  const normalized = storeName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 67);

  return `${normalized || "laden"}-${organizationId.slice(0, 8)}`;
}

function isPendingRequestConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function submitStoreRegistration(input: {
  actor: RegistrationActor;
  database?: KebappDatabase;
  input: StoreRegistrationInput;
}): Promise<{ organizationId: string; requestId: string }> {
  if (!input.actor.emailVerified) {
    throw new EmailVerificationRequiredError();
  }

  const values = storeRegistrationSchema.parse(input.input);
  const database =
    input.database ?? (await import("@/server/db/client")).database;
  const organizationId = randomUUID();
  const requestId = randomUUID();

  try {
    return await database.transaction(async (transaction) => {
      await transaction.execute(sql`
        select
          set_config('kebapp.user_id', ${input.actor.userId}, true),
          set_config('kebapp.organization_id', ${organizationId}, true)
      `);

      const [persistedUser] = await transaction
        .select({ emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.id, input.actor.userId))
        .limit(1);

      if (!persistedUser?.emailVerified) {
        throw new EmailVerificationRequiredError();
      }

      const existingRequest = await transaction
        .select({ id: registrationRequests.id })
        .from(registrationRequests)
        .where(
          and(
            eq(registrationRequests.userId, input.actor.userId),
            eq(registrationRequests.status, "PENDING"),
          ),
        )
        .limit(1);

      if (existingRequest.length > 0) {
        throw new DuplicatePendingRegistrationError();
      }

      await transaction
        .insert(userProfiles)
        .values({
          displayName: input.actor.name,
          userId: input.actor.userId,
        })
        .onConflictDoNothing({ target: userProfiles.userId });

      await transaction.insert(organizations).values({
        id: organizationId,
        legalName: values.legalName,
        slug: createOrganizationSlug(values.storeName, organizationId),
        status: "PENDING",
        storeName: values.storeName,
      });

      await transaction.insert(memberships).values({
        organizationId,
        role: "OWNER",
        status: "INVITED",
        userId: input.actor.userId,
      });

      await transaction.insert(registrationRequests).values({
        ...values,
        id: requestId,
        organizationId,
        status: "PENDING",
        userId: input.actor.userId,
      });

      return { organizationId, requestId };
    });
  } catch (error) {
    if (error instanceof DuplicatePendingRegistrationError) {
      throw error;
    }

    if (isPendingRequestConflict(error)) {
      throw new DuplicatePendingRegistrationError();
    }

    throw error;
  }
}

export async function getRegistrationState(input: {
  actor: { userId: string };
  database?: KebappDatabase;
}): Promise<RegistrationState> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${input.actor.userId}, true),
        set_config('kebapp.organization_id', '', true)
    `);

    const [request] = await transaction
      .select({
        createdAt: registrationRequests.createdAt,
        id: registrationRequests.id,
        organizationId: registrationRequests.organizationId,
        reviewNote: registrationRequests.reviewNote,
        status: registrationRequests.status,
        storeName: registrationRequests.storeName,
      })
      .from(registrationRequests)
      .where(eq(registrationRequests.userId, input.actor.userId))
      .orderBy(desc(registrationRequests.createdAt))
      .limit(1);

    if (!request) {
      return { status: "NONE" };
    }

    if (request.status === "PENDING") {
      return {
        organizationId: request.organizationId,
        requestId: request.id,
        status: "PENDING",
        storeName: request.storeName,
        submittedAt: request.createdAt,
      };
    }

    if (request.status === "REJECTED") {
      return {
        organizationId: request.organizationId,
        requestId: request.id,
        reviewNote: request.reviewNote ?? undefined,
        status: "REJECTED",
        storeName: request.storeName,
        submittedAt: request.createdAt,
      };
    }

    const [membership] = await transaction
      .select({ status: memberships.status })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, request.organizationId),
          eq(memberships.userId, input.actor.userId),
        ),
      )
      .limit(1);

    const status = membership?.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED";

    return {
      organizationId: request.organizationId,
      requestId: request.id,
      status,
      storeName: request.storeName,
      submittedAt: request.createdAt,
    };
  });
}
