import "server-only";

import { z } from "zod";

export const procurementIdSchema = z.uuid();

export const demandQuantitySchema = z.coerce
  .number()
  .finite()
  .min(0.001, "Die Menge muss größer als null sein.")
  .max(500, "Die Menge darf höchstens 500 betragen.");

export const demandItemInputSchema = z.object({
  buyingRoundId: procurementIdSchema,
  productName: z.string().trim().min(2).max(180),
  quantity: demandQuantitySchema,
  requestedDeliveryDate: z.iso.date(),
  specification: z.string().trim().max(1_000).optional(),
  unit: z.enum(["KG", "PIECE"]),
});

export type DemandItemInput = z.input<typeof demandItemInputSchema>;
