import path from "node:path";
import { pathToFileURL } from "node:url";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  account,
  buyingRounds,
  demandItems,
  demandSubmissions,
  memberships,
  organizations,
  platformRoles,
  storeProfiles,
  supportAssignments,
  user,
  userProfiles,
} from "../src/server/db/schema";
import { seedDemoOperations } from "./seed-demo-operations";
import { seedDemoPlatform } from "./seed-demo-platform";
import {
  parseProductionEnv,
  type ProductionEnv,
} from "./production-env";

export const publicDemoIds = {
  admin: "public-demo-admin",
  adminAccount: "public-demo-admin-account",
  employee: "public-demo-employee",
  employeeAccount: "public-demo-employee-account",
  employeeMembership: "11000000-0000-4000-8000-000000000002",
  organizationA: "10000000-0000-4000-8000-000000000001",
  organizationB: "10000000-0000-4000-8000-000000000010",
  ownerA: "public-demo-owner-a",
  ownerAAccount: "public-demo-owner-a-account",
  ownerAMembership: "11000000-0000-4000-8000-000000000001",
  ownerB: "public-demo-owner-b",
  ownerBAccount: "public-demo-owner-b-account",
  ownerBMembership: "11000000-0000-4000-8000-000000000010",
  roundA: "20000000-0000-4000-8000-000000000001",
  roundB: "20000000-0000-4000-8000-000000000010",
  storeA: "50000000-0000-4000-8000-000000000001",
  storeB: "50000000-0000-4000-8000-000000000010",
  submissionA: "30000000-0000-4000-8000-000000000001",
  submissionB: "30000000-0000-4000-8000-000000000010",
  support: "public-demo-support",
  supportAccount: "public-demo-support-account",
  supportAssignment: "60000000-0000-4000-8000-000000000001",
  vealItemA: "40000000-0000-4000-8000-000000000001",
  chickenItemA: "40000000-0000-4000-8000-000000000002",
  vealItemB: "40000000-0000-4000-8000-000000000010",
} as const;

function futureDemoDates() {
  const closesAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1_000);
  const deliveryStartsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  deliveryStartsAt.setUTCHours(4, 0, 0, 0);
  const deliveryEndsAt = new Date(deliveryStartsAt);
  deliveryEndsAt.setUTCHours(8, 0, 0, 0);

  return {
    closesAt,
    deliveryDate: deliveryStartsAt.toISOString().slice(0, 10),
    deliveryEndsAt,
    deliveryStartsAt,
  };
}

