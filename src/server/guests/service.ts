import "server-only";

// Gaestemodul: wiederkehrende Besteller, Stempelkarte und Plattformimport.
//
// Grundsatz: Ein Gastdatensatz entsteht nur nach ausdruecklicher Einwilligung.
// Die oeffentliche Ladenseite schreibt deshalb nicht direkt, sondern ueber
// kebapp_private.record_storefront_order - die einzige Stelle ohne
// Mandantenkontext. Preis und Verfuegbarkeit stammen dort aus dem
// gespeicherten Menue, nie aus der Anfrage.
//
// Stempel werden gezaehlt statt zurueckgesetzt: offene Stempel sind
// abgeschlossene Bestellungen minus bereits eingeloester Stempel.

import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  formatGuestPhone,
  LOYALTY_DEFAULT_REWARD,
  LOYALTY_TARGET,
  normalizeGuestPhone,
} from "@/lib/guest-identity";
import {
  parsePlatformCsv,
  type PlatformImportIssue,
} from "@/lib/platform-import";
import { writeAuditEvent } from "@/server/audit/write-audit-event";
import type { KebappDatabase } from "@/server/db/client";
import {
  guestOrderItems,
  guestOrders,
  guests,
  loyaltyRedemptions,
  platformImports,
} from "@/server/db/schema";
import {
  withTenantContext,
  type TenantTransaction,
} from "@/server/db/tenant-context";
import { authorizeOperationalMutation } from "@/server/support/service";

export type GuestActor = { userId: string };

export type GuestOrderSource = "STOREFRONT" | "PLATTFORM" | "MANUELL";
export type GuestOrderMode = "PICKUP" | "DELIVERY";
export type GuestOrderStatus = "NEU" | "ABGESCHLOSSEN" | "STORNIERT";

export type GuestSummary = {
  firstOrderAt: Date | null;
  id: string;
  lastOrderAt: Date | null;
  name: string | null;
  note: string | null;
  orderCount: number;
  phone: string;
  phoneLabel: string;
  redeemable: boolean;
  stampCount: number;
  totalCents: number;
};

export type GuestOrderItemView = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type GuestOrderView = {
  deliveryAddress: string | null;
  externalReference: string | null;
  id: string;
  items: GuestOrderItemView[];
  mode: GuestOrderMode;
  note: string | null;
  placedAt: Date;
  source: GuestOrderSource;
  status: GuestOrderStatus;
  totalCents: number;
};

export type GuestRedemptionView = {
  id: string;
  redeemedAt: Date;
  rewardLabel: string;
  stampsUsed: number;
};

export type GuestDetail = {
  consentAt: Date;
  consentSource: "STOREFRONT" | "LADEN";
  guest: GuestSummary;
  orders: GuestOrderView[];
  redemptions: GuestRedemptionView[];
};

export type GuestOverview = {
  guestCount: number;
  orders30d: number;
  redeemableCount: number;
  returningCount: number;
  revenue30dCents: number;
  revenueTotalCents: number;
};

export type PlatformImportView = {
  createdCount: number;
  fileName: string;
  id: string;
  importedAt: Date;
  platform: string;
  rowCount: number;
  skippedCount: number;
};

export type PlatformImportOutcome = {
  createdCount: number;
  issues: PlatformImportIssue[];
  rowCount: number;
  skippedCount: number;
};

export class GuestNotFoundError extends Error {
  constructor() {
    super("Dieser Gast wurde nicht gefunden.");
    this.name = "GuestNotFoundError";
  }
}

export class LoyaltyNotReadyError extends Error {
  constructor(public readonly stampCount: number) {
    super(
      `Die Stempelkarte ist noch nicht voll (${stampCount} von ${LOYALTY_TARGET}).`,
    );
    this.name = "LoyaltyNotReadyError";
  }
}

export class StorefrontOrderRejectedError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "StorefrontOrderRejectedError";
  }
}

const organizationIdSchema = z.uuid();
const guestIdSchema = z.uuid();

