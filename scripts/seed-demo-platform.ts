// Demo-Daten fuer die Plattformansichten: Ladenantraege, Ladenverzeichnis,
// Domains, Einladungen, Supporteinsaetze und Auditprotokoll.
//
// Diese Daten liegen quer zu den Betriebsdaten aus seed-demo-operations.ts.
// Sie fuellen den Admin- und Supportbereich und geben der laufenden
// Sammelrunde eine echte Gruppenmenge: ohne mitbestellende Nachbarlaeden
// bleibt jede Ersparnis rechnerisch null.
//
// Alle Kennungen sind fest abgeleitet, jeder Datensatz wird per Upsert
// geschrieben. Ein erneuter Lauf frischt auf, statt zu verdoppeln.

import { sql } from "drizzle-orm";
import {
  auditEvents,
  buyingRounds,
  demandItems,
  demandSubmissions,
  invitations,
  memberships,
  organizations,
  registrationRequests,
  storeProfiles,
  supportAssignments,
  user,
  userProfiles,
} from "../src/server/db/schema";
import {
  closedRoundSchedule,
  type SeedTransaction,
} from "./seed-demo-operations";

export type DemoPlatformInput = {
  adminUserId: string;
  /** Bestehender Hauptbetrieb (Ocakbasi Rheydt). */
  organizationAId: string;
  organizationAOwnerUserId: string;
  organizationAEmployeeUserId: string;
  /** Zweiter Betrieb (Mangal am Markt). */
  organizationBId: string;
  organizationBOwnerUserId: string;
  now?: Date;
  /** Regionalschluessel der laufenden Runde, bindet die Nachbarlaeden ein. */
  regionalKey: string;
  roundClosesAt: Date;
  roundDeliveryStartsAt: Date;
  roundDeliveryEndsAt: Date;
  supportUserId: string;
};

function platformId(group: string, index: number): string {
  const tail = index.toString(16).padStart(12, "0");
  return `${group}000000-0000-4000-8000-${tail}`;
}

function daysAgo(now: Date, days: number, hour = 10): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

function daysAhead(now: Date, days: number, hour = 10): Date {
  return daysAgo(now, -days, hour);
}

// Nachbarlaeden derselben Sammelrunde. Sie haben keine Zugangsdaten: die
// Demo-Anmeldung kennt nur die fuenf Rollen der Startseite. Ihre bestaetigten
// Mengen ergeben die Gruppenmenge, die der Bedarfsplanung ihren Sinn gibt.
const partnerStores = [
  { chickenKg: 40, city: "Krefeld", name: "Kervan Grill", postalCode: "47798", slug: "kervan-grill", street: "Dionysiusstraße 14", vealKg: 80 },
  { chickenKg: 36, city: "Neuss", name: "Bosporus Imbiss", postalCode: "41460", slug: "bosporus-imbiss", street: "Büchel 9", vealKg: 60 },
  { chickenKg: 48, city: "Duisburg", name: "Anadolu Grillhaus", postalCode: "47051", slug: "anadolu-grillhaus", street: "Königstraße 61", vealKg: 90 },
  { chickenKg: 33, city: "Wuppertal", name: "Marmara Grill", postalCode: "42103", slug: "marmara-grill", street: "Friedrich-Engels-Allee 12", vealKg: 75 },
  { chickenKg: 24, city: "Krefeld", name: "Şehir Döner", postalCode: "47799", slug: "sehir-doener", street: "Rheinstraße 88", vealKg: 60 },
  { chickenKg: 32, city: "Mönchengladbach", name: "Levent Grillhaus", postalCode: "41065", slug: "levent-grillhaus", street: "Hindenburgstraße 204", vealKg: 70 },
] as const;

