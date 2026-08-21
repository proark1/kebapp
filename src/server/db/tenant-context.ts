import "server-only";

import { sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type { KebappDatabase } from "@/server/db/client";
import * as schema from "@/server/db/schema";

const tenantContextSchema = z.object({
  actor: z.object({
    userId: z.string().min(1).max(255),
  }),
  organizationId: z.uuid(),
});

export type TenantActor = z.infer<typeof tenantContextSchema>["actor"];
export type TenantTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type TenantContextOptions = {
  actor: TenantActor;
  organizationId: string;
  database?: KebappDatabase;
};

export class TenantAccessDeniedError extends Error {
  constructor() {
    super("Kein Zugriff auf die ausgewählte Organisation.");
    this.name = "TenantAccessDeniedError";
  }
}

export async function withTenantContext<T>(
  input: TenantContextOptions,
  callback: (transaction: TenantTransaction) => Promise<T>,
): Promise<T> {
  const parsed = tenantContextSchema.parse(input);
  const database =
    input.database ?? (await import("@/server/db/client")).database;

  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${parsed.actor.userId}, true),
        set_config('kebapp.organization_id', ${parsed.organizationId}, true)
    `);

    const access = await transaction.execute<{ allowed: boolean }>(sql`
      select
        kebapp_private.can_access_organization(${parsed.organizationId}::uuid)
        or kebapp_private.can_administer_organization(
          ${parsed.organizationId}::uuid
        ) as allowed
    `);

    if (access.rows[0]?.allowed !== true) {
      throw new TenantAccessDeniedError();
    }

    return callback(transaction);
  });
}
