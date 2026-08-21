"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformSupportPage } from "@/server/auth/page-guards";
import { TenantAccessDeniedError } from "@/server/db/tenant-context";
import {
  addDemandItem,
  DemandLockedError,
  DemandNotFoundError,
  removeDemandItem,
  updateDemandItemQuantity,
} from "@/server/procurement/mutations";
import {
  demandItemInputSchema,
  demandQuantitySchema,
  procurementIdSchema,
} from "@/server/procurement/validation";
import {
  StorefrontPermissionDeniedError,
  StorefrontPublicationError,
  updateStorefrontProfile,
} from "@/server/storefront/mutations";
import { getStorefrontEditor } from "@/server/storefront/queries";
import { SupportReasonRequiredError } from "@/server/support/service";

const reasonSchema = z.string().trim().min(10).max(600);
const updateSchema = z.object({
  demandItemId: procurementIdSchema,
  organizationId: procurementIdSchema,
  quantity: demandQuantitySchema,
  reason: reasonSchema,
});
const removeSchema = z.object({
  demandItemId: procurementIdSchema,
  organizationId: procurementIdSchema,
  reason: reasonSchema,
});
const phoneSchema = z.object({
  organizationId: procurementIdSchema,
  phone: z.string().trim().min(3).max(40),
  reason: reasonSchema,
});

function value(formData: FormData, field: string) {
  const candidate = formData.get(field);
  return typeof candidate === "string" ? candidate : "";
}

function redirectWithMessage(organizationId: string, message: string): never {
  redirect(`/support/laeden/${organizationId}?meldung=${message}`);
}

function handleOperationalError(error: unknown, organizationId: string): never {
  if (error instanceof TenantAccessDeniedError) {
    redirect("/support?meldung=kein-zugriff");
  }
  if (error instanceof SupportReasonRequiredError) {
    return redirectWithMessage(organizationId, "grund-fehlt");
  }
  if (error instanceof DemandLockedError || error instanceof DemandNotFoundError) {
    return redirectWithMessage(organizationId, "gesperrt");
  }
  throw error;
}

function refresh(organizationId: string) {
  revalidatePath(`/support/laeden/${organizationId}`);
  revalidatePath("/admin/audit");
}

export async function supportUpdateDemandAction(formData: FormData): Promise<void> {
  const actor = await requirePlatformSupportPage("/support");
  const parsed = updateSchema.safeParse({
    demandItemId: value(formData, "demandItemId"),
    organizationId: value(formData, "organizationId"),
    quantity: value(formData, "quantity"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) {
    return redirectWithMessage(value(formData, "organizationId"), "ungueltig");
  }
  try {
    await updateDemandItemQuantity({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: parsed.data.organizationId,
      quantity: parsed.data.quantity,
      supportReason: parsed.data.reason,
    });
  } catch (error) {
    return handleOperationalError(error, parsed.data.organizationId);
  }
  refresh(parsed.data.organizationId);
  redirectWithMessage(parsed.data.organizationId, "bedarf-gespeichert");
}

export async function supportRemoveDemandAction(formData: FormData): Promise<void> {
  const actor = await requirePlatformSupportPage("/support");
  const parsed = removeSchema.safeParse({
    demandItemId: value(formData, "demandItemId"),
    organizationId: value(formData, "organizationId"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) {
    return redirectWithMessage(value(formData, "organizationId"), "ungueltig");
  }
  try {
    await removeDemandItem({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: parsed.data.organizationId,
      supportReason: parsed.data.reason,
    });
  } catch (error) {
    return handleOperationalError(error, parsed.data.organizationId);
  }
  refresh(parsed.data.organizationId);
  redirectWithMessage(parsed.data.organizationId, "bedarf-entfernt");
}

export async function supportAddDemandAction(formData: FormData): Promise<void> {
  const actor = await requirePlatformSupportPage("/support");
  const organizationId = value(formData, "organizationId");
  const parsedOrganization = procurementIdSchema.safeParse(organizationId);
  const parsedReason = reasonSchema.safeParse(value(formData, "reason"));
  const parsedItem = demandItemInputSchema.safeParse({
    buyingRoundId: value(formData, "buyingRoundId"),
    productName: value(formData, "productName"),
    quantity: value(formData, "quantity"),
    requestedDeliveryDate: value(formData, "requestedDeliveryDate"),
    specification: value(formData, "specification"),
    unit: value(formData, "unit"),
  });
  if (!parsedOrganization.success || !parsedReason.success || !parsedItem.success) {
    return redirectWithMessage(organizationId, "ungueltig");
  }
  try {
    await addDemandItem({
      actor,
      input: parsedItem.data,
      organizationId: parsedOrganization.data,
      supportReason: parsedReason.data,
    });
  } catch (error) {
    return handleOperationalError(error, parsedOrganization.data);
  }
  refresh(parsedOrganization.data);
  redirectWithMessage(parsedOrganization.data, "bedarf-hinzugefuegt");
}

export async function supportUpdatePhoneAction(formData: FormData): Promise<void> {
  const actor = await requirePlatformSupportPage("/support");
  const parsed = phoneSchema.safeParse({
    organizationId: value(formData, "organizationId"),
    phone: value(formData, "phone"),
    reason: value(formData, "reason"),
  });
  if (!parsed.success) {
    return redirectWithMessage(value(formData, "organizationId"), "ungueltig");
  }
  try {
    const editor = await getStorefrontEditor({
      actor,
      organizationId: parsed.data.organizationId,
    });
    const saved = await updateStorefrontProfile({
      actor,
      isPublished: editor.isPublished,
      organizationId: parsed.data.organizationId,
      profile: { ...editor.profile, phone: parsed.data.phone },
      supportReason: parsed.data.reason,
    });
    revalidatePath(`/laden/${saved.publicSlug}`);
  } catch (error) {
    if (error instanceof StorefrontPermissionDeniedError || error instanceof TenantAccessDeniedError) {
      redirect("/support?meldung=kein-zugriff");
    }
    if (error instanceof StorefrontPublicationError) {
      return redirectWithMessage(parsed.data.organizationId, "website-unvollstaendig");
    }
    return handleOperationalError(error, parsed.data.organizationId);
  }
  refresh(parsed.data.organizationId);
  redirectWithMessage(parsed.data.organizationId, "website-gespeichert");
}