// Antraege im Eingang des Prueftischs. Jeder Antrag braucht einen eigenen
// Betrieb und eine eigene Person - so verlangt es der Datenbankschnitt.
const applicantStores = [
  {
    city: "Krefeld",
    contactName: "Deniz Aslan",
    daysWaiting: 2,
    legalName: "Aslan Gastro UG",
    name: "Şehr-i Kebap",
    organizationStatus: "PENDING" as const,
    postalCode: "47803",
    requestStatus: "PENDING" as const,
    reviewNote: null,
    slug: "sehr-i-kebap",
    street: "Hochstraße 41",
  },
  {
    city: "Neuss",
    contactName: "Hakan Öztürk",
    daysWaiting: 6,
    legalName: "Öztürk Imbissbetriebe GbR",
    name: "Neusser Döner Haus",
    organizationStatus: "PENDING" as const,
    postalCode: "41462",
    requestStatus: "PENDING" as const,
    reviewNote: null,
    slug: "neusser-doener-haus",
    street: "Krefelder Straße 7",
  },
  {
    city: "Viersen",
    contactName: "Leyla Kurt",
    daysWaiting: 11,
    legalName: "Kurt Grillhaus e.K.",
    name: "Grillhaus Dülken",
    organizationStatus: "PENDING" as const,
    postalCode: "41751",
    requestStatus: "PENDING" as const,
    reviewNote: null,
    slug: "grillhaus-duelken",
    street: "Lange Straße 3",
  },
  {
    city: "Köln",
    contactName: "Sinan Yıldırım",
    daysWaiting: 19,
    legalName: null,
    name: "Kalk Kebap Express",
    organizationStatus: "REJECTED" as const,
    postalCode: "51103",
    requestStatus: "REJECTED" as const,
    reviewNote:
      "Liegt außerhalb der Pilotregion NRW-West. Wieder aufnehmen, sobald der Pilot nach Köln erweitert wird.",
    slug: "kalk-kebap-express",
    street: "Kalker Hauptstraße 120",
  },
  {
    city: "Wuppertal",
    contactName: "Emine Şahin",
    daysWaiting: 46,
    legalName: "Şahin Gastronomie GmbH",
    name: "Barmen Grillstube",
    organizationStatus: "SUSPENDED" as const,
    postalCode: "42275",
    requestStatus: "APPROVED" as const,
    reviewNote:
      "Freigabe erteilt, Konto auf Wunsch des Betriebs während des Umbaus pausiert.",
    slug: "barmen-grillstube",
    street: "Werther Brücke 5",
  },
] as const;

