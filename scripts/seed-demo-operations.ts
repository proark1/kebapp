// Demo-Daten fuer alle Betriebsansichten: Umsatz, Hygiene, Zeit, Buchhaltung,
// Kalkulation, Wareneingang, Vorlagen, Zuschlaege und Gaeste.
//
// Beide Seeds - lokal und oeffentliche Demo - rufen dieselbe Funktion auf.
// Alle Datensaetze haben feste, aus Betrieb und Tag abgeleitete Kennungen und
// werden per Upsert geschrieben. Ein erneuter Lauf frischt die Daten auf,
// ohne von Hand erfasste Datensaetze zu beruehren.

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  buyingRounds,
  demandItems,
  demandSubmissions,
  demandTemplateItems,
  demandTemplates,
  goodsReceiptItems,
  goodsReceipts,
  guestOrderItems,
  guestOrders,
  guests,
  hygieneEntries,
  hygieneItems,
  incomingInvoices,
  loyaltyRedemptions,
  menuCalculations,
  platformImports,
  roundAwards,
  salesDaily,
  timeEntries,
} from "../src/server/db/schema";

type SeedDatabase = NodePgDatabase<Record<string, never>>;
export type SeedTransaction = Parameters<
  Parameters<SeedDatabase["transaction"]>[0]
>[0];

export type DemoMenuItem = {
  id: string;
  name: string;
  priceCents: number;
};

export type DemoOperationsTarget = {
  /** Mitarbeitendes Konto; ohne Angabe uebernimmt die Inhaberrolle alles. */
  employeeUserId?: string | null;
  menu: DemoMenuItem[];
  /** Laufende Runde des Betriebs, bekommt ebenfalls einen Zuschlag. */
  openRoundId?: string | null;
  openRoundRegionalKey?: string | null;
  organizationId: string;
  ownerUserId: string;
  /** Eindeutige Ziffer je Betrieb, macht alle Kennungen kollisionsfrei. */
  slot: number;
  storeName: string;
};

const SALES_DAYS = 70;
const HYGIENE_DAYS = 21;
const SHIFT_DAYS = 21;
const GUESTS_PER_STORE = 12;

function demoId(group: string, slot: number, index: number): string {
  const tail = (slot * 100_000_000 + index).toString(16).padStart(12, "0");
  return `${group}000000-0000-4000-8000-${tail}`;
}

// Wiederholbare Streuung ohne Zufallsquelle: gleicher Eingabewert, gleiche
// Zahl bei jedem Seed-Lauf.
function spread(seed: number): number {
  const value = Math.sin(seed) * 10_000;
  return value - Math.floor(value);
}

function atDaysAgo(now: Date, days: number, hour: number, minute = 0): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayKey(date: Date): number {
  return Number(isoDay(date).replace(/-/g, ""));
}

async function seedSales(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  importedByUserId: string,
): Promise<void> {
  const rows = [];
  for (let dayOffset = 1; dayOffset <= SALES_DAYS; dayOffset += 1) {
    const day = atDaysAgo(now, dayOffset, 12);
    const weekday = day.getUTCDay();
    if (weekday === 1) continue; // Montag Ruhetag

    const weekendBoost = weekday === 5 || weekday === 6 ? 1.35 : 1;
    const noise = 0.82 + spread(target.slot * 977 + dayOffset) * 0.4;
    const netSalesCents = Math.round(78_000 * weekendBoost * noise);

    rows.push({
      businessDate: isoDay(day),
      guestCount: Math.round(netSalesCents / 1_180),
      importedByUserId,
      netSalesCents,
      organizationId: target.organizationId,
      source: "CSV" as const,
    });
  }

  if (rows.length === 0) return;
  await transaction
    .insert(salesDaily)
    .values(rows)
    .onConflictDoUpdate({
      target: [salesDaily.organizationId, salesDaily.businessDate],
      set: {
        guestCount: sql`excluded.guest_count`,
        netSalesCents: sql`excluded.net_sales_cents`,
        source: sql`excluded.source`,
        updatedAt: now,
      },
    });
}