export const guestPhoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((value, context) => {
    const normalized = normalizeGuestPhone(value);
    if (!normalized) {
      context.addIssue({
        code: "custom",
        message: "Bitte eine gültige Telefonnummer angeben.",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const guestNameSchema = z.string().trim().max(120);
export const guestNoteSchema = z.string().trim().max(300);

export const manualOrderSchema = z.object({
  amountCents: z.coerce.number().int().min(0).max(100_000_00),
  itemLabel: z.string().trim().min(1).max(160).default("Bestellung im Laden"),
  mode: z.enum(["PICKUP", "DELIVERY"]),
  name: guestNameSchema.optional(),
  note: guestNoteSchema.optional(),
  phone: guestPhoneSchema,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export type ManualOrderInput = z.input<typeof manualOrderSchema>;

type OrderStatsRow = {
  first_order_at: Date | null;
  id: string;
  last_placed_at: Date | null;
  name: string | null;
  note: string | null;
  order_count: number;
  phone: string;
  stamp_count: number;
  total_cents: number;
};

function toGuestSummary(row: OrderStatsRow): GuestSummary {
  const stampCount = Number(row.stamp_count ?? 0);
  return {
    firstOrderAt: row.first_order_at,
    id: row.id,
    lastOrderAt: row.last_placed_at,
    name: row.name,
    note: row.note,
    orderCount: Number(row.order_count ?? 0),
    phone: row.phone,
    phoneLabel: formatGuestPhone(row.phone),
    redeemable: stampCount >= LOYALTY_TARGET,
    stampCount,
    totalCents: Number(row.total_cents ?? 0),
  };
}

// Offene Stempel und Bestellsummen je Gast. Wird von Liste, Detail und
// Uebersicht gemeinsam genutzt, damit ueberall dieselbe Zaehlung gilt.
function guestStatsQuery(organizationId: string) {
  return sql`
    with order_stats as (
      select
        guest_id,
        count(*)::int as order_count,
        sum(total_cents)::int as total_cents,
        max(placed_at) as last_placed_at
      from guest_orders
      where organization_id = ${organizationId}::uuid
        and status <> 'STORNIERT'
      group by guest_id
    ),
    redeemed as (
      select guest_id, sum(stamps_used)::int as stamps_used
      from loyalty_redemptions
      where organization_id = ${organizationId}::uuid
      group by guest_id
    ),
    guest_stats as (
      select
        g.id,
        g.phone,
        g.name,
        g.note,
        g.first_order_at,
        g.created_at,
        coalesce(o.last_placed_at, g.last_order_at) as last_placed_at,
        coalesce(o.order_count, 0) as order_count,
        coalesce(o.total_cents, 0) as total_cents,
        greatest(
          coalesce(o.order_count, 0) - coalesce(r.stamps_used, 0),
          0
        ) as stamp_count
      from guests g
      left join order_stats o on o.guest_id = g.id
      left join redeemed r on r.guest_id = g.id
      where g.organization_id = ${organizationId}::uuid
    )
  `;
}

export async function listGuests(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  organizationId: string;
  search?: string;
}): Promise<GuestSummary[]> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const search = (input.search ?? "").trim().slice(0, 60);
  const searchDigits = search.replace(/\D/g, "");
  // Gespeichert wird international ohne fuehrende Null. Wer "0176 33" eintippt,
  // muss den Gast trotzdem finden.
  const nationalDigits = searchDigits.replace(/^0+/, "");

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const result = await transaction.execute<OrderStatsRow>(sql`
        ${guestStatsQuery(organizationId)}
        select *
        from guest_stats
        where ${
          search === ""
            ? sql`true`
            : sql`(
                name ilike ${`%${search}%`}
                or (${searchDigits} <> '' and phone like ${`%${searchDigits}%`})
                or (${nationalDigits} <> '' and phone like ${`%${nationalDigits}%`})
              )`
        }
        order by last_placed_at desc nulls last, created_at desc
        limit 200
      `);
      return result.rows.map(toGuestSummary);
    },
  );
}

export async function getGuestOverview(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<GuestOverview> {
  const organizationId = organizationIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const result = await transaction.execute<{
        guest_count: number;
        orders_30d: number;
        redeemable_count: number;
        returning_count: number;
        revenue_30d: number;
        revenue_total: number;
      }>(sql`
        ${guestStatsQuery(organizationId)}
        select
          (select count(*)::int from guest_stats) as guest_count,
          (select count(*)::int from guest_stats where order_count >= 2)
            as returning_count,
          (select count(*)::int from guest_stats where stamp_count >= ${LOYALTY_TARGET})
            as redeemable_count,
          (
            select count(*)::int from guest_orders
            where organization_id = ${organizationId}::uuid
              and status <> 'STORNIERT'
              and placed_at >= now() - interval '30 days'
          ) as orders_30d,
          (
            select coalesce(sum(total_cents), 0)::int from guest_orders
            where organization_id = ${organizationId}::uuid
              and status <> 'STORNIERT'
              and placed_at >= now() - interval '30 days'
          ) as revenue_30d,
          (
            select coalesce(sum(total_cents), 0)::int from guest_orders
            where organization_id = ${organizationId}::uuid
              and status <> 'STORNIERT'
          ) as revenue_total
      `);

      const row = result.rows[0];
      return {
        guestCount: Number(row?.guest_count ?? 0),
        orders30d: Number(row?.orders_30d ?? 0),
        redeemableCount: Number(row?.redeemable_count ?? 0),
        returningCount: Number(row?.returning_count ?? 0),
        revenue30dCents: Number(row?.revenue_30d ?? 0),
        revenueTotalCents: Number(row?.revenue_total ?? 0),
      };
    },
  );
}

export async function getGuestDetail(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  guestId: string;
  organizationId: string;
}): Promise<GuestDetail> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const guestId = guestIdSchema.parse(input.guestId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const summaryResult = await transaction.execute<OrderStatsRow>(sql`
        ${guestStatsQuery(organizationId)}
        select * from guest_stats where id = ${guestId}::uuid limit 1
      `);
      const summaryRow = summaryResult.rows[0];
      if (!summaryRow) {
        throw new GuestNotFoundError();
      }

      const [consentRow] = await transaction
        .select({
          consentAt: guests.consentAt,
          consentSource: guests.consentSource,
        })
        .from(guests)
        .where(
          and(eq(guests.id, guestId), eq(guests.organizationId, organizationId)),
        )
        .limit(1);
      if (!consentRow) {
        throw new GuestNotFoundError();
      }

      const orderResult = await transaction.execute<{
        delivery_address: string | null;
        external_reference: string | null;
        id: string;
        items: GuestOrderItemView[] | null;
        mode: GuestOrderMode;
        note: string | null;
        placed_at: Date;
        source: GuestOrderSource;
        status: GuestOrderStatus;
        total_cents: number;
      }>(sql`
        select
          o.id,
          o.placed_at,
          o.source,
          o.mode,
          o.status,
          o.total_cents,
          o.note,
          o.delivery_address,
          o.external_reference,
          coalesce(
            (
              select json_agg(
                json_build_object(
                  'name', i.name,
                  'quantity', i.quantity,
                  'unitPriceCents', i.unit_price_cents
                )
                order by i.created_at
              )
              from guest_order_items i
              where i.order_id = o.id
            ),
            '[]'::json
          ) as items
        from guest_orders o
        where o.organization_id = ${organizationId}::uuid
          and o.guest_id = ${guestId}::uuid
        order by o.placed_at desc
        limit 100
      `);

      const redemptions = await transaction
        .select({
          id: loyaltyRedemptions.id,
          redeemedAt: loyaltyRedemptions.redeemedAt,
          rewardLabel: loyaltyRedemptions.rewardLabel,
          stampsUsed: loyaltyRedemptions.stampsUsed,
        })
        .from(loyaltyRedemptions)
        .where(
          and(
            eq(loyaltyRedemptions.guestId, guestId),
            eq(loyaltyRedemptions.organizationId, organizationId),
          ),
        )
        .orderBy(sql`${loyaltyRedemptions.redeemedAt} desc`)
        .limit(50);

      return {
        consentAt: consentRow.consentAt,
        consentSource: consentRow.consentSource,
        guest: toGuestSummary(summaryRow),
        orders: orderResult.rows.map((row) => ({
          deliveryAddress: row.delivery_address,
          externalReference: row.external_reference,
          id: row.id,
          items: (row.items ?? []).map((item) => ({
            name: item.name,
            quantity: Number(item.quantity),
            unitPriceCents: Number(item.unitPriceCents),
          })),
          mode: row.mode,
          note: row.note,
          placedAt: row.placed_at,
          source: row.source,
          status: row.status,
          totalCents: Number(row.total_cents),
        })),
        redemptions,
      };
    },
  );
}