async function seedPartnerStores(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  for (const [index, store] of partnerStores.entries()) {
    const userId = `demo-partner-owner-${index + 1}`;
    const organizationId = platformId("c2", index + 1);
    const reviewedAt = daysAgo(now, 120 - index * 9, 9);

    await transaction
      .insert(user)
      .values({
        email: `${store.slug}@partner.kebapp-demo.test`,
        emailVerified: true,
        id: userId,
        name: `Inhaber:in ${store.name}`,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: { name: sql`excluded.name`, updatedAt: now },
      });

    await transaction
      .insert(userProfiles)
      .values({ displayName: `Inhaber:in ${store.name}`, userId })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { displayName: sql`excluded.display_name`, updatedAt: now },
      });

    await transaction
      .insert(organizations)
      .values({
        id: organizationId,
        legalName: `${store.name} e.K.`,
        reviewedAt,
        reviewedByUserId: input.adminUserId,
        slug: store.slug,
        status: "ACTIVE",
        storeName: store.name,
      })
      .onConflictDoUpdate({
        target: organizations.id,
        set: {
          reviewedAt,
          status: "ACTIVE",
          storeName: sql`excluded.store_name`,
          updatedAt: now,
        },
      });

    await transaction
      .insert(memberships)
      .values({
        id: platformId("c3", index + 1),
        joinedAt: reviewedAt,
        organizationId,
        role: "OWNER",
        status: "ACTIVE",
        userId,
      })
      .onConflictDoUpdate({
        target: memberships.id,
        set: { joinedAt: reviewedAt, status: "ACTIVE", updatedAt: now },
      });

    await transaction
      .insert(registrationRequests)
      .values({
        city: store.city,
        contactEmail: `${store.slug}@partner.kebapp-demo.test`,
        contactName: `Inhaber:in ${store.name}`,
        contactPhone: `02161 ${String(400_000 + index * 137).padStart(6, "0")}`,
        id: platformId("c4", index + 1),
        legalName: `${store.name} e.K.`,
        organizationId,
        postalCode: store.postalCode,
        reviewedAt,
        reviewedByUserId: input.adminUserId,
        status: "APPROVED",
        storeName: store.name,
        street: store.street,
        userId,
      })
      .onConflictDoUpdate({
        target: registrationRequests.id,
        set: { reviewedAt, status: "APPROVED", updatedAt: now },
      });

    // Eigene Runde mit demselben Regionalschluessel: so zaehlt die Menge in
    // die Gruppenmenge der Nachbarlaeden ein.
    const roundId = platformId("c5", index + 1);
    await transaction
      .insert(buyingRounds)
      .values({
        closesAt: input.roundClosesAt,
        createdByUserId: input.adminUserId,
        deliveryEndsAt: input.roundDeliveryEndsAt,
        deliveryStartsAt: input.roundDeliveryStartsAt,
        id: roundId,
        name: `Sammelrunde Fleisch · ${store.city}`,
        organizationId,
        pricingTiers: [
          { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
          { label: "Gruppenpreis", minimumQuantity: "300", unitPrice: "9.05" },
          { label: "Zielpreis", minimumQuantity: "750", unitPrice: "8.42" },
        ],
        referenceUnitPrice: "9.18",
        regionalKey: input.regionalKey,
        status: "OPEN",
        targetQuantity: "750.000",
      })
      .onConflictDoUpdate({
        target: buyingRounds.id,
        set: {
          closesAt: input.roundClosesAt,
          deliveryEndsAt: input.roundDeliveryEndsAt,
          deliveryStartsAt: input.roundDeliveryStartsAt,
          regionalKey: input.regionalKey,
          status: "OPEN",
          updatedAt: now,
        },
      });

    const submissionId = platformId("c6", index + 1);
    const confirmedAt = daysAgo(now, 2 + index, 16);
    await transaction
      .insert(demandSubmissions)
      .values({
        buyingRoundId: roundId,
        confirmedAt,
        confirmedByUserId: userId,
        id: submissionId,
        organizationId,
        status: "CONFIRMED",
      })
      .onConflictDoUpdate({
        target: demandSubmissions.id,
        set: { confirmedAt, status: "CONFIRMED", updatedAt: now },
      });

    const deliveryDate = input.roundDeliveryStartsAt
      .toISOString()
      .slice(0, 10);
    await seedPartnerDemand(transaction, {
      chickenKg: store.chickenKg,
      deliveryDate,
      idOffset: 1,
      now,
      organizationId,
      submissionId,
      vealKg: store.vealKg,
      partnerIndex: index + 1,
    });

    // Dieselben Laeden haben auch in der bereits abgeschlossenen Runde
    // mitbestellt. Ohne sie stuende der Ersparnis-Report des Prueftischs bei
    // 180 kg und damit unter jeder Preisstufe - die ausgewiesene "Ersparnis"
    // waere negativ.
    const closed = closedRoundSchedule(now);
    const closedRoundId = platformId("d6", index + 1);
    await transaction
      .insert(buyingRounds)
      .values({
        closesAt: closed.closesAt,
        createdByUserId: input.adminUserId,
        deliveryEndsAt: closed.deliveryEndsAt,
        deliveryStartsAt: closed.deliveryStartsAt,
        id: closedRoundId,
        name: closed.name,
        organizationId,
        pricingTiers: [
          { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
          { label: "Gruppenpreis", minimumQuantity: "300", unitPrice: "9.05" },
          { label: "Zielpreis", minimumQuantity: "750", unitPrice: "8.42" },
        ],
        referenceUnitPrice: "9.18",
        regionalKey: closed.regionalKey,
        status: "SUBMITTED",
        targetQuantity: "750.000",
      })
      .onConflictDoUpdate({
        target: buyingRounds.id,
        set: {
          closesAt: closed.closesAt,
          deliveryEndsAt: closed.deliveryEndsAt,
          deliveryStartsAt: closed.deliveryStartsAt,
          name: sql`excluded.name`,
          regionalKey: closed.regionalKey,
          status: "SUBMITTED",
          updatedAt: now,
        },
      });

    const closedSubmissionId = platformId("d7", index + 1);
    await transaction
      .insert(demandSubmissions)
      .values({
        buyingRoundId: closedRoundId,
        confirmedAt: closed.closesAt,
        confirmedByUserId: userId,
        id: closedSubmissionId,
        organizationId,
        status: "CONFIRMED",
      })
      .onConflictDoUpdate({
        target: demandSubmissions.id,
        set: { confirmedAt: closed.closesAt, status: "CONFIRMED", updatedAt: now },
      });

    await seedPartnerDemand(transaction, {
      chickenKg: store.chickenKg,
      deliveryDate: closed.deliveryStartsAt.toISOString().slice(0, 10),
      idOffset: 5,
      now,
      organizationId,
      submissionId: closedSubmissionId,
      vealKg: store.vealKg,
      partnerIndex: index + 1,
    });
  }
}

