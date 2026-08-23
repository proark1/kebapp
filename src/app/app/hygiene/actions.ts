"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import {
  HygieneDateLockedError,
  HygieneNoteRequiredError,
  saveHygieneEntry,
} from "@/server/hygiene/service";

const allowedStatuses = new Set(["OK", "MANGEL"]);

export async function saveHygieneAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/hygiene",
  );
  const date = value(formData, "date");

  function fail(message: string): never {
    redirect(`/app/hygiene?datum=${encodeURIComponent(date)}&meldung=${message}`);
  }

  if (!z.iso.date().safeParse(date).success) {
    return fail("ungueltig");
  }

  type Item = {
    celsius?: number;
    key: string;
    note?: string;
    status?: "MANGEL" | "OK";
  };
  const items: Item[] = [];
  for (const key of formData.keys()) {
    if (!key.startsWith("item-")) continue;
    const itemKey = key.slice("item-".length);
    const kind = value(formData, `kind-${itemKey}`);
    const note = value(formData, `note-${itemKey}`);
    if (kind === "TEMPERATURE") {
      const raw = value(formData, key);
      const celsius = Number(raw.replace(",", "."));
      if (!Number.isFinite(celsius)) {
        return fail("ungueltig");
      }
      items.push({ celsius, key: itemKey, note: note || undefined });
    } else {
      const status = value(formData, key);
      if (!allowedStatuses.has(status)) {
        continue;
      }
      items.push({
        key: itemKey,
        note: note || undefined,
        status: status as "MANGEL" | "OK",
      });
    }
  }

  try {
    await saveHygieneEntry({
      actor,
      input: {
        date,
        items: items as never,
        note: value(formData, "entryNote") || undefined,
      },
      organizationId: organization.organizationId,
    });
  } catch (error) {
    if (error instanceof HygieneNoteRequiredError) {
      return fail("begruendung");
    }
    if (error instanceof HygieneDateLockedError) {
      return fail("gesperrt");
    }
    throw error;
  }

  revalidatePath("/app/hygiene");
  redirect(`/app/hygiene?datum=${encodeURIComponent(date)}&meldung=gespeichert`);
}

function value(formData: FormData, name: string): string {
  const candidate = formData.get(name);
  return typeof candidate === "string" ? candidate : "";
}
