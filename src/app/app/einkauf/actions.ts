"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  addDemandItem,
  confirmDemandSubmission,
  DemandConfirmationDeniedError,
  DemandLockedError,
  DemandNotFoundError,
  EmptyDemandSubmissionError,
  removeDemandItem,
  updateDemandItemQuantity,
} from "@/server/procurement/mutations";
import {
  demandItemInputSchema,
  demandQuantitySchema,
  procurementIdSchema,
} from "@/server/procurement/validation";

const updateSchema = z.object({
  demandItemId: procurementIdSchema,
  quantity: demandQuantitySchema,
});
const itemIdSchema = z.object({ demandItemId: procurementIdSchema });
const roundIdSchema = z.object({ buyingRoundId: procurementIdSchema });

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function redirectWithMessage(message: string): never {
  redirect(`/app/einkauf?meldung=${message}`);
}

function handleExpectedError(error: unknown): never {
  if (error instanceof DemandConfirmationDeniedError) {
    return redirectWithMessage("bestaetigung-verboten");
  }
  if (error instanceof EmptyDemandSubmissionError) {
    return redirectWithMessage("leer");
  }
  if (error instanceof DemandLockedError || error instanceof DemandNotFoundError) {
    return redirectWithMessage("gesperrt");
  }
  throw error;
}

function refreshDemandPages() {
  revalidatePath("/app/einkauf");
  revalidatePath("/app");
}

export async function addDemandItemAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = demandItemInputSchema.safeParse({
    buyingRoundId: formString(formData, "buyingRoundId"),
    productName: formString(formData, "productName"),
    quantity: formString(formData, "quantity"),
    requestedDeliveryDate: formString(formData, "requestedDeliveryDate"),
    specification: formString(formData, "specification"),
    unit: formString(formData, "unit"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await addDemandItem({
      actor,
      input: parsed.data,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("hinzugefuegt");
}

export async function updateDemandQuantityAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = updateSchema.safeParse({
    demandItemId: formString(formData, "demandItemId"),
    quantity: formString(formData, "quantity"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await updateDemandItemQuantity({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: organization.organizationId,
      quantity: parsed.data.quantity,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("gespeichert");
}

export async function removeDemandItemAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = itemIdSchema.safeParse({
    demandItemId: formString(formData, "demandItemId"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await removeDemandItem({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("entfernt");
}

export async function confirmDemandSubmissionAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = roundIdSchema.safeParse({
    buyingRoundId: formString(formData, "buyingRoundId"),
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
  }

  try {
    await confirmDemandSubmission({
      actor,
      buyingRoundId: parsed.data.buyingRoundId,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("bestaetigt");
}
