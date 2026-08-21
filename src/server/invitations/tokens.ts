import "server-only";

import { createHash, randomBytes } from "node:crypto";

const invitationTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isInvitationToken(token: string): boolean {
  return invitationTokenPattern.test(token);
}
