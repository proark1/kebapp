"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createBuyingRound,
  DuplicateTierThresholdError,
  RoundNotFoundError,
  RoundTransitionError,
  transitionBuyingRound,
} from "@/server/procurement/rounds";
import { getOptionalSession } from "@/server/auth/session";

export type AdminRoundFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "idle" | "error" | "success";
};

const createSchema = z.object({
  closesAt: z.string().min(1),
  deliveryEndsAt: z.string().min(1),
  deliveryStartsAt: z.string().min(1),
  name: z.string().trim().min(2).max(180),
  organizationId: z.uuid(),
  pricingTiersJson: z.string().optional(),
  referenceUnitPrice: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  regionalKey: z.string().trim().min(2).max(120),
  targetQuantity: z.string().trim().min(1),
});

const tiersJsonSchema = z.object({
  label: z.string(),
  minimumQuantity: z.number(),
  unitPrice: z.number(),
});

function value(formData: FormData, field: string): string {
  const candidate = formData.get(field);
  return typeof candidate === "string" ? candidate : "";
}

async function requireActorOrRedirect() {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/admin/runden");
  }
  return actor;
}

export async function createBuyingRoundAction(
  _state: AdminRoundFormState,
  formData: FormData,
): Promise<AdminRoundFormState> {
  const actor = await requireActorOrRedirect();

  const parsed = createSchema.safeParse({
    closesAt: value(formData, "closesAt"),
    deliveryEndsAt: value(formData, "deliveryEndsAt"),
    deliveryStartsAt: value(formData, "deliveryStartsAt"),
    name: value(formData, "name"),
    organizationId: value(formData, "organizationId"),
    pricingTiersJson: value(formData, "pricingTiersJson") || undefined,
    referenceUnitPrice: value(formData, "referenceUnitPrice") || undefined,
    regionalKey: value(formData, "regionalKey"),
    targetQuantity: value(formData, "targetQuantity"),
  });

  if (!parsed.success) {
    return fieldErrorState(parsed.error);
  }

  let pricingTiers: Array<{
    label: string;
    minimumQuantity: number;
    unitPrice: number;
  }> = [];
  if (parsed.data.pricingTiersJson) {
    let rawTiers: unknown;
    try {
      rawTiers = JSON.parse(parsed.data.pricingTiersJson);
    } catch {
      return {
        message: "Die Preisstufen konnten nicht gelesen werden.",
        status: "error",
      };
    }
    const tiers = z.array(tiersJsonSchema).safeParse(rawTiers);
    if (!tiers.success) {
      return fieldErrorState(tiers.error, "pricingTiers");
    }
    pricingTiers = tiers.data;
  }

  let roundId: string;
  try {
    const result = await createBuyingRound({
      actor,
      input: {
        closesAt: parsed.data.closesAt,
        deliveryEndsAt: parsed.data.deliveryEndsAt,
        deliveryStartsAt: parsed.data.deliveryStartsAt,
        name: parsed.data.name,
        organizationId: parsed.data.organizationId,
        pricingTiers,
        referenceUnitPrice: parsed.data.referenceUnitPrice
          ? Number(parsed.data.referenceUnitPrice.replace(",", "."))
          : undefined,
        regionalKey: parsed.data.regionalKey,
        targetQuantity: Number(parsed.data.targetQuantity.replace(",", ".")),
      },
    });
    roundId = result.roundId;
  } catch (error) {
    if (error instanceof DuplicateTierThresholdError) {
      return {
        fieldErrors: { pricingTiers: error.message },
        message: error.message,
        status: "error",
      };
    }
    console.error("Das Anlegen der Sammelrunde ist fehlgeschlagen.");
    return {
      message:
        error instanceof Error && error.message.includes("Bestellschluss")
          ? error.message
          : "Die Sammelrunde konnte nicht angelegt werden.",
      status: "error",
    };
  }

  revalidatePath("/admin/runden");
  revalidatePath("/admin");
  redirect(`/admin/runden/${roundId}?aktion=angelegt`);
}

function fieldErrorState(
  error: z.ZodError,
  fallbackField = "form",
): AdminRoundFormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? fallbackField);
    fieldErrors[key] ??= issue.message;
  }
  return {
    fieldErrors,
    message: "Bitte prüfe die markierten Felder.",
    status: "error",
  };
}

export async function transitionBuyingRoundAction(
  formData: FormData,
): Promise<void> {
  const actor = await requireActorOrRedirect();
  const action = value(formData, "action");

  try {
    await transitionBuyingRound({
      action: z.enum(["OPEN", "CLOSE", "SUBMIT", "CANCEL"]).parse(action),
      actor,
      reason: value(formData, "reason") || undefined,
      roundId: z.uuid().parse(value(formData, "roundId")),
    });
  } catch (error) {
    if (error instanceof RoundTransitionError) {
      redirect("/admin/runden?meldung=uebergang");
    }
    if (!(error instanceof RoundNotFoundError)) {
      console.error("Der Rundenstatuswechsel ist fehlgeschlagen.");
    }
    redirect("/admin/runden?meldung=nicht-gefunden");
  }

  revalidatePath("/admin/runden");
  revalidatePath(`/admin/runden/${value(formData, "roundId")}`);
  revalidatePath("/app/einkauf");
  redirect(`/admin/runden?meldung=${encodeURIComponent(action.toLowerCase())}`);
}