async function seedHygiene(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
): Promise<void> {
  const completedBy = target.employeeUserId ?? target.ownerUserId;

  for (let dayOffset = 1; dayOffset <= HYGIENE_DAYS; dayOffset += 1) {
    const day = atDaysAgo(now, dayOffset, 9);
    if (day.getUTCDay() === 1) continue;

    const entryId = demoId("a2", target.slot, dayKey(day));
    const hasFinding = spread(target.slot * 131 + dayOffset) > 0.88;

    await transaction
      .insert(hygieneEntries)
      .values({
        completedByUserId: completedBy,
        entryDate: isoDay(day),
        id: entryId,
        note: hasFinding
          ? "Kühlschranktür stand offen, Temperatur nachgeregelt."
          : null,
        organizationId: target.organizationId,
      })
      .onConflictDoUpdate({
        target: hygieneEntries.id,
        set: {
          entryDate: sql`excluded.entry_date`,
          note: sql`excluded.note`,
          updatedAt: now,
        },
      });

    const fridgeCelsius = hasFinding
      ? 6.8
      : 2.4 + spread(target.slot * 313 + dayOffset) * 1.6;
    const freezerCelsius = -20 + spread(target.slot * 517 + dayOffset) * 2.4;

    const items = [
      { key: "haende", kind: "CHECK" as const },
      { key: "oberflaechen", kind: "CHECK" as const },
      { key: "geraete", kind: "CHECK" as const },
      { key: "muell", kind: "CHECK" as const },
      {
        celsius: fridgeCelsius,
        key: "kuehlschrank",
        kind: "TEMPERATURE" as const,
      },
      {
        celsius: freezerCelsius,
        key: "tiefkuehler",
        kind: "TEMPERATURE" as const,
      },
    ];

    await transaction
      .insert(hygieneItems)
      .values(
        items.map((item, itemIndex) => ({
          celsius:
            item.kind === "TEMPERATURE" ? item.celsius!.toFixed(1) : null,
          id: demoId("a3", target.slot, dayKey(day) * 10 + itemIndex),
          itemKey: item.key,
          kind: item.kind,
          note:
            hasFinding && item.key === "kuehlschrank"
              ? "Tür stand offen, nachgeregelt"
              : null,
          organizationId: target.organizationId,
          entryId,
          status:
            item.kind === "CHECK"
              ? hasFinding && item.key === "geraete"
                ? ("MANGEL" as const)
                : ("OK" as const)
              : null,
        })),
      )
      .onConflictDoUpdate({
        target: hygieneItems.id,
        set: {
          celsius: sql`excluded.celsius`,
          note: sql`excluded.note`,
          status: sql`excluded.status`,
          updatedAt: now,
        },
      });
  }
}

async function seedShifts(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
): Promise<void> {
  const staff = [
    { endHour: 20, startHour: 10, userId: target.ownerUserId },
    ...(target.employeeUserId
      ? [{ endHour: 22, startHour: 16, userId: target.employeeUserId }]
      : []),
  ];

  for (const [staffIndex, person] of staff.entries()) {
    const rows = [];
    for (let dayOffset = 1; dayOffset <= SHIFT_DAYS; dayOffset += 1) {
      const day = atDaysAgo(now, dayOffset, person.startHour);
      if (day.getUTCDay() === 1) continue;

      const endedAt = new Date(day);
      endedAt.setUTCHours(person.endHour, spread(dayOffset) > 0.6 ? 30 : 0, 0, 0);

      rows.push({
        endedAt,
        id: demoId("a4", target.slot, dayKey(day) * 10 + staffIndex),
        organizationId: target.organizationId,
        startedAt: day,
        userId: person.userId,
      });
    }

    if (rows.length === 0) continue;
    await transaction
      .insert(timeEntries)
      .values(rows)
      .onConflictDoUpdate({
        target: timeEntries.id,
        set: {
          endedAt: sql`excluded.ended_at`,
          startedAt: sql`excluded.started_at`,
          updatedAt: now,
        },
      });
  }

  // Eine laufende Schicht, damit die Stempeluhr im Demo nicht leer wirkt.
  if (target.employeeUserId) {
    const startedAt = new Date(now.getTime() - 3 * 60 * 60 * 1_000);
    await transaction
      .insert(timeEntries)
      .values({
        endedAt: null,
        id: demoId("a4", target.slot, 999_999),
        note: "Laufende Schicht",
        organizationId: target.organizationId,
        startedAt,
        userId: target.employeeUserId,
      })
      .onConflictDoUpdate({
        target: timeEntries.id,
        set: { startedAt, endedAt: null, updatedAt: now },
      });
  }
}