async function seedPartnerDemand(
  transaction: SeedTransaction,
  input: {
    chickenKg: number;
    deliveryDate: string;
    idOffset: number;
    now: Date;
    organizationId: string;
    partnerIndex: number;
    submissionId: string;
    vealKg: number;
  },
): Promise<void> {
  await transaction
    .insert(demandItems)
    .values([
      {
        estimatedUnitPrice: "9.18",
        id: platformId("c7", input.partnerIndex * 10 + input.idOffset),
        organizationId: input.organizationId,
        productName: "Kalb-Drehspieß",
        quantity: `${input.vealKg}.000`,
        requestedDeliveryDate: input.deliveryDate,
        specification: "20 kg · Scheibenanteil 60 % · halal",
        submissionId: input.submissionId,
        unit: "KG" as const,
      },
      {
        estimatedUnitPrice: "8.90",
        id: platformId("c7", input.partnerIndex * 10 + input.idOffset + 1),
        organizationId: input.organizationId,
        productName: "Hähnchen-Drehspieß",
        quantity: `${input.chickenKg}.000`,
        requestedDeliveryDate: input.deliveryDate,
        specification: "15 kg · gewürzt · halal",
        submissionId: input.submissionId,
        unit: "KG" as const,
      },
    ])
    .onConflictDoUpdate({
      target: demandItems.id,
      set: {
        quantity: sql`excluded.quantity`,
        requestedDeliveryDate: input.deliveryDate,
        updatedAt: input.now,
      },
    });
}

async function seedApplicants(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  for (const [index, store] of applicantStores.entries()) {
    const userId = `demo-applicant-${index + 1}`;
    const organizationId = platformId("c8", index + 1);
    const submittedAt = daysAgo(now, store.daysWaiting, 8 + index);
    const decidedAt =
      store.requestStatus === "PENDING"
        ? null
        : daysAgo(now, Math.max(1, store.daysWaiting - 4), 11);

    await transaction
      .insert(user)
      .values({
        email: `${store.slug}@antrag.kebapp-demo.test`,
        emailVerified: true,
        id: userId,
        name: store.contactName,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: { name: sql`excluded.name`, updatedAt: now },
      });

    await transaction
      .insert(userProfiles)
      .values({ displayName: store.contactName, userId })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { displayName: sql`excluded.display_name`, updatedAt: now },
      });

    await transaction
      .insert(organizations)
      .values({
        id: organizationId,
        legalName: store.legalName,
        reviewedAt: decidedAt,
        reviewedByUserId: decidedAt ? input.adminUserId : null,
        slug: store.slug,
        status: store.organizationStatus,
        storeName: store.name,
      })
      .onConflictDoUpdate({
        target: organizations.id,
        set: {
          reviewedAt: decidedAt,
          status: store.organizationStatus,
          storeName: sql`excluded.store_name`,
          updatedAt: now,
        },
      });

    await transaction
      .insert(memberships)
      .values({
        id: platformId("c9", index + 1),
        joinedAt: store.requestStatus === "APPROVED" ? decidedAt : null,
        organizationId,
        role: "OWNER",
        status: store.requestStatus === "APPROVED" ? "ACTIVE" : "INVITED",
        userId,
      })
      .onConflictDoUpdate({
        target: memberships.id,
        set: {
          joinedAt: store.requestStatus === "APPROVED" ? decidedAt : null,
          status: store.requestStatus === "APPROVED" ? "ACTIVE" : "INVITED",
          updatedAt: now,
        },
      });

    await transaction
      .insert(registrationRequests)
      .values({
        city: store.city,
        contactEmail: `${store.slug}@antrag.kebapp-demo.test`,
        contactName: store.contactName,
        contactPhone: `0${2_100 + index} ${String(300_000 + index * 913).padStart(6, "0")}`,
        createdAt: submittedAt,
        id: platformId("d1", index + 1),
        legalName: store.legalName,
        organizationId,
        postalCode: store.postalCode,
        reviewNote: store.reviewNote,
        reviewedAt: decidedAt,
        reviewedByUserId: decidedAt ? input.adminUserId : null,
        status: store.requestStatus,
        storeName: store.name,
        street: store.street,
        userId,
      })
      .onConflictDoUpdate({
        target: registrationRequests.id,
        set: {
          createdAt: submittedAt,
          reviewNote: sql`excluded.review_note`,
          reviewedAt: decidedAt,
          status: sql`excluded.status`,
          updatedAt: now,
        },
      });

    // Ein pausierter Betrieb hat bereits ein Team und eine Entwurfsseite.
    if (store.organizationStatus === "SUSPENDED") {
      await transaction
        .insert(storeProfiles)
        .values({
          city: store.city,
          description:
            "Die Seite ist während des Umbaus offline und bleibt als Entwurf erhalten.",
          eyebrow: "Betrieb pausiert",
          id: platformId("d2", index + 1),
          isPublished: false,
          name: store.name,
          openingHours: [{ days: "Montag–Samstag", hours: "11:00–22:00" }],
          organizationId,
          phone: "0202 4400123",
          postalCode: store.postalCode,
          publicSlug: store.slug,
          shortName: "BG",
          street: store.street,
          tagline: "Bald wieder für euch da.",
        })
        .onConflictDoUpdate({
          target: storeProfiles.id,
          set: { isPublished: false, updatedAt: now },
        });
    }
  }
}

