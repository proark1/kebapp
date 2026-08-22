import "server-only";

import { eq, sql } from "drizzle-orm";
import { choosePostLoginDestination } from "@/lib/post-login-destination";
import { database } from "@/server/db/client";
import {
  memberships,
  platformRoles,
  registrationRequests,
  userProfiles,
} from "@/server/db/schema";

export async function getPostLoginDestination(userId: string): Promise<string> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('kebapp.user_id', ${userId}, true),
        set_config('kebapp.organization_id', '', true)
    `);

    const roleRows = await transaction
      .select({ role: platformRoles.role })
      .from(platformRoles)
      .where(eq(platformRoles.userId, userId));
    const membershipRows = await transaction
      .select({ status: memberships.status })
      .from(memberships)
      .where(eq(memberships.userId, userId));
    const requestRows = await transaction
      .select({ id: registrationRequests.id })
      .from(registrationRequests)
      .where(eq(registrationRequests.userId, userId));
    const profileRows = await transaction
      .select({ status: userProfiles.status })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    return choosePostLoginDestination({
      accountStatus: profileRows[0]?.status ?? "ACTIVE",
      membershipStatuses: membershipRows.map((row) => row.status),
      platformRoles: roleRows.map((row) => row.role),
      registrationRequestCount: requestRows.length,
    });
  });
}
