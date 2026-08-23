import "server-only";

import { auditEvents } from "@/server/db/schema";
import type { TenantTransaction } from "@/server/db/tenant-context";

type AuditResult = "SUCCESS" | "DENIED" | "FAILED";

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
  input: Omit<AuditEventInput, "result">,
): Promise<void> {
  await insertAuditEvent(transaction, input, "SUCCESS");
}

export async function writeDeniedAuditEvent(
  transaction: TenantTransaction,
  input: Omit<AuditEventInput, "result">,
): Promise<void> {
  await insertAuditEvent(transaction, input, "DENIED");
}

async function insertAuditEvent(
  transaction: TenantTransaction,
  input: AuditEventInput,
  result: AuditResult,
): Promise<void> {
  await transaction.insert(auditEvents).values({
    action: input.action,
    actorUserId: input.actorUserId,
    objectId: input.objectId,
    objectType: input.objectType,
    organizationId: input.organizationId,
    reason: input.reason,
    metadata: input.metadata,
    result,
  });
}

