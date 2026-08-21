import "server-only";

import { auditEvents } from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";

type AuditEventInput = {
  action: string;
  actorUserId: string;
  objectId?: string;
  objectType: string;
  organizationId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(
  transaction: TenantTransaction,
  input: AuditEventInput,
): Promise<void> {
  await transaction.insert(auditEvents).values({
    action: input.action,
    actorUserId: input.actorUserId,
    objectId: input.objectId,
    objectType: input.objectType,
    organizationId: input.organizationId,
    reason: input.reason,
    metadata: input.metadata,
    result: "SUCCESS",
  });
}
