"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";
import {
  assignSupport,
  endSupportAssignment,
  SupportAssignmentConflictError,
  SupportAssignmentNotFoundError,
} from "@/server/support/service";

const assignSchema = z.object({
  expiresAt: z.string().trim(),
  organizationId: z.uuid(),
  purpose: z.string().trim().min(10).max(600),
  supportUserId: z.string().min(1).max(255),
});
const endSchema = z.object({
  assignmentId: z.uuid(),
  organizationId: z.uuid(),
  reason: z.string().trim().min(10).max(600),
});

function value(formData: FormData, field: string) {
  const candidate = formData.get(field);
  return typeof candidate === "string" ? candidate : "";
}

function redirectWithMessage(message: string): never {
  redirect(`/admin/support?meldung=${message}`);
}

export async function assignSupportAction(formData: FormData): Promise<void> {
  const actor = await requirePlatformAdminPage("/admin/support");
  const parsed = assignSchema.safeParse({
    expiresAt: value(formData, "expiresAt"),
    organizationId: value(formData, "organizationId"),
    purpose: value(formData, "purpose"),
    supportUserId: value(formData, "supportUserId"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }
  const expiresAt = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await assignSupport({ actor, ...parsed.data, expiresAt });
  } catch (error) {
    if (error instanceof SupportAssignmentConflictError) {
      return redirectWithMessage("doppelt");
    }
    if (error instanceof SupportAssignmentNotFoundError) {
      return redirectWithMessage("nicht-gefunden");
    }
    throw error;
  }

  revalidatePath("/admin/support");
  revalidatePath("/admin/audit");
  revalidatePath("/support");
  redirectWithMessage("zugewiesen");
}

export async function endSupportAssignmentAction(
  formData: FormData,
): Promise<void> {
  const actor = await requirePlatformAdminPage("/admin/support");
  const parsed = endSchema.safeParse({
    assignmentId: value(formData, "assignmentId"),
    organizationId: value(formData, "organizationId"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await endSupportAssignment({ actor, ...parsed.data });
  } catch (error) {
    if (error instanceof SupportAssignmentNotFoundError) {
      return redirectWithMessage("nicht-gefunden");
    }
    throw error;
  }

  revalidatePath("/admin/support");
  revalidatePath("/admin/audit");
  revalidatePath("/support");
  redirectWithMessage("beendet");
}
