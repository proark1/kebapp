import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import { toDate } from "@/server/db/definer-values";
import { setAdminContext } from "@/server/organizations/admin";
import type { TenantTransaction } from "@/server/db/tenant-context";

export type StoreDirectoryRow = {
  organizationId: string;
  storeName: string;
  slug: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED";
  memberCount: number;
  websitePublished: boolean | null;
  websiteSlug: string | null;
  latestRoundStatus:
    | "PLANNING"
    | "OPEN"
    | "CLOSED"
    | "SUBMITTED"
    | "CANCELLED"
    | null;
  latestRoundClosesAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export async function listStoreDirectory(input: {
  actor: { userId: string };
  database?: KebappDatabase;
}): Promise<StoreDirectoryRow[]> {
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    return getStoreDirectoryRows(transaction);
  });
}

export async function getStoreDirectoryRows(
  transaction: TenantTransaction,
): Promise<StoreDirectoryRow[]> {
  const result = await transaction.execute<{
    organization_id: string;
    store_name: string;
    slug: string;
    status: StoreDirectoryRow["status"];
    member_count: string;
    website_published: boolean | null;
    website_slug: string | null;
    latest_round_status: StoreDirectoryRow["latestRoundStatus"];
    latest_round_closes_at: Date | string | null;
    reviewed_at: Date | string | null;
    created_at: Date | string;
  }>(sql`select * from kebapp_private.admin_store_directory()`);

  return result.rows.map((row) => ({
    createdAt: toDate(row.created_at) ?? new Date(0),
    latestRoundClosesAt: toDate(row.latest_round_closes_at),
    latestRoundStatus: row.latest_round_status,
    memberCount: Number(row.member_count),
    organizationId: row.organization_id,
    reviewedAt: toDate(row.reviewed_at),
    slug: row.slug,
    status: row.status,
    storeName: row.store_name,
    websitePublished: row.website_published,
    websiteSlug: row.website_slug,
  }));
}

export type RegionalSavingsRow = {
  organizationId: string;
  storeName: string;
  confirmedKg: number;
  referencePrice: number | null;
  effectivePrice: number | null;
  savingsEur: number | null;
};

const roundIdSchema = z.uuid();

export async function getRegionalSavings(input: {
  actor: { userId: string };
  database?: KebappDatabase;
  roundId: string;
}): Promise<RegionalSavingsRow[]> {
  const roundId = roundIdSchema.parse(input.roundId);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  const rows = await database.transaction(async (transaction) => {
    await setAdminContext(transaction, input.actor);
    const result = await transaction.execute<{
      organization_id: string;
      store_name: string;
      confirmed_kg: string;
      reference_price: string | null;
      effective_price: string | null;
      savings_eur: string | null;
    }>(sql`
      select * from kebapp_private.regional_savings_report(${roundId}::uuid)
    `);
    return result.rows;
  });

  return rows.map((row) => ({
    confirmedKg: Number(row.confirmed_kg),
    effectivePrice: row.effective_price === null ? null : Number(row.effective_price),
    organizationId: row.organization_id,
    referencePrice: row.reference_price === null ? null : Number(row.reference_price),
    savingsEur: row.savings_eur === null ? null : Number(row.savings_eur),
    storeName: row.store_name,
  }));
}
