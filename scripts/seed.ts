import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadDbEnv } from "./db-env";
import {
  account,
  buyingRounds,
  demandItems,
  demandSubmissions,
  memberships,
  organizations,
  platformRoles,
  registrationRequests,
  storeProfiles,
  user,
  userProfiles,
} from "../src/server/db/schema";

const ids = {
  admin: "seed-admin",
  adminAccount: "seed-admin-account",
  chickenItem: "40000000-0000-4000-8000-000000000002",
  demandSubmission: "30000000-0000-4000-8000-000000000001",
  operator: "seed-operator",
  operatorAccount: "seed-operator-account",
  organization: "10000000-0000-4000-8000-000000000001",
  membership: "10000000-0000-4000-8000-000000000002",
  request: "10000000-0000-4000-8000-000000000003",
  round: "20000000-0000-4000-8000-000000000001",
  storeProfile: "50000000-0000-4000-8000-000000000001",
  vealItem: "40000000-0000-4000-8000-000000000001",
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
    const closesAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1_000);
    const deliveryStartsAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1_000,
    );
    deliveryStartsAt.setUTCHours(4, 0, 0, 0);
    const deliveryEndsAt = new Date(deliveryStartsAt);
    deliveryEndsAt.setUTCHours(7, 0, 0, 0);
    const deliveryDate = deliveryStartsAt.toISOString().slice(0, 10);

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

      await transaction
        .insert(storeProfiles)
        .values({
          accentColor: "#f3b83f",
          city: "Mönchengladbach",
          description:
            "Drehspieß, frisches Gemüse und unsere Saucen aus eigener Küche – mitten in Rheydt.",
          eyebrow: "Seit 1998 in Rheydt",
          id: ids.storeProfile,
          isPublished: true,
          menu: [
            {
              category: "Döner",
              description: "Drehspieß, Salat und Sauce nach Wahl",
              id: "menu-doener",
              name: "Döner im Fladenbrot",
              price: "7.50",
            },
            {
              category: "Döner",
              description: "Dünnes Fladenbrot, Drehspieß, Salat und Sauce",
              id: "menu-dueruem",
              name: "Dürüm",
              price: "8.50",
            },
            {
              category: "Teller",
              description: "Drehspieß, Beilage, Salat und Sauce",
              id: "menu-teller",
              name: "Ocakbaşı Teller",
              price: "13.90",
            },
            {
              category: "Vegetarisch",
              description: "Falafel, Salat, Sesamsauce und Kräuter",
              id: "menu-falafel",
              name: "Falafel-Tasche",
              price: "7.00",
            },
          ],
          name: "Ocakbaşı Rheydt",
          openingHours: [
            { days: "Montag–Donnerstag", hours: "11:00–23:00" },
            { days: "Freitag–Samstag", hours: "11:00–00:00" },
            { days: "Sonntag", hours: "12:00–22:00" },
          ],
          organizationId: ids.organization,
          phone: "+49 2166 123456",
          postalCode: "41236",
          publicSlug: "ocakbasi-rheydt-pilot",
          publishedAt: new Date(),
          shortName: "OR",
          street: "Demo-Straße 24",
          tagline: "Schicht für Schicht. Jeden Tag frisch.",
        })
        .onConflictDoNothing({ target: storeProfiles.organizationId });

      await transaction
        .insert(buyingRounds)
        .values({
          closesAt,
          createdByUserId: ids.admin,
          deliveryEndsAt,
          deliveryStartsAt,
          id: ids.round,
          name: "Pilot-Sammelrunde Fleisch",
          organizationId: ids.organization,
          pricingTiers: [
            {
              label: "Einzelkondition",
              minimumQuantity: "0",
              unitPrice: "9.40",
            },
            {
              label: "Gruppenpreis 1",
              minimumQuantity: "300",
              unitPrice: "9.05",
            },
            {
              label: "Gruppenpreis 2",
              minimumQuantity: "500",
              unitPrice: "8.65",
            },
            {
              label: "Zielpreis",
              minimumQuantity: "750",
              unitPrice: "8.42",
            },
          ],
          referenceUnitPrice: "9.18",
          regionalKey: `mg-fleisch-${deliveryDate}`,
          status: "OPEN",
          targetQuantity: "750.000",
        })
        .onConflictDoUpdate({
          target: buyingRounds.id,
          set: {
            closesAt,
            deliveryEndsAt,
            deliveryStartsAt,
            regionalKey: `mg-fleisch-${deliveryDate}`,
            updatedAt: new Date(),
          },
        });

      await transaction
        .insert(demandSubmissions)
        .values({
          buyingRoundId: ids.round,
          id: ids.demandSubmission,
          organizationId: ids.organization,
          status: "DRAFT",
        })
        .onConflictDoNothing({ target: demandSubmissions.id });

      await transaction
        .insert(demandItems)
        .values([
          {
            estimatedUnitPrice: "9.18",
            id: ids.vealItem,
            organizationId: ids.organization,
            productName: "Kalb-Drehspieß",
            quantity: "60.000",
            requestedDeliveryDate: deliveryDate,
            specification: "20 kg · Scheibenanteil 60 % · halal",
            submissionId: ids.demandSubmission,
            unit: "KG",
          },
          {
            estimatedUnitPrice: "9.18",
            id: ids.chickenItem,
            organizationId: ids.organization,
            productName: "Hähnchen-Drehspieß",
            quantity: "26.000",
            requestedDeliveryDate: deliveryDate,
            specification: "15 kg · gewürzt · halal",
            submissionId: ids.demandSubmission,
            unit: "KG",
          },
        ])
        .onConflictDoUpdate({
          target: demandItems.id,
          set: { requestedDeliveryDate: deliveryDate, updatedAt: new Date() },
        });
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