async function seedInvitations(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  const rows = [
    {
      acceptedAt: daysAgo(now, 54, 12),
      acceptedByUserId: input.organizationAEmployeeUserId,
      email: "employee@public-demo.test",
      expiresAt: daysAgo(now, 51, 12),
      id: platformId("d3", 1),
      organizationId: input.organizationAId,
      revokedAt: null,
      revokedByUserId: null,
      role: "EMPLOYEE" as const,
      status: "ACCEPTED" as const,
      tokenHash: "demo-invitation-accepted-a1",
    },
    {
      acceptedAt: null,
      acceptedByUserId: null,
      email: "kueche@ocakbasi-rheydt.de",
      expiresAt: daysAhead(now, 2, 19),
      id: platformId("d3", 2),
      organizationId: input.organizationAId,
      revokedAt: null,
      revokedByUserId: null,
      role: "EMPLOYEE" as const,
      status: "PENDING" as const,
      tokenHash: "demo-invitation-pending-a2",
    },
    {
      acceptedAt: null,
      acceptedByUserId: null,
      email: "aushilfe@ocakbasi-rheydt.de",
      expiresAt: daysAgo(now, 4, 19),
      id: platformId("d3", 3),
      organizationId: input.organizationAId,
      revokedAt: daysAgo(now, 6, 15),
      revokedByUserId: input.organizationAOwnerUserId,
      role: "EMPLOYEE" as const,
      status: "REVOKED" as const,
      tokenHash: "demo-invitation-revoked-a3",
    },
    {
      acceptedAt: null,
      acceptedByUserId: null,
      email: "theke@mangal-am-markt.de",
      expiresAt: daysAhead(now, 1, 12),
      id: platformId("d3", 4),
      organizationId: input.organizationBId,
      revokedAt: null,
      revokedByUserId: null,
      role: "EMPLOYEE" as const,
      status: "PENDING" as const,
      tokenHash: "demo-invitation-pending-b1",
    },
  ];

  for (const row of rows) {
    await transaction
      .insert(invitations)
      .values({
        ...row,
        createdAt: daysAgo(now, row.status === "ACCEPTED" ? 57 : 5, 11),
        invitedByUserId:
          row.organizationId === input.organizationAId
            ? input.organizationAOwnerUserId
            : input.organizationBOwnerUserId,
      })
      .onConflictDoUpdate({
        target: invitations.id,
        set: {
          acceptedAt: sql`excluded.accepted_at`,
          expiresAt: sql`excluded.expires_at`,
          revokedAt: sql`excluded.revoked_at`,
          status: sql`excluded.status`,
          updatedAt: now,
        },
      });
  }
}

