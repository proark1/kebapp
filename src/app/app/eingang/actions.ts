"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  ReceiptNotFoundError,
  ReceiptRoundNotAllowedError,
  saveGoodsReceipt,
} from "@/server/procurement/receipts";

const allowedReasons = new Set(["SHORTAGE", "QUALITY", "WRONG_ITEM", "OTHER"]);
const itemIdSchema = z.string().uuid();

function value(formData: FormData, name: string): string {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate : "";
}

export async function saveGoodsReceiptAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/eingang",
  );
  const buyingRoundId = value(formData, "buyingRoundId");

  function fail(message: string): never {
    redirect(
      `/app/eingang?runde=${encodeURIComponent(buyingRoundId)}&meldung=${message}`,
    );
  }

  if (!itemIdSchema.safeParse(buyingRoundId).success) {
    return fail("ungueltig");
  }

  type ParsedLine = {
    demandItemId: string;
    reason?: "OTHER" | "QUALITY" | "SHORTAGE" | "WRONG_ITEM";
    reasonNote?: string;
    receivedQuantity: string;
  };
  const lines: ParsedLine[] = [];

  for (const key of formData.keys()) {
    if (!key.startsWith("received-")) continue;
    const demandItemId = key.slice("received-".length);
    if (!itemIdSchema.safeParse(demandItemId).success) {
      return fail("ungueltig");
    }
    const reason = value(formData, `reason-${demandItemId}`);
    const reasonNote = value(formData, `reasonNote-${demandItemId}`);
    lines.push({
      demandItemId,
      reason: allowedReasons.has(reason)
        ? (reason as ParsedLine["reason"])
        : undefined,
      reasonNote: reasonNote || undefined,
      receivedQuantity: value(formData, key),
    });
  }

  if (lines.length === 0) {
    return fail("ungueltig");
  }

  try {
    await saveGoodsReceipt({
      actor,
      input: { buyingRoundId, lines, note: value(formData, "note") || undefined },
      organizationId: organization.organizationId,
    });
  } catch (error) {
    if (
      error instanceof ReceiptRoundNotAllowedError ||
      error instanceof ReceiptNotFoundError
    ) {
      return fail("gesperrt");
    }
    throw error;
  }

  revalidatePath("/app/eingang");
  revalidatePath("/app");
  redirect(
    `/app/eingang?runde=${encodeURIComponent(buyingRoundId)}&meldung=gespeichert`,
  );
}
