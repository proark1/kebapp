"use server";

// Oeffentlich erreichbare Aktion ohne Anmeldung. Sie wird nur aufgerufen, wenn
// der Gast der Speicherung ausdruecklich zugestimmt hat. Alle inhaltlichen
// Pruefungen - Laden veroeffentlicht, Bestellart erlaubt, Gericht auf der
// Karte, Preis - passieren serverseitig in kebapp_private.record_storefront_order.

import { z } from "zod";
import { normalizeGuestPhone } from "@/lib/guest-identity";
import {
  recordStorefrontOrder,
  StorefrontOrderRejectedError,
} from "@/server/guests/service";

const submitSchema = z.object({
  deliveryAddress: z.string().trim().max(240).default(""),
  itemId: z.string().trim().min(1).max(80),
  mode: z.enum(["PICKUP", "DELIVERY"]),
  name: z.string().trim().max(120).default(""),
  note: z.string().trim().max(300).default(""),
  phone: z.string().trim().min(1).max(40),
  quantity: z.number().int().min(1).max(20),
  slug: z.string().trim().min(1).max(100),
});

export type StorefrontOrderSubmission = z.input<typeof submitSchema>;

export type StorefrontOrderActionResult =
  | { message: string; ok: false }
  | { ok: true; stampCount: number };

export async function submitStorefrontOrderAction(
  input: StorefrontOrderSubmission,
): Promise<StorefrontOrderActionResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { message: "Die Angaben sind unvollständig.", ok: false };
  }

  const phone = normalizeGuestPhone(parsed.data.phone);
  if (!phone) {
    return { message: "Bitte gib eine gültige Telefonnummer an.", ok: false };
  }

  try {
    const result = await recordStorefrontOrder({
      deliveryAddress: parsed.data.deliveryAddress,
      itemId: parsed.data.itemId,
      mode: parsed.data.mode,
      name: parsed.data.name,
      note: parsed.data.note,
      phone,
      quantity: parsed.data.quantity,
      slug: parsed.data.slug,
    });
    return { ok: true, stampCount: result.stampCount };
  } catch (error) {
    if (error instanceof StorefrontOrderRejectedError) {
      return { message: error.message, ok: false };
    }
    return {
      message: "Die Bestellung konnte nicht gespeichert werden.",
      ok: false,
    };
  }
}