async function upsertGuestInTransaction(
  transaction: TenantTransaction,
  input: {
    consentSource: "STOREFRONT" | "LADEN";
    name?: string | null;
    now: Date;
    organizationId: string;
    phone: string;
    placedAt: Date;
  },
): Promise<string> {
  const trimmedName = (input.name ?? "").trim();
  const [row] = await transaction
    .insert(guests)
    .values({
      consentSource: input.consentSource,
      firstOrderAt: input.placedAt,
      lastOrderAt: input.placedAt,
      name: trimmedName === "" ? null : trimmedName,
      organizationId: input.organizationId,
      phone: input.phone,
    })
    .onConflictDoUpdate({
      set: {
        firstOrderAt: sql`least(
          coalesce(${guests.firstOrderAt}, ${input.placedAt}),
          ${input.placedAt}
        )`,
        lastOrderAt: sql`greatest(
          coalesce(${guests.lastOrderAt}, ${input.placedAt}),
          ${input.placedAt}
        )`,
        name:
          trimmedName === ""
            ? sql`${guests.name}`
            : sql`${trimmedName}`,
        updatedAt: input.now,
      },
      target: [guests.organizationId, guests.phone],
    })
    .returning({ id: guests.id });

  if (!row) {
    throw new GuestNotFoundError();
  }
  return row.id;
}

