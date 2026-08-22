import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import {
  account,
  buyingRounds,
  demandItems,
  demandSubmissions,
  memberships,
  organizations,
  platformRoles,
  storeProfiles,
  user,
  userProfiles,
} from "../../src/server/db/schema";
import { createTestDatabaseHarness } from "../../src/server/testing/database";

export const E2E_PASSWORD = "Kebapp-E2E-Passwort-2026!";

export const e2eUsers = {
  admin: {
    email: "admin@e2e.kebapp.local",
    id: "e2e-admin",
    name: "E2E Admin",
  },
  employee: {
    email: "mitarbeiter@e2e.kebapp.local",
    id: "e2e-employee",
    name: "E2E Mitarbeiter",
  },
  ownerA: {
    email: "inhaber-a@e2e.kebapp.local",
    id: "e2e-owner-a",
    name: "E2E Inhaber A",
  },
  ownerB: {
    email: "inhaber-b@e2e.kebapp.local",
    id: "e2e-owner-b",
    name: "E2E Inhaber B",
  },
} as const;

export const e2eIds = {
  itemA: "84000000-0000-4000-8000-000000000001",
  itemB: "84000000-0000-4000-8000-000000000002",
  organizationA: "81000000-0000-4000-8000-000000000001",
  organizationB: "81000000-0000-4000-8000-000000000002",
  publicActive: "81000000-0000-4000-8000-000000000003",
  publicPending: "81000000-0000-4000-8000-000000000004",
  publicSuspended: "81000000-0000-4000-8000-000000000005",
  roundA: "82000000-0000-4000-8000-000000000001",
  roundB: "82000000-0000-4000-8000-000000000002",
  submissionA: "83000000-0000-4000-8000-000000000001",
  submissionB: "83000000-0000-4000-8000-000000000002",
} as const;

export const e2eStorefronts = {
  active: "e2e-oeffentlich-aktiv",
  pending: "e2e-oeffentlich-ausstehend",
  suspended: "e2e-oeffentlich-pausiert",
} as const;