export async function seedPublicDemo(env: ProductionEnv): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_OWNER_URL, max: 1 });
  const database = drizzle(pool);

  try {
    const connection = await pool.query<{
      current_database: string;
      current_user: string;
    }>("select current_database(), current_user");
    const identity = connection.rows[0];
    if (
      identity?.current_database !== env.POSTGRES_DB ||
      identity.current_user !== env.POSTGRES_OWNER_USER
    ) {
      throw new Error(
        "Der Demo-Seed ist nicht mit der erwarteten Besitzerverbindung verbunden.",
      );
    }

    const credentialIssuer = createLocalAccountIssuer("credential");
    const passwordHashes = await Promise.all([
      hashPassword(env.DEMO_ADMIN_PASSWORD),
      hashPassword(env.DEMO_SUPPORT_PASSWORD),
      hashPassword(env.DEMO_OWNER_PASSWORD),
      hashPassword(env.DEMO_EMPLOYEE_PASSWORD),
      hashPassword(env.DEMO_SECOND_OWNER_PASSWORD),
    ]);
    const dates = futureDemoDates();
    const now = new Date();

    await database.transaction(async (transaction) => {
      await transaction
        .insert(user)
        .values([
          {
            email: env.DEMO_ADMIN_EMAIL.toLowerCase(),
            emailVerified: true,
            id: publicDemoIds.admin,
            name: "Kebapp Administration",
          },
          {
            email: env.DEMO_SUPPORT_EMAIL.toLowerCase(),
            emailVerified: true,
            id: publicDemoIds.support,
            name: "Kebapp Betreuung",
          },
          {
            email: env.DEMO_OWNER_EMAIL.toLowerCase(),
            emailVerified: true,
            id: publicDemoIds.ownerA,
            name: "Meral Yilmaz",
          },
          {
            email: env.DEMO_EMPLOYEE_EMAIL.toLowerCase(),
            emailVerified: true,
            id: publicDemoIds.employee,
            name: "Emre Kaya",
          },
          {
            email: env.DEMO_SECOND_OWNER_EMAIL.toLowerCase(),
            emailVerified: true,
            id: publicDemoIds.ownerB,
            name: "Selin Demir",
          },
        ])
        .onConflictDoUpdate({
          target: user.id,
          set: {
            email: sql`excluded.email`,
            emailVerified: true,
            name: sql`excluded.name`,
            updatedAt: now,
          },
        });

      await transaction
        .insert(account)
        .values([
          {
            accountId: publicDemoIds.admin,
            id: publicDemoIds.adminAccount,
            issuer: credentialIssuer,
            password: passwordHashes[0],
            providerId: "credential",
            userId: publicDemoIds.admin,
          },
          {
            accountId: publicDemoIds.support,
            id: publicDemoIds.supportAccount,
            issuer: credentialIssuer,
            password: passwordHashes[1],
            providerId: "credential",
            userId: publicDemoIds.support,
          },
          {
            accountId: publicDemoIds.ownerA,
            id: publicDemoIds.ownerAAccount,
            issuer: credentialIssuer,
            password: passwordHashes[2],
            providerId: "credential",
            userId: publicDemoIds.ownerA,
          },
          {
            accountId: publicDemoIds.employee,
            id: publicDemoIds.employeeAccount,
            issuer: credentialIssuer,
            password: passwordHashes[3],
            providerId: "credential",
            userId: publicDemoIds.employee,
          },
          {
            accountId: publicDemoIds.ownerB,
            id: publicDemoIds.ownerBAccount,
            issuer: credentialIssuer,
            password: passwordHashes[4],
            providerId: "credential",
            userId: publicDemoIds.ownerB,
          },
        ])
        .onConflictDoNothing({ target: [account.issuer, account.accountId] });

      await transaction
        .insert(userProfiles)
        .values([
          { displayName: "Kebapp Administration", userId: publicDemoIds.admin },
          { displayName: "Kebapp Betreuung", userId: publicDemoIds.support },
          { displayName: "Meral Yilmaz", userId: publicDemoIds.ownerA },
          { displayName: "Emre Kaya", userId: publicDemoIds.employee },
          { displayName: "Selin Demir", userId: publicDemoIds.ownerB },
        ])
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: { displayName: sql`excluded.display_name`, updatedAt: now },
        });

      await transaction
        .insert(platformRoles)
        .values([
          {
            grantedByUserId: publicDemoIds.admin,
            role: "ADMIN",
            userId: publicDemoIds.admin,
          },
          {
            grantedByUserId: publicDemoIds.admin,
            role: "SUPPORT",
            userId: publicDemoIds.support,
          },
        ])
        .onConflictDoNothing({
          target: [platformRoles.userId, platformRoles.role],
        });

      await transaction
        .insert(organizations)
        .values([
          {
            id: publicDemoIds.organizationA,
            legalName: "Ocakbasi Rheydt e.K.",
            reviewedAt: now,
            reviewedByUserId: publicDemoIds.admin,
            slug: "ocakbasi-rheydt",
            status: "ACTIVE",
            storeName: "Ocakbasi Rheydt",
          },
          {
            id: publicDemoIds.organizationB,
            legalName: "Mangal am Markt GmbH",
            reviewedAt: now,
            reviewedByUserId: publicDemoIds.admin,
            slug: "mangal-am-markt",
            status: "ACTIVE",
            storeName: "Mangal am Markt",
          },
        ])
        .onConflictDoUpdate({
          target: organizations.id,
          set: {
            legalName: sql`excluded.legal_name`,
            reviewedAt: now,
            reviewedByUserId: publicDemoIds.admin,
            slug: sql`excluded.slug`,
            status: "ACTIVE",
            storeName: sql`excluded.store_name`,
            updatedAt: now,
          },
        });

      await transaction
        .insert(memberships)
        .values([
          {
            id: publicDemoIds.ownerAMembership,
            joinedAt: now,
            organizationId: publicDemoIds.organizationA,
            role: "OWNER",
            status: "ACTIVE",
            userId: publicDemoIds.ownerA,
          },
          {
            id: publicDemoIds.employeeMembership,
            invitedByUserId: publicDemoIds.ownerA,
            joinedAt: now,
            organizationId: publicDemoIds.organizationA,
            role: "EMPLOYEE",
            status: "ACTIVE",
            userId: publicDemoIds.employee,
          },
          {
            id: publicDemoIds.ownerBMembership,
            joinedAt: now,
            organizationId: publicDemoIds.organizationB,
            role: "OWNER",
            status: "ACTIVE",
            userId: publicDemoIds.ownerB,
          },
        ])
        .onConflictDoUpdate({
          target: memberships.id,
          set: {
            joinedAt: now,
            role: sql`excluded.role`,
            status: "ACTIVE",
            updatedAt: now,
          },
        });

      await transaction
        .insert(supportAssignments)
        .values({
          assignedByUserId: publicDemoIds.admin,
          id: publicDemoIds.supportAssignment,
          organizationId: publicDemoIds.organizationA,
          purpose: "Betreuter Pilot für Gruppeneinkauf und Ladenwebsite",
          status: "ACTIVE",
          supportUserId: publicDemoIds.support,
        })
        .onConflictDoUpdate({
          target: supportAssignments.id,
          set: {
            endedAt: null,
            expiresAt: null,
            purpose: sql`excluded.purpose`,
            status: "ACTIVE",
            updatedAt: now,
          },
        });

      await transaction
        .insert(storeProfiles)
        .values([
          {
            accentColor: "#f3b83f",
            city: "Mönchengladbach",
            description:
              "Drehspieß, frisches Gemüse und Saucen aus eigener Küche – mitten in Rheydt.",
            deliveryEnabled: true,
            email: "hallo@ocakbasi-rheydt.de",
            eyebrow: "Seit 1998 in Rheydt",
            features: [
              "HALAL",
              "FRESH_VEGETABLES",
              "HOMEMADE_SAUCES",
              "PREPARED_ON_SITE",
            ],
            id: publicDemoIds.storeA,
            isPublished: true,
            menu: [
              {
                category: "Döner",
                description: "Drehspieß, Salat und Sauce nach Wahl",
                id: "doener",
                name: "Döner im Fladenbrot",
                price: "7.50",
              },
              {
                category: "Döner",
                description: "Im dünnen Fladen gerollt, mit Salat und Sauce",
                id: "duerum",
                name: "Dürüm Döner",
                price: "8.50",
              },
              {
                category: "Teller",
                description: "Drehspieß, Beilage, Salat und Sauce",
                id: "teller",
                name: "Ocakbasi Teller",
                price: "13.90",
              },
              {
                category: "Teller",
                description: "Zwei Spieße vom Grill, Bulgur und Salat",
                id: "adana",
                name: "Adana Kebap Teller",
                price: "15.50",
              },
              {
                category: "Vegetarisch",
                description: "Falafel, Salat und Sesamsauce",
                id: "falafel",
                name: "Falafel-Tasche",
                price: "7.00",
              },
              {
                category: "Getränke",
                description: "Hausgemacht, 0,25 l",
                id: "ayran",
                name: "Ayran",
                price: "1.80",
              },
            ],
            name: "Ocakbasi Rheydt",
            openingHours: [
              { days: "Montag–Donnerstag", hours: "11:00–23:00" },
              { days: "Freitag–Samstag", hours: "11:00–00:00" },
              { days: "Sonntag", hours: "12:00–22:00" },
            ],
            organizationId: publicDemoIds.organizationA,
            phone: "+49 2166 123456",
            pickupEnabled: true,
            postalCode: "41236",
            publicSlug: "ocakbasi-rheydt",
            publishedAt: now,
            schemaVersion: 3,
            shortName: "OR",
            street: "Demo-Straße 24",
            tagline: "Schicht für Schicht. Jeden Tag frisch.",
            whatsappPhone: "+49 2166 123456",
          },
          {
            accentColor: "#d9653b",
            city: "Viersen",
            description:
              "Holzkohlegrill, hausgemachter Ayran und Lahmacun aus dem Steinofen – direkt am Alten Markt.",
            deliveryEnabled: true,
            email: "kontakt@mangal-am-markt.de",
            eyebrow: "Am Alten Markt in Viersen",
            features: ["HALAL", "PREPARED_ON_SITE", "HOMEMADE_SAUCES"],
            id: publicDemoIds.storeB,
            // Bewusst unveroeffentlicht: der Entwurfszustand der Ladenwebsite
            // und die 404-Antwort der oeffentlichen Seite bleiben so testbar.
            isPublished: false,
            menu: [
              {
                category: "Döner",
                description: "Drehspieß, Salat und Sauce",
                id: "mangal-doener",
                name: "Mangal Döner",
                price: "7.90",
              },
              {
                category: "Döner",
                description: "Gerollt im dünnen Fladen, mit Rotkohl und Sauce",
                id: "mangal-duerum",
                name: "Dürüm vom Grill",
                price: "8.90",
              },
              {
                category: "Teller",
                description: "Grillfleisch, Bulgur, Salat und Fladenbrot",
                id: "mangal-teller",
                name: "Mangal Teller",
                price: "14.50",
              },
              {
                // Die Kategorien sind serverseitig auf vier Werte begrenzt
                // (siehe storefrontProfileSchema); alles andere macht das
                // gespeicherte Profil ungueltig.
                category: "Teller",
                description: "Aus dem Steinofen, mit Salat und Zitrone",
                id: "mangal-lahmacun",
                name: "Lahmacun mit Salat",
                price: "6.50",
              },
              {
                category: "Getränke",
                description: "Täglich frisch gerührt, 0,3 l",
                id: "mangal-ayran",
                name: "Hausgemachter Ayran",
                price: "2.20",
              },
            ],
            name: "Mangal am Markt",
            openingHours: [
              { days: "Dienstag–Donnerstag", hours: "11:30–22:00" },
              { days: "Freitag–Samstag", hours: "11:30–23:30" },
              { days: "Sonntag", hours: "12:00–21:00" },
            ],
            organizationId: publicDemoIds.organizationB,
            phone: "+49 2162 654321",
            pickupEnabled: true,
            postalCode: "41747",
            publicSlug: "mangal-am-markt",
            publishedAt: null,
            schemaVersion: 3,
            shortName: "MM",
            street: "Marktstraße 10",
            tagline: "Vom Grill direkt auf den Teller.",
            whatsappPhone: "+49 2162 654321",
          },
        ])
        .onConflictDoUpdate({
          target: storeProfiles.id,
          set: {
            accentColor: sql`excluded.accent_color`,
            city: sql`excluded.city`,
            deliveryEnabled: sql`excluded.delivery_enabled`,
            description: sql`excluded.description`,
            email: sql`excluded.email`,
            eyebrow: sql`excluded.eyebrow`,
            features: sql`excluded.features`,
            isPublished: sql`excluded.is_published`,
            menu: sql`excluded.menu`,
            name: sql`excluded.name`,
            openingHours: sql`excluded.opening_hours`,
            phone: sql`excluded.phone`,
            pickupEnabled: sql`excluded.pickup_enabled`,
            postalCode: sql`excluded.postal_code`,
            publicSlug: sql`excluded.public_slug`,
            publishedAt: sql`excluded.published_at`,
            schemaVersion: sql`excluded.schema_version`,
            shortName: sql`excluded.short_name`,
            street: sql`excluded.street`,
            tagline: sql`excluded.tagline`,
            whatsappPhone: sql`excluded.whatsapp_phone`,
            updatedAt: now,
          },
        });

      await transaction
        .insert(buyingRounds)
        .values([
          {
            closesAt: dates.closesAt,
            createdByUserId: publicDemoIds.admin,
            deliveryEndsAt: dates.deliveryEndsAt,
            deliveryStartsAt: dates.deliveryStartsAt,
            id: publicDemoIds.roundA,
            name: "Sammelrunde Fleisch · Mönchengladbach",
            organizationId: publicDemoIds.organizationA,
            pricingTiers: [
              { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
              { label: "Gruppenpreis", minimumQuantity: "300", unitPrice: "9.05" },
              { label: "Zielpreis", minimumQuantity: "750", unitPrice: "8.42" },
            ],
            referenceUnitPrice: "9.18",
            regionalKey: `nrw-west-${dates.deliveryDate}`,
            status: "OPEN",
            targetQuantity: "750.000",
          },
          {
            closesAt: dates.closesAt,
            createdByUserId: publicDemoIds.admin,
            deliveryEndsAt: dates.deliveryEndsAt,
            deliveryStartsAt: dates.deliveryStartsAt,
            id: publicDemoIds.roundB,
            name: "Sammelrunde Fleisch · Mönchengladbach",
            organizationId: publicDemoIds.organizationB,
            pricingTiers: [
              { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
              { label: "Gruppenpreis", minimumQuantity: "300", unitPrice: "9.05" },
              { label: "Zielpreis", minimumQuantity: "750", unitPrice: "8.42" },
            ],
            referenceUnitPrice: "9.18",
            regionalKey: `nrw-west-${dates.deliveryDate}`,
            status: "OPEN",
            targetQuantity: "750.000",
          },
        ])
        .onConflictDoUpdate({
          target: buyingRounds.id,
          set: {
            closesAt: dates.closesAt,
            deliveryEndsAt: dates.deliveryEndsAt,
            deliveryStartsAt: dates.deliveryStartsAt,
            regionalKey: `nrw-west-${dates.deliveryDate}`,
            status: "OPEN",
            updatedAt: now,
          },
        });

      await transaction
        .insert(demandSubmissions)
        .values([
          {
            buyingRoundId: publicDemoIds.roundA,
            id: publicDemoIds.submissionA,
            organizationId: publicDemoIds.organizationA,
            status: "DRAFT",
          },
          {
            buyingRoundId: publicDemoIds.roundB,
            id: publicDemoIds.submissionB,
            organizationId: publicDemoIds.organizationB,
            status: "DRAFT",
          },
        ])
        .onConflictDoUpdate({
          target: demandSubmissions.id,
          set: { status: "DRAFT", updatedAt: now },
        });

      await transaction
        .insert(demandItems)
        .values([
          {
            estimatedUnitPrice: "9.18",
            id: publicDemoIds.vealItemA,
            organizationId: publicDemoIds.organizationA,
            productName: "Kalb-Drehspieß",
            quantity: "60.000",
            requestedDeliveryDate: dates.deliveryDate,
            specification: "20 kg · Scheibenanteil 60 % · halal",
            submissionId: publicDemoIds.submissionA,
            unit: "KG",
          },
          {
            estimatedUnitPrice: "8.90",
            id: publicDemoIds.chickenItemA,
            organizationId: publicDemoIds.organizationA,
            productName: "Hähnchen-Drehspieß",
            quantity: "30.000",
            requestedDeliveryDate: dates.deliveryDate,
            specification: "15 kg · gewürzt · halal",
            submissionId: publicDemoIds.submissionA,
            unit: "KG",
          },
          {
            estimatedUnitPrice: "9.18",
            id: publicDemoIds.vealItemB,
            organizationId: publicDemoIds.organizationB,
            productName: "Kalb-Drehspieß",
            quantity: "45.000",
            requestedDeliveryDate: dates.deliveryDate,
            specification: "15 kg · halal",
            submissionId: publicDemoIds.submissionB,
            unit: "KG",
          },
        ])
        .onConflictDoUpdate({
          target: demandItems.id,
          set: {
            estimatedUnitPrice: sql`excluded.estimated_unit_price`,
            productName: sql`excluded.product_name`,
            quantity: sql`excluded.quantity`,
            requestedDeliveryDate: dates.deliveryDate,
            specification: sql`excluded.specification`,
            unit: sql`excluded.unit`,
            updatedAt: now,
          },
        });

      // Betriebsdaten fuer alle uebrigen Ansichten: Umsatz, Hygiene, Zeit,
      // Buchhaltung, Kalkulation, Wareneingang, Vorlagen, Zuschlaege, Gaeste.
      await seedDemoOperations(transaction, {
        adminUserId: publicDemoIds.admin,
        now,
        targets: [
          {
            employeeUserId: publicDemoIds.employee,
            menu: [
              { id: "doener", name: "Döner im Fladenbrot", priceCents: 750 },
              { id: "duerum", name: "Dürüm Döner", priceCents: 850 },
              { id: "teller", name: "Ocakbasi Teller", priceCents: 1_390 },
              { id: "adana", name: "Adana Kebap Teller", priceCents: 1_550 },
              { id: "falafel", name: "Falafel-Tasche", priceCents: 700 },
              { id: "ayran", name: "Ayran", priceCents: 180 },
            ],
            openRoundId: publicDemoIds.roundA,
            openRoundRegionalKey: `nrw-west-${dates.deliveryDate}`,
            organizationId: publicDemoIds.organizationA,
            ownerUserId: publicDemoIds.ownerA,
            slot: 1,
            storeName: "Ocakbasi Rheydt",
          },
          {
            employeeUserId: null,
            menu: [
              { id: "mangal-doener", name: "Mangal Döner", priceCents: 790 },
              { id: "mangal-duerum", name: "Dürüm vom Grill", priceCents: 890 },
              { id: "mangal-teller", name: "Mangal Teller", priceCents: 1_450 },
              { id: "mangal-lahmacun", name: "Lahmacun mit Salat", priceCents: 650 },
              { id: "mangal-ayran", name: "Hausgemachter Ayran", priceCents: 220 },
            ],
            openRoundId: publicDemoIds.roundB,
            openRoundRegionalKey: `nrw-west-${dates.deliveryDate}`,
            organizationId: publicDemoIds.organizationB,
            ownerUserId: publicDemoIds.ownerB,
            slot: 2,
            storeName: "Mangal am Markt",
          },
        ],
      });

      // Plattformdaten: Antragseingang, Ladenverzeichnis, Domains,
      // Einladungen, Supportjournal, Auditspur und die mitbestellenden
      // Nachbarlaeden derselben Sammelrunde.
      await seedDemoPlatform(transaction, {
        adminUserId: publicDemoIds.admin,
        now,
        organizationAEmployeeUserId: publicDemoIds.employee,
        organizationAId: publicDemoIds.organizationA,
        organizationAOwnerUserId: publicDemoIds.ownerA,
        organizationBId: publicDemoIds.organizationB,
        organizationBOwnerUserId: publicDemoIds.ownerB,
        regionalKey: `nrw-west-${dates.deliveryDate}`,
        roundClosesAt: dates.closesAt,
        roundDeliveryEndsAt: dates.deliveryEndsAt,
        roundDeliveryStartsAt: dates.deliveryStartsAt,
        supportUserId: publicDemoIds.support,
      });
    });
  } finally {
    await pool.end();
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  Promise.resolve()
    .then(() => seedPublicDemo(parseProductionEnv(process.env)))
    .then(() => console.info("Öffentliche Demo-Daten sind bereit."))
    .catch((error: unknown) => {
      // Ohne Ursache kostet ein fehlgeschlagenes Deployment eine ganze
      // Runde Ratearbeit. Zugangsdaten stehen in keiner dieser Meldungen -
      // der Fehler kommt aus der Datenbankschicht, nicht aus der Umgebung.
      console.error("Öffentliche Demo-Daten konnten nicht angelegt werden.");
      for (
        let current: unknown = error, depth = 0;
        current instanceof Error && depth < 5;
        current = (current as { cause?: unknown }).cause, depth += 1
      ) {
        console.error(`  ${current.name}: ${current.message.slice(0, 400)}`);
      }
      process.exitCode = 1;
    });
}