async function seedSupportAssignments(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  await transaction
    .insert(supportAssignments)
    .values({
      assignedByUserId: input.adminUserId,
      expiresAt: daysAhead(now, 21, 18),
      id: platformId("d4", 2),
      organizationId: input.organizationBId,
      purpose: "Website-Erstaufnahme und erste Sammelrunde begleiten",
      status: "ACTIVE",
      supportUserId: input.supportUserId,
    })
    .onConflictDoUpdate({
      target: supportAssignments.id,
      set: {
        endedAt: null,
        expiresAt: daysAhead(now, 21, 18),
        purpose: sql`excluded.purpose`,
        status: "ACTIVE",
        updatedAt: now,
      },
    });

  // Beendeter Einsatz: das Einsatzjournal zeigt sonst nur laufende Zeilen.
  await transaction
    .insert(supportAssignments)
    .values({
      assignedByUserId: input.adminUserId,
      endedAt: daysAgo(now, 9, 17),
      id: platformId("d4", 3),
      organizationId: platformId("c2", 1),
      purpose: "Einmalige Hilfe bei der ersten Bedarfsmeldung",
      status: "ENDED",
      supportUserId: input.supportUserId,
    })
    .onConflictDoUpdate({
      target: supportAssignments.id,
      set: {
        endedAt: daysAgo(now, 9, 17),
        status: "ENDED",
        updatedAt: now,
      },
    });
}

async function seedDomainRequests(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  await transaction
    .update(storeProfiles)
    .set({
      customDomain: "ocakbasi-rheydt.de",
      domainRequestStatus: "CONNECTED",
      domainRequestedAt: daysAgo(now, 26, 9),
      requestedDomain: "ocakbasi-rheydt.de",
      updatedAt: now,
    })
    .where(sql`${storeProfiles.organizationId} = ${input.organizationAId}::uuid`);

  await transaction
    .update(storeProfiles)
    .set({
      customDomain: null,
      domainRequestStatus: "REVIEW_REQUESTED",
      domainRequestedAt: daysAgo(now, 3, 14),
      requestedDomain: "mangal-am-markt.de",
      updatedAt: now,
    })
    .where(sql`${storeProfiles.organizationId} = ${input.organizationBId}::uuid`);
}

type AuditSeedRow = {
  action: string;
  actorUserId: string | null;
  daysAgo: number;
  hour: number;
  objectId: string | null;
  objectType: string;
  organizationId: string | null;
  reason: string | null;
  result: "SUCCESS" | "DENIED" | "FAILED";
};