async function seedE2eDatabase() {
  const harness = createTestDatabaseHarness();

  try {
    await harness.resetAndMigrate();

    const hashedPassword = await hashPassword(E2E_PASSWORD);
    const issuer = createLocalAccountIssuer("credential");
    const users = Object.values(e2eUsers);
    const closesAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1_000);
    const deliveryStartsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1_000);
    deliveryStartsAt.setUTCHours(4, 0, 0, 0);
    const deliveryEndsAt = new Date(deliveryStartsAt);
    deliveryEndsAt.setUTCHours(8, 0, 0, 0);
    const deliveryDate = deliveryStartsAt.toISOString().slice(0, 10);

    await harness.ownerDatabase.transaction(async (transaction) => {
      await transaction.insert(user).values(
        users.map((entry) => ({
          email: entry.email,
          emailVerified: true,
          id: entry.id,
          name: entry.name,
        })),
      );
      await transaction.insert(account).values(
        users.map((entry) => ({
          accountId: entry.id,
          id: `${entry.id}-account`,
          issuer,
          password: hashedPassword,
          providerId: "credential",
          userId: entry.id,
        })),
      );
      await transaction.insert(userProfiles).values(
        users.map((entry) => ({
          displayName: entry.name,
          userId: entry.id,
        })),
      );
      await transaction.insert(platformRoles).values({
        grantedByUserId: e2eUsers.admin.id,
        role: "ADMIN",
        userId: e2eUsers.admin.id,
      });

      await transaction.insert(organizations).values([
        {
          id: e2eIds.organizationA,
          legalName: "Döner E2E A GmbH",
          slug: "e2e-laden-a",
          status: "ACTIVE",
          storeName: "Döner E2E A",
        },
        {
          id: e2eIds.organizationB,
          legalName: "Döner E2E B GmbH",
          slug: "e2e-laden-b",
          status: "ACTIVE",
          storeName: "Döner E2E B",
        },
        {
          id: e2eIds.publicActive,
          slug: "e2e-public-active-org",
          status: "ACTIVE",
          storeName: "E2E Kebaphaus Aktiv",
        },
        {
          id: e2eIds.publicPending,
          slug: "e2e-public-pending-org",
          status: "PENDING",
          storeName: "E2E Kebaphaus Ausstehend",
        },
        {
          id: e2eIds.publicSuspended,
          slug: "e2e-public-suspended-org",
          status: "SUSPENDED",
          storeName: "E2E Kebaphaus Pausiert",
        },
      ]);
      await transaction.insert(memberships).values([
        {
          joinedAt: new Date(),
          organizationId: e2eIds.organizationA,
          role: "OWNER",
          status: "ACTIVE",
          userId: e2eUsers.ownerA.id,
        },
        {
          joinedAt: new Date(),
          organizationId: e2eIds.organizationB,
          role: "OWNER",
          status: "ACTIVE",
          userId: e2eUsers.ownerB.id,
        },
      ]);

      await transaction.insert(buyingRounds).values([
        {
          closesAt,
          createdByUserId: e2eUsers.ownerA.id,
          deliveryEndsAt,
          deliveryStartsAt,
          id: e2eIds.roundA,
          name: "E2E Sammelrunde A",
          organizationId: e2eIds.organizationA,
          pricingTiers: [
            { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
            { label: "Zielpreis", minimumQuantity: "500", unitPrice: "8.50" },
          ],
          referenceUnitPrice: "9.40",
          regionalKey: `e2e-nrw-${deliveryDate}`,
          status: "OPEN",
          targetQuantity: "500.000",
        },
        {
          closesAt,
          createdByUserId: e2eUsers.ownerB.id,
          deliveryEndsAt,
          deliveryStartsAt,
          id: e2eIds.roundB,
          name: "E2E Sammelrunde B",
          organizationId: e2eIds.organizationB,
          pricingTiers: [
            { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
            { label: "Zielpreis", minimumQuantity: "500", unitPrice: "8.50" },
          ],
          referenceUnitPrice: "9.40",
          regionalKey: `e2e-nrw-${deliveryDate}`,
          status: "OPEN",
          targetQuantity: "500.000",
        },
      ]);
      await transaction.insert(demandSubmissions).values([
        {
          buyingRoundId: e2eIds.roundA,
          id: e2eIds.submissionA,
          organizationId: e2eIds.organizationA,
          status: "DRAFT",
        },
        {
          buyingRoundId: e2eIds.roundB,
          id: e2eIds.submissionB,
          organizationId: e2eIds.organizationB,
          status: "DRAFT",
        },
      ]);
      await transaction.insert(demandItems).values([
        {
          estimatedUnitPrice: "9.40",
          id: e2eIds.itemA,
          organizationId: e2eIds.organizationA,
          productName: "Kalb-Drehspieß E2E A",
          quantity: "60.000",
          requestedDeliveryDate: deliveryDate,
          specification: "20 kg · halal · Mandant A",
          submissionId: e2eIds.submissionA,
          unit: "KG",
        },
        {
          estimatedUnitPrice: "9.40",
          id: e2eIds.itemB,
          organizationId: e2eIds.organizationB,
          productName: "Hähnchen-Drehspieß E2E B",
          quantity: "70.000",
          requestedDeliveryDate: deliveryDate,
          specification: "15 kg · halal · Mandant B",
          submissionId: e2eIds.submissionB,
          unit: "KG",
        },
      ]);

      const commonPublicProfile: Omit<
        typeof storeProfiles.$inferInsert,
        "name" | "organizationId" | "publicSlug" | "shortName"
      > = {
        accentColor: "#d97706",
        city: "Mönchengladbach",
        description: "Frischer Drehspieß, Salate und hausgemachte Saucen.",
        deliveryEnabled: true,
        email: "hallo@e2e-kebaphaus.local",
        eyebrow: "NRW Familienbetrieb",
        isPublished: true,
        menu: [
          {
            category: "Döner",
            description: "Drehspieß, Salat und Sauce",
            id: "e2e-doener",
            name: "Döner im Fladenbrot",
            price: "7.50",
          },
        ],
        openingHours: [{ days: "Montag–Samstag", hours: "11:00–22:00" }],
        phone: "+49 2161 123456",
        pickupEnabled: true,
        postalCode: "41061",
        publishedAt: new Date(),
        street: "Marktstraße 12",
        tagline: "Aus der Nachbarschaft. Jeden Tag frisch.",
        whatsappPhone: "+49 2161 123456",
      };

      await transaction.insert(storeProfiles).values([
        {
          ...commonPublicProfile,
          name: "E2E Kebaphaus Aktiv",
          organizationId: e2eIds.publicActive,
          publicSlug: e2eStorefronts.active,
          shortName: "EA",
        },
        {
          ...commonPublicProfile,
          name: "E2E Kebaphaus Ausstehend",
          organizationId: e2eIds.publicPending,
          publicSlug: e2eStorefronts.pending,
          shortName: "EP",
        },
        {
          ...commonPublicProfile,
          name: "E2E Kebaphaus Pausiert",
          organizationId: e2eIds.publicSuspended,
          publicSlug: e2eStorefronts.suspended,
          shortName: "ES",
        },
      ]);
    });
  } finally {
    await harness.close();
  }
}

export default seedE2eDatabase;