const invoiceBlueprints = [
  { category: "FLEISCH" as const, net19: false, supplier: "Anadolu Fleischhandel" },
  { category: "GEMUESE" as const, net19: false, supplier: "Gemüsegroßmarkt Viersen" },
  { category: "TROCKEN" as const, net19: false, supplier: "Backhaus Yıldız" },
  { category: "GETRAENKE" as const, net19: true, supplier: "Getränke Kremer" },
  { category: "VERPACKUNG" as const, net19: true, supplier: "Verpackung Rhein-Ruhr" },
  { category: "SONSTIGES" as const, net19: true, supplier: "Stadtwerke Mönchengladbach" },
];

async function seedInvoices(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  createdByUserId: string,
): Promise<void> {
  const rows = [];
  for (let index = 0; index < 18; index += 1) {
    const blueprint = invoiceBlueprints[index % invoiceBlueprints.length]!;
    const dayOffset = 4 + index * 5;
    const documentDate = atDaysAgo(now, dayOffset, 10);
    const dueDate = atDaysAgo(now, dayOffset - 14, 10);
    const netCents = Math.round(
      18_000 + spread(target.slot * 71 + index) * 62_000,
    );
    const isPaid = dayOffset > 20;

    rows.push({
      category: blueprint.category,
      createdByUserId,
      documentDate: isoDay(documentDate),
      dueDate: isoDay(dueDate),
      id: demoId("a5", target.slot, index),
      invoiceNumber: `${documentDate.getUTCFullYear()}-${String(1_000 + index * 7 + target.slot).padStart(4, "0")}`,
      netCents19: blueprint.net19 ? netCents : 0,
      netCents7: blueprint.net19 ? 0 : netCents,
      organizationId: target.organizationId,
      paidAt: isPaid ? atDaysAgo(now, dayOffset - 18, 12) : null,
      status: isPaid ? ("BEZAHLT" as const) : ("OFFEN" as const),
      supplierName: blueprint.supplier,
    });
  }

  await transaction
    .insert(incomingInvoices)
    .values(rows)
    .onConflictDoUpdate({
      target: incomingInvoices.id,
      set: {
        documentDate: sql`excluded.document_date`,
        dueDate: sql`excluded.due_date`,
        paidAt: sql`excluded.paid_at`,
        status: sql`excluded.status`,
        updatedAt: now,
      },
    });
}

async function seedCalculations(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  createdByUserId: string,
): Promise<void> {
  if (target.menu.length === 0) return;

  const rows = target.menu.map((item, index) => {
    const ingredients = [
      {
        name: "Drehspieß",
        quantity: 0.18,
        unitPriceCents: 918,
      },
      { name: "Fladenbrot", quantity: 1, unitPriceCents: 62 },
      { name: "Salat und Gemüse", quantity: 0.12, unitPriceCents: 340 },
      { name: "Sauce", quantity: 0.05, unitPriceCents: 480 },
    ];
    const totalCostCents = Math.round(
      ingredients.reduce(
        (sum, ingredient) =>
          sum + ingredient.quantity * ingredient.unitPriceCents,
        0,
      ) * (1 + index * 0.35),
    );

    return {
      createdByUserId,
      id: demoId("a6", target.slot, index),
      ingredients,
      menuItemKey: item.id,
      menuName: item.name,
      organizationId: target.organizationId,
      salePriceCents: item.priceCents,
      totalCostCents,
    };
  });

  await transaction
    .insert(menuCalculations)
    .values(rows)
    .onConflictDoUpdate({
      target: [menuCalculations.organizationId, menuCalculations.menuItemKey],
      set: {
        ingredients: sql`excluded.ingredients`,
        menuName: sql`excluded.menu_name`,
        salePriceCents: sql`excluded.sale_price_cents`,
        totalCostCents: sql`excluded.total_cost_cents`,
        updatedAt: now,
      },
    });
}

