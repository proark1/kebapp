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
  applyDemandTemplate,
  saveDemandTemplate,
  TemplateNotFoundError,
} from "@/server/procurement/templates";
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
  if (error instanceof TemplateNotFoundError) {
    return redirectWithMessage("vorlage-fehlt");
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

type QuietResult = { ok: boolean; code?: string };

async function quietMutation(run: () => Promise<void>): Promise<QuietResult> {
  try {
    await run();
  } catch (error) {
    if (
      error instanceof DemandConfirmationDeniedError ||
      error instanceof EmptyDemandSubmissionError ||
      error instanceof DemandLockedError ||
      error instanceof DemandNotFoundError ||
      error instanceof TemplateNotFoundError
    ) {
      return { ok: false, code: "gesperrt" };
    }
    throw error;
  }
  refreshDemandPages();
  return { ok: true };
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

export async function updateDemandQuantityQuietAction(
  formData: FormData,
): Promise<QuietResult> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = updateSchema.safeParse({
    demandItemId: formString(formData, "demandItemId"),
    quantity: formString(formData, "quantity"),
  });
  if (!parsed.success) {
    return { ok: false, code: "ungueltig" };
  }
  return quietMutation(() =>
    updateDemandItemQuantity({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: organization.organizationId,
      quantity: parsed.data.quantity,
    }),
  );
}

export async function removeDemandItemQuietAction(
  formData: FormData,
): Promise<QuietResult> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );
  const parsed = itemIdSchema.safeParse({
    demandItemId: formString(formData, "demandItemId"),
  });
  if (!parsed.success) {
    return { ok: false, code: "ungueltig" };
  }
  return quietMutation(() =>
    removeDemandItem({
      actor,
      demandItemId: parsed.data.demandItemId,
      organizationId: organization.organizationId,
    }),
  );
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

export async function saveDemandTemplateAction(): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/einkauf",
  );

  try {
    await saveDemandTemplate({
      actor,
      organizationId: organization.organizationId,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("vorlage-gespeichert");
}

export async function applyDemandTemplateAction(
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
    await applyDemandTemplate({
      actor,
      buyingRoundId: parsed.data.buyingRoundId,
      defaultDeliveryDate: formString(formData, "defaultDeliveryDate"),
      organizationId: organization.organizationId,
      requestedDeliveryDate:
        formString(formData, "requestedDeliveryDate") || undefined,
    });
  } catch (error) {
    return handleExpectedError(error);
  }
  refreshDemandPages();
  redirectWithMessage("vorlage-uebernommen");
}