export async function recordManualOrder(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  now?: Date;
  order: ManualOrderInput;
  organizationId: string;
  supportReason?: string;
}): Promise<{ guestId: string }> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const order = manualOrderSchema.parse(input.order);
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      const authorization = await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      const guestId = await upsertGuestInTransaction(transaction, {
        consentSource: "LADEN",
        name: order.name,
        now,
        organizationId,
        phone: order.phone,
        placedAt: now,
      });

      const [createdOrder] = await transaction
        .insert(guestOrders)
        .values({
          deliveryAddress: null,
          guestId,
          mode: order.mode,
          note: order.note?.trim() || null,
          organizationId,
          placedAt: now,
          source: "MANUELL",
          status: "ABGESCHLOSSEN",
          totalCents: order.amountCents,
        })
        .returning({ id: guestOrders.id });

      if (createdOrder) {
        await transaction.insert(guestOrderItems).values({
          menuItemId: null,
          name: order.itemLabel,
          orderId: createdOrder.id,
          organizationId,
          quantity: order.quantity,
          unitPriceCents: Math.round(order.amountCents / order.quantity),
        });
      }

      if (authorization.kind === "SUPPORT") {
        await writeAuditEvent(transaction, {
          action: "SUPPORT_GUEST_ORDER_RECORDED",
          actorUserId: input.actor.userId,
          objectId: guestId,
          objectType: "guest",
          organizationId,
          reason: authorization.reason,
        });
      }

      await writeAuditEvent(transaction, {
        action: "GUEST_ORDER_RECORDED",
        actorUserId: input.actor.userId,
        metadata: { source: "MANUELL", totalCents: order.amountCents },
        objectId: guestId,
        objectType: "guest",
        organizationId,
      });

      return { guestId };
    },
  );
}

export async function updateGuest(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  guestId: string;
  name: string;
  note: string;
  organizationId: string;
  supportReason?: string;
}): Promise<void> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const guestId = guestIdSchema.parse(input.guestId);
  const name = guestNameSchema.parse(input.name);
  const note = guestNoteSchema.parse(input.note);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      const updated = await transaction
        .update(guests)
        .set({ name: name || null, note: note || null })
        .where(
          and(eq(guests.id, guestId), eq(guests.organizationId, organizationId)),
        )
        .returning({ id: guests.id });

      if (updated.length === 0) {
        throw new GuestNotFoundError();
      }
    },
  );
}

export async function redeemLoyalty(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  guestId: string;
  now?: Date;
  organizationId: string;
  rewardLabel?: string;
  supportReason?: string;
}): Promise<{ remainingStamps: number }> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const guestId = guestIdSchema.parse(input.guestId);
  const rewardLabel =
    (input.rewardLabel ?? "").trim().slice(0, 120) || LOYALTY_DEFAULT_REWARD;
  const now = input.now ?? new Date();

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER", "EMPLOYEE"],
        organizationId,
        supportReason: input.supportReason,
      });

      const result = await transaction.execute<{ stamp_count: number }>(sql`
        ${guestStatsQuery(organizationId)}
        select stamp_count from guest_stats where id = ${guestId}::uuid limit 1
      `);
      const row = result.rows[0];
      if (!row) {
        throw new GuestNotFoundError();
      }

      const stampCount = Number(row.stamp_count ?? 0);
      if (stampCount < LOYALTY_TARGET) {
        throw new LoyaltyNotReadyError(stampCount);
      }

      await transaction.insert(loyaltyRedemptions).values({
        guestId,
        organizationId,
        redeemedAt: now,
        redeemedByUserId: input.actor.userId,
        rewardLabel,
        stampsUsed: LOYALTY_TARGET,
      });

      await writeAuditEvent(transaction, {
        action: "LOYALTY_REDEEMED",
        actorUserId: input.actor.userId,
        metadata: { rewardLabel, stampsUsed: LOYALTY_TARGET },
        objectId: guestId,
        objectType: "guest",
        organizationId,
      });

      return { remainingStamps: stampCount - LOYALTY_TARGET };
    },
  );
}

