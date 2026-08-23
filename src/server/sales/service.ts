import "server-only";

// Kassenimport: taegliche Nettoumsaetze (optional Gaestezaehlung) aus einer
// CSV (Semikolon, Kopfzeile Datum;Umsatz;Gaeste) oder manuellen Eingaben.
// Design-Kurzfassung in docs/superpowers/specs/2026-08-23-admin-domains-design.md
// Fortsetzung; Modell bewusst minimal (ein Wert je Tag) fuer Dashboard-Stufe 1.

import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import { salesDaily } from "@/server/db/schema";
import { withTenantContext } from "@/server/db/tenant-context";
import { procurementIdSchema } from "@/server/procurement/validation";
import { authorizeOperationalMutation } from "@/server/support/service";

type PersonnelActor = { userId: string };

const euroSchema = z.coerce.number().finite().min(0).max(100_000);

export const salesRowSchema = z.object({
  businessDate: z.iso.date(),
  guestCount: z.coerce.number().int().min(0).max(10_000).optional(),
  netSalesCents: z.coerce.number().int().min(0),
});

export type SalesRowInput = z.input<typeof salesRowSchema>;

export function parseSalesCsv(csvText: string): SalesRowInput[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const rows: SalesRowInput[] = [];
  for (const [index, line] of lines.entries()) {
    const cells = line.split(/[;,\t]/).map((cell) => cell.trim());
    if (index === 0 && /datum/i.test(cells[0] ?? "")) continue;
    const date = z.iso.date().safeParse(cells[0]);
    if (!date.success) {
      throw new SalesCsvError(`Zeile ${index + 1}: ungültiges Datum.`);
    }
    const euroRaw = (cells[1] ?? "").replace(/[€\s]/g, "").replace(",", ".");
    const euro = euroSchema.safeParse(Number(euroRaw));
    if (!euro.success) {
      throw new SalesCsvError(`Zeile ${index + 1}: ungültiger Umsatz.`);
    }
    let guestCount: number | undefined;
    if (cells[2]) {
      const guests = z.coerce.number().int().min(0).max(10_000).safeParse(cells[2]);
      if (!guests.success) {
        throw new SalesCsvError(`Zeile ${index + 1}: ungültige Gästezahl.`);
      }
      guestCount = guests.data;
    }
    rows.push({
      businessDate: date.data,
      guestCount,
      netSalesCents: Math.round(euro.data * 100),
    });
  }
  return rows;
}

export class SalesCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SalesCsvError";
  }
}

export async function upsertDailySales(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  now?: Date;
  organizationId: string;
  rows: SalesRowInput[];
  supportReason?: string;
  source?: "CSV" | "MANUAL";
}): Promise<{ rowCount: number }> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const parsedRows = z.array(salesRowSchema).parse(input.rows).slice(0, 400);
  if (parsedRows.length === 0) {
    return { rowCount: 0 };
  }
  const now = input.now ?? new Date();

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      for (const row of parsedRows) {
        await transaction
          .insert(salesDaily)
          .values({
            businessDate: row.businessDate,
            guestCount: row.guestCount ?? null,
            importedByUserId: input.actor.userId,
            netSalesCents: row.netSalesCents,
            organizationId,
            source: input.source ?? "CSV",
          })
          .onConflictDoUpdate({
            set: {
              guestCount: row.guestCount ?? null,
              importedByUserId: input.actor.userId,
              netSalesCents: row.netSalesCents,
              source: input.source ?? "CSV",
              updatedAt: now,
            },
            target: [salesDaily.organizationId, salesDaily.businessDate],
          });
      }

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_SALES_IMPORTED",
          actorUserId: input.actor.userId,
          metadata: { rowCount: parsedRows.length },
          objectId: organizationId,
          objectType: "organization",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "SALES_IMPORTED",
        actorUserId: input.actor.userId,
        metadata: { rowCount: parsedRows.length, source: input.source ?? "CSV" },
        objectId: organizationId,
        objectType: "organization",
        organizationId,
      });
    },
  );

  return { rowCount: parsedRows.length };
}

export async function listRecentSales(input: {
  actor: PersonnelActor;
  database?: KebappDatabase;
  days?: number;
  organizationId: string;
}): Promise<
  Array<{
    businessDate: string;
    guestCount: number | null;
    netSalesEuros: number;
    source: "CSV" | "MANUAL";
  }>
> {
  const organizationId = procurementIdSchema.parse(input.organizationId);
  const days = Math.min(Math.max(input.days ?? 30, 7), 120);
  const since = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.now() - (days - 1) * 86_400_000));

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
      });

      const rows = await transaction
        .select({
          businessDate: salesDaily.businessDate,
          guestCount: salesDaily.guestCount,
          netSalesCents: salesDaily.netSalesCents,
          source: salesDaily.source,
        })
        .from(salesDaily)
        .where(
          and(
            eq(salesDaily.organizationId, organizationId),
            gte(salesDaily.businessDate, since),
          ),
        )
        .orderBy(desc(salesDaily.businessDate));

      return rows.map((row) => ({
        businessDate: row.businessDate,
        guestCount: row.guestCount,
        netSalesEuros: row.netSalesCents / 100,
        source: row.source,
      }));
    },
  );
}