async function seedAuditTrail(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
  now: Date,
): Promise<void> {
  const partnerOrganizationId = platformId("c2", 1);
  const rows: AuditSeedRow[] = [
    {
      action: "ORGANIZATION_REGISTRATION_APPROVED",
      actorUserId: input.adminUserId,
      daysAgo: 120,
      hour: 9,
      objectId: input.organizationAId,
      objectType: "organization",
      organizationId: input.organizationAId,
      reason: "Gewerbeanmeldung und Betriebsbesichtigung liegen vor.",
      result: "SUCCESS",
    },
    {
      action: "SUPPORT_ASSIGNED",
      actorUserId: input.adminUserId,
      daysAgo: 118,
      hour: 10,
      objectId: input.supportUserId,
      objectType: "support_assignment",
      organizationId: input.organizationAId,
      reason: "Betreuter Pilot für Gruppeneinkauf und Ladenwebsite",
      result: "SUCCESS",
    },
    {
      action: "EMPLOYEE_INVITATION_CREATED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 57,
      hour: 11,
      objectId: "employee@public-demo.test",
      objectType: "invitation",
      organizationId: input.organizationAId,
      reason: null,
      result: "SUCCESS",
    },
    {
      action: "EMPLOYEE_INVITATION_ACCEPTED",
      actorUserId: input.organizationAEmployeeUserId,
      daysAgo: 54,
      hour: 12,
      objectId: "employee@public-demo.test",
      objectType: "invitation",
      organizationId: input.organizationAId,
      reason: null,
      result: "SUCCESS",
    },
    {
      action: "STOREFRONT_DOMAIN_CONNECTED",
      actorUserId: input.adminUserId,
      daysAgo: 26,
      hour: 9,
      objectId: "ocakbasi-rheydt.de",
      objectType: "store_profile",
      organizationId: input.organizationAId,
      reason: "DNS-Eintrag geprüft, Zertifikat ausgestellt.",
      result: "SUCCESS",
    },
    {
      action: "BUYING_ROUND_CREATED",
      actorUserId: input.adminUserId,
      daysAgo: 24,
      hour: 8,
      objectId: null,
      objectType: "buying_round",
      organizationId: input.organizationAId,
      reason: "Sammelrunde Fleisch für die Region NRW-West geöffnet.",
      result: "SUCCESS",
    },
    {
      action: "DEMAND_SUBMISSION_CONFIRMED",
      actorUserId: `demo-partner-owner-1`,
      daysAgo: 18,
      hour: 16,
      objectId: null,
      objectType: "demand_submission",
      organizationId: partnerOrganizationId,
      reason: null,
      result: "SUCCESS",
    },
    {
      action: "ROUND_AWARDED",
      actorUserId: input.adminUserId,
      daysAgo: 17,
      hour: 18,
      objectId: "Anadolu Fleischhandel",
      objectType: "round_award",
      organizationId: input.organizationAId,
      reason: "Zuschlag nach Gruppenmenge 812 kg zu 8,42 € je kg.",
      result: "SUCCESS",
    },
    {
      action: "GOODS_RECEIPT_SAVED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 10,
      hour: 9,
      objectId: null,
      objectType: "goods_receipt",
      organizationId: input.organizationAId,
      reason: "Eine Position gekürzt: 55 statt 60 kg Kalb.",
      result: "SUCCESS",
    },
    {
      action: "SUPPORT_ASSIGNMENT_ENDED",
      actorUserId: input.adminUserId,
      daysAgo: 9,
      hour: 17,
      objectId: input.supportUserId,
      objectType: "support_assignment",
      organizationId: partnerOrganizationId,
      reason: "Erstaufnahme abgeschlossen, Betrieb arbeitet eigenständig.",
      result: "SUCCESS",
    },
    {
      action: "EMPLOYEE_INVITATION_REVOKED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 6,
      hour: 15,
      objectId: "aushilfe@ocakbasi-rheydt.de",
      objectType: "invitation",
      organizationId: input.organizationAId,
      reason: "Aushilfe hat die Stelle nicht angetreten.",
      result: "SUCCESS",
    },
    {
      action: "SUPPORT_STOREFRONT_UPDATED",
      actorUserId: input.supportUserId,
      daysAgo: 5,
      hour: 14,
      objectId: null,
      objectType: "store_profile",
      organizationId: input.organizationBId,
      reason: "Öffnungszeiten nach Rücksprache mit der Inhaberin korrigiert.",
      result: "SUCCESS",
    },
    {
      action: "SUPPORT_DEMAND_QUANTITY_UPDATED",
      actorUserId: input.supportUserId,
      daysAgo: 5,
      hour: 15,
      objectId: null,
      objectType: "demand_item",
      organizationId: input.organizationBId,
      reason: "Menge auf telefonischen Wunsch von 30 auf 45 kg erhöht.",
      result: "SUCCESS",
    },
    {
      action: "DEMAND_SUBMISSION_CONFIRMED",
      actorUserId: input.supportUserId,
      daysAgo: 5,
      hour: 15,
      objectId: null,
      objectType: "demand_submission",
      organizationId: input.organizationBId,
      reason: "Bestätigungen bleiben der Inhaberrolle vorbehalten.",
      result: "DENIED",
    },
    {
      action: "SALES_IMPORTED",
      actorUserId: input.organizationAEmployeeUserId,
      daysAgo: 4,
      hour: 22,
      objectId: null,
      objectType: "sales_daily",
      organizationId: input.organizationAId,
      reason: "Kassenexport der Vorwoche eingelesen.",
      result: "SUCCESS",
    },
    {
      action: "E_INVOICE_IMPORTED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 4,
      hour: 10,
      objectId: "2026-1001",
      objectType: "incoming_invoice",
      organizationId: input.organizationAId,
      reason: "XRechnung von Anadolu Fleischhandel.",
      result: "SUCCESS",
    },
    {
      action: "PLATFORM_ORDERS_IMPORTED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 3,
      hour: 11,
      objectId: "lieferando-export-august.csv",
      objectType: "platform_import",
      organizationId: input.organizationAId,
      reason: "11 Zeilen gelesen, 9 übernommen, 2 ohne Nummer übersprungen.",
      result: "SUCCESS",
    },
    {
      action: "E_INVOICE_IMPORTED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 3,
      hour: 12,
      objectId: null,
      objectType: "incoming_invoice",
      organizationId: input.organizationAId,
      reason: "ZUGFeRD-PDF statt XRechnung — Datei nicht lesbar.",
      result: "FAILED",
    },
    {
      action: "HYGIENE_ENTRY_SAVED",
      actorUserId: input.organizationAEmployeeUserId,
      daysAgo: 2,
      hour: 9,
      objectId: null,
      objectType: "hygiene_entry",
      organizationId: input.organizationAId,
      reason: "Kühlschranktür stand offen, Temperatur nachgeregelt.",
      result: "SUCCESS",
    },
    {
      action: "TIME_ENTRY_CORRECTED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 2,
      hour: 20,
      objectId: null,
      objectType: "time_entry",
      organizationId: input.organizationAId,
      reason: "Ausstempeln vergessen, Ende auf 23:00 Uhr gesetzt.",
      result: "SUCCESS",
    },
    {
      action: "LOYALTY_REDEEMED",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 2,
      hour: 19,
      objectId: null,
      objectType: "loyalty_redemption",
      organizationId: input.organizationAId,
      reason: "Volle Stempelkarte eingelöst: ein Gericht gratis.",
      result: "SUCCESS",
    },
    {
      action: "INVOICE_MARKED_PAID",
      actorUserId: input.organizationAOwnerUserId,
      daysAgo: 1,
      hour: 16,
      objectId: "2026-1029",
      objectType: "incoming_invoice",
      organizationId: input.organizationAId,
      reason: null,
      result: "SUCCESS",
    },
    {
      action: "ORGANIZATION_REGISTRATION_REJECTED",
      actorUserId: input.adminUserId,
      daysAgo: 15,
      hour: 11,
      objectId: platformId("c8", 4),
      objectType: "registration_request",
      organizationId: platformId("c8", 4),
      reason:
        "Liegt außerhalb der Pilotregion NRW-West. Wieder aufnehmen, sobald der Pilot nach Köln erweitert wird.",
      result: "SUCCESS",
    },
    {
      action: "ORGANIZATION_SUSPENDED",
      actorUserId: input.adminUserId,
      daysAgo: 12,
      hour: 10,
      objectId: platformId("c8", 5),
      objectType: "organization",
      organizationId: platformId("c8", 5),
      reason: "Auf Wunsch des Betriebs während des Umbaus pausiert.",
      result: "SUCCESS",
    },
  ];

  await transaction
    .insert(auditEvents)
    .values(
      rows.map((row, index) => ({
        action: row.action,
        actorUserId: row.actorUserId,
        createdAt: daysAgo(now, row.daysAgo, row.hour),
        id: platformId("d5", index + 1),
        metadata: {},
        objectId: row.objectId,
        objectType: row.objectType,
        organizationId: row.organizationId,
        reason: row.reason,
        result: row.result,
      })),
    )
    .onConflictDoUpdate({
      target: auditEvents.id,
      set: {
        action: sql`excluded.action`,
        createdAt: sql`excluded.created_at`,
        reason: sql`excluded.reason`,
        result: sql`excluded.result`,
      },
    });
}

export async function seedDemoPlatform(
  transaction: SeedTransaction,
  input: DemoPlatformInput,
): Promise<void> {
  const now = input.now ?? new Date();

  await seedPartnerStores(transaction, input, now);
  await seedApplicants(transaction, input, now);
  await seedInvitations(transaction, input, now);
  await seedSupportAssignments(transaction, input, now);
  await seedDomainRequests(transaction, input, now);
  await seedAuditTrail(transaction, input, now);
}

/** Bestaetigte Nachbarmenge der laufenden Runde in kg. */
export const partnerConfirmedKg = partnerStores.reduce(
  (total, store) => total + store.vealKg + store.chickenKg,
  0,
);