// Loeschung auf Betroffenenanfrage. Bestellungen, Positionen und Einloesungen
// haengen per ON DELETE CASCADE am Gast und verschwinden mit ihm.
export async function deleteGuest(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  guestId: string;
  organizationId: string;
  reason?: string;
  supportReason?: string;
}): Promise<void> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const guestId = guestIdSchema.parse(input.guestId);
  const reason = (input.reason ?? "").trim().slice(0, 300);

  await withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER"],
        organizationId,
        supportReason: input.supportReason,
      });

      const deleted = await transaction
        .delete(guests)
        .where(
          and(eq(guests.id, guestId), eq(guests.organizationId, organizationId)),
        )
        .returning({ phone: guests.phone });

      if (deleted.length === 0) {
        throw new GuestNotFoundError();
      }

      await writeAuditEvent(transaction, {
        action: "GUEST_DELETED",
        actorUserId: input.actor.userId,
        metadata: { reason: reason || "Betroffenenanfrage" },
        objectId: guestId,
        objectType: "guest",
        organizationId,
        reason: reason || undefined,
      });
    },
  );
}

export async function listPlatformImports(input: {
  actor: GuestActor;
  database?: KebappDatabase;
  organizationId: string;
}): Promise<PlatformImportView[]> {
  const organizationId = organizationIdSchema.parse(input.organizationId);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) =>
      transaction
        .select({
          createdCount: platformImports.createdCount,
          fileName: platformImports.fileName,
          id: platformImports.id,
          importedAt: platformImports.importedAt,
          platform: platformImports.platform,
          rowCount: platformImports.rowCount,
          skippedCount: platformImports.skippedCount,
        })
        .from(platformImports)
        .where(eq(platformImports.organizationId, organizationId))
        .orderBy(sql`${platformImports.importedAt} desc`)
        .limit(25),
  );
}

export async function importPlatformOrders(input: {
  actor: GuestActor;
  content: string;
  database?: KebappDatabase;
  fileName: string;
  now?: Date;
  organizationId: string;
  platform: string;
  supportReason?: string;
}): Promise<PlatformImportOutcome> {
  const organizationId = organizationIdSchema.parse(input.organizationId);
  const platform = input.platform.trim().slice(0, 60) || "Plattform";
  const fileName = input.fileName.trim().slice(0, 200) || "import.csv";
  const now = input.now ?? new Date();
  const parsed = parsePlatformCsv(input.content);

  return withTenantContext(
    { actor: input.actor, database: input.database, organizationId },
    async (transaction) => {
      await authorizeOperationalMutation(transaction, {
        actorUserId: input.actor.userId,
        allowedMembershipRoles: ["OWNER"],
        organizationId,
        supportReason: input.supportReason,
      });

      const issues = [...parsed.issues];
      let createdCount = 0;

      // Ein erneuter Import derselben Datei darf keine Dubletten erzeugen.
      const references = parsed.rows.map((row) => row.externalReference);
      const existing =
        references.length === 0
          ? new Set<string>()
          : new Set(
              (
                await transaction
                  .select({ reference: guestOrders.externalReference })
                  .from(guestOrders)
                  .where(
                    and(
                      eq(guestOrders.organizationId, organizationId),
                      eq(guestOrders.source, "PLATTFORM"),
                      inArray(guestOrders.externalReference, references),
                    ),
                  )
              )
                .map((row) => row.reference)
                .filter((reference): reference is string => reference !== null),
            );

      for (const row of parsed.rows) {
        if (existing.has(row.externalReference)) {
          issues.push({
            line: row.line,
            reason: `Bestellung ${row.externalReference} war bereits importiert.`,
          });
          continue;
        }

        const guestId = await upsertGuestInTransaction(transaction, {
          consentSource: "LADEN",
          name: row.name,
          now,
          organizationId,
          phone: row.phone,
          placedAt: row.placedAt,
        });

        const [createdOrder] = await transaction
          .insert(guestOrders)
          .values({
            deliveryAddress:
              row.mode === "DELIVERY" ? "Adresse bei der Plattform" : null,
            externalReference: row.externalReference,
            guestId,
            mode: row.mode,
            organizationId,
            placedAt: row.placedAt,
            source: "PLATTFORM",
            status: "ABGESCHLOSSEN",
            totalCents: row.totalCents,
          })
          .returning({ id: guestOrders.id });

        if (!createdOrder) continue;

        if (row.items.length > 0) {
          await transaction.insert(guestOrderItems).values(
            row.items.map((item) => ({
              menuItemId: null,
              name: item.name,
              orderId: createdOrder.id,
              organizationId,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
            })),
          );
        }

        createdCount += 1;
      }

      const outcome: PlatformImportOutcome = {
        createdCount,
        issues,
        rowCount: parsed.rows.length + parsed.issues.length,
        skippedCount: issues.length,
      };

      await transaction.insert(platformImports).values({
        createdCount: outcome.createdCount,
        fileName,
        importedAt: now,
        importedByUserId: input.actor.userId,
        organizationId,
        platform,
        rowCount: outcome.rowCount,
        skippedCount: outcome.skippedCount,
      });

      await writeAuditEvent(transaction, {
        action: "PLATFORM_ORDERS_IMPORTED",
        actorUserId: input.actor.userId,
        metadata: {
          createdCount: outcome.createdCount,
          fileName,
          platform,
          skippedCount: outcome.skippedCount,
        },
        objectId: organizationId,
        objectType: "organization",
        organizationId,
      });

      return outcome;
    },
  );
}