// Abgeschlossene Runde in der Vergangenheit, damit Wareneingang und
// Lieferantenzuschlag echte Belege haben.
async function seedClosedRound(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  adminUserId: string,
): Promise<void> {
  const closesAt = atDaysAgo(now, 17, 18);
  const deliveryStartsAt = atDaysAgo(now, 10, 4);
  const deliveryEndsAt = atDaysAgo(now, 10, 8);
  const deliveryDate = isoDay(deliveryStartsAt);
  const regionalKey = `nrw-west-${deliveryDate}`;
  const roundId = demoId("a7", target.slot, 1);
  const submissionId = demoId("a8", target.slot, 1);
  const receiptId = demoId("b1", target.slot, 1);

  await transaction
    .insert(buyingRounds)
    .values({
      closesAt,
      createdByUserId: adminUserId,
      deliveryEndsAt,
      deliveryStartsAt,
      id: roundId,
      name: "Sammelrunde Fleisch · abgeschlossen",
      organizationId: target.organizationId,
      pricingTiers: [
        { label: "Einzelkondition", minimumQuantity: "0", unitPrice: "9.40" },
        { label: "Gruppenpreis", minimumQuantity: "300", unitPrice: "9.05" },
        { label: "Zielpreis", minimumQuantity: "750", unitPrice: "8.42" },
      ],
      referenceUnitPrice: "9.18",
      regionalKey,
      status: "SUBMITTED",
      targetQuantity: "750.000",
    })
    .onConflictDoUpdate({
      target: buyingRounds.id,
      set: {
        closesAt,
        deliveryEndsAt,
        deliveryStartsAt,
        regionalKey,
        status: "SUBMITTED",
        updatedAt: now,
      },
    });

  await transaction
    .insert(demandSubmissions)
    .values({
      buyingRoundId: roundId,
      confirmedAt: closesAt,
      confirmedByUserId: target.ownerUserId,
      id: submissionId,
      organizationId: target.organizationId,
      status: "CONFIRMED",
    })
    .onConflictDoUpdate({
      target: demandSubmissions.id,
      set: { confirmedAt: closesAt, status: "CONFIRMED", updatedAt: now },
    });

  const orderedItems = [
    {
      productName: "Kalb-Drehspieß",
      quantity: "60.000",
      received: "55.000",
      specification: "20 kg · Scheibenanteil 60 % · halal",
    },
    {
      productName: "Hähnchen-Drehspieß",
      quantity: "30.000",
      received: "30.000",
      specification: "15 kg · gewürzt · halal",
    },
  ];

  await transaction
    .insert(demandItems)
    .values(
      orderedItems.map((item, index) => ({
        estimatedUnitPrice: "9.18",
        id: demoId("a9", target.slot, index),
        organizationId: target.organizationId,
        productName: item.productName,
        quantity: item.quantity,
        requestedDeliveryDate: deliveryDate,
        specification: item.specification,
        submissionId,
        unit: "KG" as const,
      })),
    )
    .onConflictDoUpdate({
      target: demandItems.id,
      set: {
        requestedDeliveryDate: deliveryDate,
        updatedAt: now,
      },
    });

  await transaction
    .insert(goodsReceipts)
    .values({
      buyingRoundId: roundId,
      id: receiptId,
      note: "Lieferung vollständig geprüft, eine Position gekürzt.",
      organizationId: target.organizationId,
      savedByUserId: target.ownerUserId,
    })
    .onConflictDoUpdate({
      target: goodsReceipts.id,
      set: { note: sql`excluded.note`, updatedAt: now },
    });

  await transaction
    .insert(goodsReceiptItems)
    .values(
      orderedItems.map((item, index) => ({
        demandItemId: demoId("a9", target.slot, index),
        id: demoId("b2", target.slot, index),
        missingReason:
          item.received === item.quantity ? null : ("SHORTAGE" as const),
        orderedQuantity: item.quantity,
        organizationId: target.organizationId,
        productName: item.productName,
        reasonNote:
          item.received === item.quantity
            ? null
            : "Lieferant konnte nur 55 kg liefern.",
        receiptId,
        receivedQuantity: item.received,
        specification: item.specification,
        unit: "KG" as const,
      })),
    )
    .onConflictDoUpdate({
      target: goodsReceiptItems.id,
      set: {
        receivedQuantity: sql`excluded.received_quantity`,
        updatedAt: now,
      },
    });

  await transaction
    .insert(roundAwards)
    .values({
      buyingRoundId: roundId,
      createdByUserId: adminUserId,
      id: demoId("b3", target.slot, 1),
      note: "Zuschlag nach Gruppenmenge 812 kg.",
      organizationId: target.organizationId,
      regionalKey,
      supplierName: "Anadolu Fleischhandel",
      unitPriceCents: 842,
    })
    .onConflictDoUpdate({
      target: roundAwards.id,
      set: {
        regionalKey,
        unitPriceCents: 842,
        updatedAt: now,
      },
    });

  // Auch die laufende Runde bekommt einen Zuschlag, damit die Bedarfsplanung
  // das Lieferantenabzeichen zeigt.
  if (target.openRoundId) {
    await transaction
      .insert(roundAwards)
      .values({
        buyingRoundId: target.openRoundId,
        createdByUserId: adminUserId,
        id: demoId("b3", target.slot, 2),
        note: "Vorläufiger Zuschlag, Menge wird bis Bestellschluss bestätigt.",
        organizationId: target.organizationId,
        regionalKey: target.openRoundRegionalKey ?? regionalKey,
        supplierName: "Anadolu Fleischhandel",
        unitPriceCents: 905,
      })
      .onConflictDoUpdate({
        target: roundAwards.id,
        set: { unitPriceCents: 905, updatedAt: now },
      });
  }
}

