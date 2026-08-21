import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadDbEnv } from "./db-env";
import {
  account,
  memberships,
  organizations,
  platformRoles,
  registrationRequests,
  user,
  userProfiles,
} from "../src/server/db/schema";

const ids = {
  admin: "seed-admin",
  adminAccount: "seed-admin-account",
  operator: "seed-operator",
  operatorAccount: "seed-operator-account",
  organization: "10000000-0000-4000-8000-000000000001",
  membership: "10000000-0000-4000-8000-000000000002",
  request: "10000000-0000-4000-8000-000000000003",
} as const;

async function seed() {
  const env = loadDbEnv();
  const pool = new Pool({ connectionString: env.DATABASE_OWNER_URL, max: 1 });
  const database = drizzle(pool);

  try {
    const [adminPassword, operatorPassword] = await Promise.all([
      hashPassword(env.SEED_ADMIN_PASSWORD),
      hashPassword(env.SEED_OPERATOR_PASSWORD),
    ]);
    const credentialIssuer = createLocalAccountIssuer("credential");

    await database.transaction(async (transaction) => {
      await transaction
        .insert(user)
        .values([
          {
            email: env.SEED_ADMIN_EMAIL.toLowerCase(),
            emailVerified: true,
            id: ids.admin,
            name: "Kebapp Admin",
          },
          {
            email: env.SEED_OPERATOR_EMAIL.toLowerCase(),
            emailVerified: true,
            id: ids.operator,
            name: "Meral Betreiberin",
          },
        ])
        .onConflictDoUpdate({
          target: user.id,
          set: {
            email: sql`excluded.email`,
            emailVerified: true,
            name: sql`excluded.name`,
            updatedAt: new Date(),
          },
        });

      await transaction
        .insert(account)
        .values([
          {
            accountId: ids.admin,
            id: ids.adminAccount,
            issuer: credentialIssuer,
            password: adminPassword,
            providerId: "credential",
            userId: ids.admin,
          },
          {
            accountId: ids.operator,
            id: ids.operatorAccount,
            issuer: credentialIssuer,
            password: operatorPassword,
            providerId: "credential",
            userId: ids.operator,
          },
        ])
        .onConflictDoUpdate({
          target: [account.issuer, account.accountId],
          set: { password: sql`excluded.password`, updatedAt: new Date() },
        });

      await transaction
        .insert(userProfiles)
        .values([
          { displayName: "Kebapp Admin", userId: ids.admin },
          { displayName: "Meral Betreiberin", userId: ids.operator },
        ])
        .onConflictDoNothing({ target: userProfiles.userId });

      await transaction
        .insert(platformRoles)
        .values({
          grantedByUserId: ids.admin,
          role: "ADMIN",
          userId: ids.admin,
        })
        .onConflictDoNothing({
          target: [platformRoles.userId, platformRoles.role],
        });

      await transaction
        .insert(organizations)
        .values({
          id: ids.organization,
          legalName: "Ocakbasi Rheydt e.K.",
          slug: "ocakbasi-rheydt-pilot",
          status: "PENDING",
          storeName: "Ocakbasi Rheydt",
        })
        .onConflictDoNothing({ target: organizations.id });

      await transaction
        .insert(memberships)
        .values({
          id: ids.membership,
          organizationId: ids.organization,
          role: "OWNER",
          status: "INVITED",
          userId: ids.operator,
        })
        .onConflictDoNothing({ target: memberships.id });

      await transaction
        .insert(registrationRequests)
        .values({
          city: "Mönchengladbach",
          contactEmail: env.SEED_OPERATOR_EMAIL.toLowerCase(),
          contactName: "Meral Betreiberin",
          contactPhone: "02161 000000",
          id: ids.request,
          legalName: "Ocakbasi Rheydt e.K.",
          organizationId: ids.organization,
          postalCode: "41236",
          status: "PENDING",
          storeName: "Ocakbasi Rheydt",
          street: "Hauptstraße 1",
          userId: ids.operator,
        })
        .onConflictDoNothing({ target: registrationRequests.id });
    });

    console.info("Lokale Kebapp-Testkonten und Pilotantrag sind bereit.");
  } finally {
    await pool.end();
  }
}

seed().catch(() => {
  console.error("Lokale Seed-Daten konnten nicht angelegt werden.");
  process.exitCode = 1;
});