const storefrontOrderErrors: Record<string, string> = {
  kebapp_address_required: "Bitte gib die vollständige Lieferadresse ein.",
  kebapp_invalid_mode: "Diese Bestellart wird aktuell nicht angeboten.",
  kebapp_invalid_phone: "Bitte gib eine gültige Telefonnummer an.",
  kebapp_invalid_quantity: "Die Menge muss zwischen 1 und 20 liegen.",
  kebapp_item_not_found: "Dieses Gericht steht nicht mehr auf der Karte.",
  kebapp_mode_unavailable: "Diese Bestellart wird aktuell nicht angeboten.",
  kebapp_rate_limited:
    "Für diese Nummer liegen bereits sehr viele Bestellungen vor. Bitte später erneut versuchen.",
  kebapp_store_not_found: "Diese Ladenseite ist nicht mehr erreichbar.",
};

function collectErrorMessages(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    messages.push(current.message);
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(" | ");
}

// Einziger Schreibpfad ohne Mandantenkontext. Die Definer-Funktion prueft
// Laden, Bestellart, Gericht und Menge selbst.
export async function recordStorefrontOrder(input: {
  database?: KebappDatabase;
  deliveryAddress?: string | null;
  itemId: string;
  mode: GuestOrderMode;
  name?: string | null;
  note?: string | null;
  phone: string;
  quantity: number;
  slug: string;
}): Promise<{ guestId: string; orderId: string; stampCount: number }> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  try {
    const result = await database.execute<{
      created_order_id: string;
      matched_guest_id: string;
      order_total_cents: number;
      stamp_count: number;
    }>(sql`
      select * from kebapp_private.record_storefront_order(
        ${input.slug},
        ${input.phone},
        ${input.name ?? ""},
        ${input.mode},
        ${input.deliveryAddress ?? ""},
        ${input.note ?? ""},
        ${input.itemId},
        ${input.quantity}
      )
    `);

    const row = result.rows[0];
    if (!row) {
      throw new StorefrontOrderRejectedError(
        "Die Bestellung konnte nicht gespeichert werden.",
        "kebapp_unknown",
      );
    }

    return {
      guestId: row.matched_guest_id,
      orderId: row.created_order_id,
      stampCount: Number(row.stamp_count ?? 0),
    };
  } catch (error) {
    if (error instanceof StorefrontOrderRejectedError) throw error;
    // Drizzle verpackt den Postgres-Fehler ("Failed query: ..."). Der
    // sprechende Code steht erst weiter unten in der Ursachenkette.
    const message = collectErrorMessages(error);
    const code = Object.keys(storefrontOrderErrors).find((candidate) =>
      message.includes(candidate),
    );
    throw new StorefrontOrderRejectedError(
      code
        ? storefrontOrderErrors[code]!
        : "Die Bestellung konnte nicht gespeichert werden.",
      code ?? "kebapp_unknown",
    );
  }
}