async function seedTemplate(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
): Promise<void> {
  const templateId = demoId("b4", target.slot, 1);

  await transaction
    .insert(demandTemplates)
    .values({
      id: templateId,
      name: "Stammbedarf Woche",
      organizationId: target.organizationId,
    })
    .onConflictDoUpdate({
      target: demandTemplates.id,
      set: { name: sql`excluded.name`, updatedAt: now },
    });

  await transaction
    .insert(demandTemplateItems)
    .values([
      {
        id: demoId("b5", target.slot, 1),
        organizationId: target.organizationId,
        productName: "Kalb-Drehspieß",
        quantity: "60.000",
        specification: "20 kg · Scheibenanteil 60 % · halal",
        templateId,
        unit: "KG" as const,
      },
      {
        id: demoId("b5", target.slot, 2),
        organizationId: target.organizationId,
        productName: "Hähnchen-Drehspieß",
        quantity: "30.000",
        specification: "15 kg · gewürzt · halal",
        templateId,
        unit: "KG" as const,
      },
    ])
    .onConflictDoUpdate({
      target: demandTemplateItems.id,
      set: { quantity: sql`excluded.quantity`, updatedAt: now },
    });
}

const guestNames = [
  "Ayşe K.",
  "Murat D.",
  "Familie Schneider",
  "Kevin B.",
  "Fatma Y.",
  "Tobias L.",
  "Selin A.",
  "Baustelle Hindenburgstr.",
  "Nadine P.",
  "Emre Ö.",
  null,
  "Pflegedienst Rheydt",
];

async function seedGuests(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  importedByUserId: string,
): Promise<void> {
  if (target.menu.length === 0) return;

  let busiest = { guestId: "", orderCount: 0 };

  for (let guestIndex = 0; guestIndex < GUESTS_PER_STORE; guestIndex += 1) {
    const guestId = demoId("b6", target.slot, guestIndex);
    // Bewusst gestreute Bestellzahl: einige Gaeste haben eine volle
    // Stempelkarte, einer davon hat bereits eingeloest.
    const orderCount = 1 + Math.floor(spread(target.slot * 29 + guestIndex) * 14);
    const firstOrderAt = atDaysAgo(now, 5 + orderCount * 6, 18);
    const lastOrderAt = atDaysAgo(now, 1 + guestIndex, 19);
    const phone = `49176${String(4_100_000 + target.slot * 1_000 + guestIndex).padStart(7, "0")}`;

    await transaction
      .insert(guests)
      .values({
        consentAt: firstOrderAt,
        consentSource: guestIndex % 4 === 0 ? "LADEN" : "STOREFRONT",
        firstOrderAt,
        id: guestId,
        lastOrderAt,
        name: guestNames[guestIndex % guestNames.length] ?? null,
        note: guestIndex === 2 ? "Immer ohne Zwiebeln" : null,
        organizationId: target.organizationId,
        phone,
      })
      .onConflictDoUpdate({
        target: guests.id,
        set: {
          firstOrderAt,
          lastOrderAt,
          updatedAt: now,
        },
      });

    for (let orderIndex = 0; orderIndex < orderCount; orderIndex += 1) {
      const item =
        target.menu[
          Math.floor(spread(guestIndex * 53 + orderIndex) * target.menu.length)
        ] ?? target.menu[0]!;
      const quantity = 1 + Math.floor(spread(orderIndex * 17 + guestIndex) * 3);
      const placedAt = atDaysAgo(
        now,
        1 + guestIndex + orderIndex * 6,
        18 + Math.floor(spread(orderIndex + guestIndex) * 4),
      );
      const isDelivery = spread(guestIndex * 7 + orderIndex) > 0.55;
      const source =
        orderIndex % 5 === 0
          ? ("PLATTFORM" as const)
          : orderIndex % 3 === 0
            ? ("MANUELL" as const)
            : ("STOREFRONT" as const);
      const orderId = demoId("b7", target.slot, guestIndex * 100 + orderIndex);

      await transaction
        .insert(guestOrders)
        .values({
          deliveryAddress: isDelivery
            ? "Hindenburgstraße 122, 41061 Mönchengladbach"
            : null,
          externalReference:
            source === "PLATTFORM"
              ? `LF-${target.slot}${guestIndex}${orderIndex}`
              : null,
          guestId,
          id: orderId,
          mode: isDelivery ? "DELIVERY" : "PICKUP",
          note: orderIndex === 0 && guestIndex === 2 ? "ohne Zwiebeln" : null,
          organizationId: target.organizationId,
          placedAt,
          source,
          status: "ABGESCHLOSSEN",
          totalCents: item.priceCents * quantity,
        })
        .onConflictDoUpdate({
          target: guestOrders.id,
          set: { placedAt, updatedAt: now },
        });

      await transaction
        .insert(guestOrderItems)
        .values({
          id: demoId("b8", target.slot, guestIndex * 100 + orderIndex),
          menuItemId: item.id,
          name: item.name,
          orderId,
          organizationId: target.organizationId,
          quantity,
          unitPriceCents: item.priceCents,
        })
        .onConflictDoNothing({ target: guestOrderItems.id });
    }

    if (orderCount > busiest.orderCount) {
      busiest = { guestId, orderCount };
    }
  }

  // Der Gast mit den meisten Bestellungen hat seine erste Karte bereits
  // eingeloest, damit Einloesung und Reststempel im Demo sichtbar sind.
  if (busiest.guestId !== "" && busiest.orderCount >= 12) {
    const redeemedAt = atDaysAgo(now, 12, 19);
    await transaction
      .insert(loyaltyRedemptions)
      .values({
        guestId: busiest.guestId,
        id: demoId("b9", target.slot, 1),
        organizationId: target.organizationId,
        redeemedAt,
        redeemedByUserId: target.ownerUserId,
        rewardLabel: "Ein Gericht gratis",
        stampsUsed: 10,
      })
      .onConflictDoUpdate({
        target: loyaltyRedemptions.id,
        set: { guestId: busiest.guestId, redeemedAt },
      });
  }

  await transaction
    .insert(platformImports)
    .values({
      createdCount: 9,
      fileName: "lieferando-export-august.csv",
      id: demoId("c1", target.slot, 1),
      importedAt: atDaysAgo(now, 3, 11),
      importedByUserId,
      organizationId: target.organizationId,
      platform: "Lieferando",
      rowCount: 11,
      skippedCount: 2,
    })
    .onConflictDoUpdate({
      target: platformImports.id,
      set: { importedAt: atDaysAgo(now, 3, 11) },
    });
}

export async function seedDemoOperations(
  transaction: SeedTransaction,
  input: {
    adminUserId: string;
    now?: Date;
    targets: DemoOperationsTarget[];
  },
): Promise<void> {
  const now = input.now ?? new Date();

  for (const target of input.targets) {
    const staffUserId = target.employeeUserId ?? target.ownerUserId;
    await seedSales(transaction, target, now, staffUserId);
    await seedHygiene(transaction, target, now);
    await seedShifts(transaction, target, now);
    await seedInvoices(transaction, target, now, target.ownerUserId);
    await seedCalculations(transaction, target, now, target.ownerUserId);
    await seedClosedRound(transaction, target, now, input.adminUserId);
    await seedTemplate(transaction, target, now);
    await seedGuests(transaction, target, now, target.ownerUserId);
  }
}
