// Demo-Daten fuer alle Betriebsansichten: Umsatz, Hygiene, Zeit, Buchhaltung,
// Kalkulation, Wareneingang, Vorlagen, Zuschlaege und Gaeste.
//
// Beide Seeds - lokal und oeffentliche Demo - rufen dieselbe Funktion auf.
// Alle Datensaetze haben feste, aus Betrieb und Tag abgeleitete Kennungen und
// werden per Upsert geschrieben. Ein erneuter Lauf frischt die Daten auf,
// ohne von Hand erfasste Datensaetze zu beruehren.

import { and, eq, inArray, ne, sql } from "drizzle-orm";
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
  // Ab dem heutigen Tag: sonst steht die Kassenliste im Demo immer einen
  // Tag hinter dem Kalender.
  for (let dayOffset = 0; dayOffset <= SALES_DAYS; dayOffset += 1) {
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
      // Die meisten Tage kommen als Kassenexport, einzelne Tage traegt der
      // Betrieb von Hand nach. Beide Quellen sollen sichtbar sein.
      source: dayOffset % 9 === 4 ? ("MANUAL" as const) : ("CSV" as const),
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

  // Der Tages-Check startet beim heutigen Tag: die Ansicht oeffnet immer
  // auf heute und stand sonst als leeres Formular da.
  for (let dayOffset = 0; dayOffset <= HYGIENE_DAYS; dayOffset += 1) {
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

const shiftNotes: Array<string | null> = [
  null,
  null,
  "Ausstempeln vergessen, Ende von der Inhaberin korrigiert",
  null,
  "Lieferung angenommen, 20 Minuten länger",
  null,
  null,
  "Frühstücksschicht getauscht",
  null,
  "Grundreinigung Abzugshaube",
  null,
];

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

      // Vermerke und Korrekturen kommen im Alltag regelmaessig vor. Ohne sie
      // bleiben die Spalten "Vermerk" und "korrigiert" im Demo leer.
      const noteIndex = (dayOffset + staffIndex * 3) % 11;
      const note = shiftNotes[noteIndex] ?? null;
      const corrected = noteIndex === 2;

      rows.push({
        correctedByUserId: corrected ? target.ownerUserId : null,
        endedAt,
        id: demoId("a4", target.slot, dayKey(day) * 10 + staffIndex),
        note,
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
          correctedByUserId: sql`excluded.corrected_by_user_id`,
          endedAt: sql`excluded.ended_at`,
          note: sql`excluded.note`,
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

const INVOICE_COUNT = 24;

// Ein Beleg im Demo stammt aus einer echten XRechnung. Nur so ist im
// Buchhaltungsbereich zu sehen, wie eine importierte E-Rechnung aussieht.
function sampleEInvoiceXml(
  invoiceNumber: string,
  supplierName: string,
  documentDate: string,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
    '  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    '  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    `  <cbc:ID>${invoiceNumber}</cbc:ID>`,
    `  <cbc:IssueDate>${documentDate}</cbc:IssueDate>`,
    "  <cac:AccountingSupplierParty><cac:Party><cac:PartyName>",
    `    <cbc:Name>${supplierName}</cbc:Name>`,
    "  </cac:PartyName></cac:Party></cac:AccountingSupplierParty>",
    "</Invoice>",
  ].join("\n");
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
  for (let index = 0; index < INVOICE_COUNT; index += 1) {
    const blueprint = invoiceBlueprints[index % invoiceBlueprints.length]!;
    const dayOffset = 2 + index * 4;
    const documentDate = atDaysAgo(now, dayOffset, 10);
    // Zahlungsziele streuen: ueberfaellig, faellig in wenigen Tagen und
    // Rechnungen ganz ohne vereinbartes Ziel.
    const paymentTermDays =
      index === 3
        ? 10
        : index === 4
          ? 7
          : index % 5 === 3
            ? null
            : 14 + (index % 3) * 7;
    const dueDate =
      paymentTermDays === null
        ? null
        : atDaysAgo(now, dayOffset - paymentTermDays, 10);
    const netCents = Math.round(
      18_000 + spread(target.slot * 71 + index) * 62_000,
    );
    const isPaid = dayOffset > 20;
    // Beide Steuersaetze auf einem Beleg: Getraenke neben Ware.
    const isMixed = index % 6 === 2;
    const documentNumber = `${documentDate.getUTCFullYear()}-${String(1_000 + index * 7 + target.slot).padStart(4, "0")}`;
    const isEInvoice = index === 0;

    rows.push({
      category: blueprint.category,
      createdByUserId,
      documentDate: isoDay(documentDate),
      dueDate: dueDate ? isoDay(dueDate) : null,
      eInvoiceXml: isEInvoice
        ? sampleEInvoiceXml(documentNumber, blueprint.supplier, isoDay(documentDate))
        : null,
      id: demoId("a5", target.slot, index),
      invoiceNumber: documentNumber,
      netCents19: blueprint.net19
        ? netCents
        : isMixed
          ? Math.round(netCents * 0.18)
          : 0,
      netCents7: blueprint.net19 ? 0 : netCents,
      organizationId: target.organizationId,
      paidAt: isPaid ? atDaysAgo(now, dayOffset - 18, 12) : null,
      sourceFileName: isEInvoice ? `xrechnung-${documentNumber}.xml` : null,
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
        eInvoiceXml: sql`excluded.e_invoice_xml`,
        netCents19: sql`excluded.net_cents_19`,
        netCents7: sql`excluded.net_cents_7`,
        paidAt: sql`excluded.paid_at`,
        sourceFileName: sql`excluded.source_file_name`,
        status: sql`excluded.status`,
        updatedAt: now,
      },
    });
}

type DemoIngredient = { name: string; quantity: number; unitPriceCents: number };

// Jedes Gericht bekommt seine eigene Rezeptur. Vorher trugen alle Gerichte
// dieselbe Zutatenliste, was die Kalkulation wertlos machte.
function ingredientsForDish(dishName: string): DemoIngredient[] {
  const name = dishName.toLowerCase();

  if (name.includes("ayran")) {
    // Bewusst knapp kalkuliert: die Kalkulation soll auch den Hinweis auf
    // eine Marge unter 60 % zeigen koennen.
    return [
      { name: "Joghurt", quantity: 0.3, unitPriceCents: 260 },
      { name: "Salz und Wasser", quantity: 0.05, unitPriceCents: 30 },
      { name: "Becher mit Deckel", quantity: 1, unitPriceCents: 14 },
    ];
  }
  if (name.includes("lahmacun")) {
    return [
      { name: "Teigfladen", quantity: 1, unitPriceCents: 48 },
      { name: "Hackfleisch-Paste", quantity: 0.09, unitPriceCents: 780 },
      { name: "Salat und Zitrone", quantity: 0.1, unitPriceCents: 320 },
      { name: "Faltschachtel", quantity: 1, unitPriceCents: 22 },
    ];
  }
  if (name.includes("falafel")) {
    return [
      { name: "Falafelbällchen", quantity: 0.14, unitPriceCents: 640 },
      { name: "Fladenbrot", quantity: 1, unitPriceCents: 62 },
      { name: "Salat und Gemüse", quantity: 0.14, unitPriceCents: 340 },
      { name: "Sesamsauce", quantity: 0.05, unitPriceCents: 690 },
      { name: "Bestellpapier", quantity: 1, unitPriceCents: 9 },
    ];
  }
  if (name.includes("adana")) {
    return [
      { name: "Adana-Spieß", quantity: 0.24, unitPriceCents: 1_120 },
      { name: "Bulgur", quantity: 0.15, unitPriceCents: 180 },
      { name: "Salat und Gemüse", quantity: 0.16, unitPriceCents: 340 },
      { name: "Sauce", quantity: 0.06, unitPriceCents: 480 },
      { name: "Menüschale", quantity: 1, unitPriceCents: 38 },
    ];
  }
  if (name.includes("teller")) {
    return [
      { name: "Drehspieß", quantity: 0.26, unitPriceCents: 918 },
      { name: "Beilage Reis oder Pommes", quantity: 0.2, unitPriceCents: 165 },
      { name: "Salat und Gemüse", quantity: 0.18, unitPriceCents: 340 },
      { name: "Sauce", quantity: 0.06, unitPriceCents: 480 },
      { name: "Menüschale", quantity: 1, unitPriceCents: 38 },
    ];
  }
  if (name.includes("dürüm") || name.includes("duerum")) {
    return [
      { name: "Drehspieß", quantity: 0.19, unitPriceCents: 918 },
      { name: "Dünner Fladen", quantity: 1, unitPriceCents: 54 },
      { name: "Salat und Gemüse", quantity: 0.13, unitPriceCents: 340 },
      { name: "Sauce", quantity: 0.05, unitPriceCents: 480 },
      { name: "Alufolie und Papier", quantity: 1, unitPriceCents: 11 },
    ];
  }

  return [
    { name: "Drehspieß", quantity: 0.18, unitPriceCents: 918 },
    { name: "Fladenbrot", quantity: 1, unitPriceCents: 62 },
    { name: "Salat und Gemüse", quantity: 0.12, unitPriceCents: 340 },
    { name: "Sauce", quantity: 0.05, unitPriceCents: 480 },
    { name: "Bestellpapier", quantity: 1, unitPriceCents: 9 },
  ];
}

async function seedCalculations(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  createdByUserId: string,
): Promise<void> {
  if (target.menu.length === 0) return;

  const rows = target.menu.map((item) => {
    const ingredients = ingredientsForDish(item.name);
    const totalCostCents = Math.round(
      ingredients.reduce(
        (sum, ingredient) =>
          sum + ingredient.quantity * ingredient.unitPriceCents,
        0,
      ),
    );

    return {
      createdByUserId,
      // Bewusst ohne feste Kennung: eindeutig ist hier (Betrieb, Gericht).
      // Eine aus dem Listenindex abgeleitete Kennung kollidiert, sobald sich
      // die Reihenfolge der Speisekarte aendert.
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

// Abgeschlossene Runden in der Vergangenheit, damit Wareneingang und
// Lieferantenzuschlag echte Belege haben. Die aeltere Lieferung ist bereits
// erfasst, die juengere steht noch offen - nur so zeigt der Wareneingang
// beide Zustaende.
const closedRoundBlueprints = [
  {
    closesDaysAgo: 17,
    deliveryDaysAgo: 10,
    idIndex: 1,
    items: [
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
    ],
    name: "Sammelrunde Fleisch · Juli-Lieferung",
    receipt: true,
    unitPriceCents: 842,
  },
  {
    closesDaysAgo: 6,
    deliveryDaysAgo: 2,
    idIndex: 2,
    items: [
      {
        productName: "Kalb-Drehspieß",
        quantity: "75.000",
        received: "75.000",
        specification: "25 kg · Scheibenanteil 60 % · halal",
      },
      {
        productName: "Hähnchen-Drehspieß",
        quantity: "45.000",
        received: "45.000",
        specification: "15 kg · gewürzt · halal",
      },
    ],
    name: "Sammelrunde Fleisch · August-Lieferung",
    receipt: false,
    unitPriceCents: 905,
  },
] as const;

// Die abgeschlossenen Runden brauchen ihren Termin auch ausserhalb dieses
// Moduls: die Nachbarlaeden im Plattform-Seed melden ihren Bedarf in
// dieselbe Runde, sonst bleibt die Gruppenmenge im Ersparnis-Report bei den
// zwei Demo-Betrieben stehen und die Ersparnis wird negativ.
export function closedRoundSchedule(now: Date, index = 0) {
  const blueprint = closedRoundBlueprints[index]!;
  const deliveryStartsAt = atDaysAgo(now, blueprint.deliveryDaysAgo, 4);

  return {
    closesAt: atDaysAgo(now, blueprint.closesDaysAgo, 18),
    deliveryEndsAt: atDaysAgo(now, blueprint.deliveryDaysAgo, 8),
    deliveryStartsAt,
    name: blueprint.name,
    regionalKey: `nrw-west-${isoDay(deliveryStartsAt)}`,
  };
}

async function seedClosedRound(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  adminUserId: string,
  blueprint: (typeof closedRoundBlueprints)[number],
): Promise<void> {
  const slotIndex = blueprint.idIndex;
  const closesAt = atDaysAgo(now, blueprint.closesDaysAgo, 18);
  const deliveryStartsAt = atDaysAgo(now, blueprint.deliveryDaysAgo, 4);
  const deliveryEndsAt = atDaysAgo(now, blueprint.deliveryDaysAgo, 8);
  const deliveryDate = isoDay(deliveryStartsAt);
  const regionalKey = `nrw-west-${deliveryDate}`;
  const roundId = demoId("a7", target.slot, slotIndex);
  const submissionId = demoId("a8", target.slot, slotIndex);
  const receiptId = demoId("b1", target.slot, slotIndex);

  await transaction
    .insert(buyingRounds)
    .values({
      closesAt,
      createdByUserId: adminUserId,
      deliveryEndsAt,
      deliveryStartsAt,
      id: roundId,
      name: blueprint.name,
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
        name: sql`excluded.name`,
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

  await transaction
    .insert(demandItems)
    .values(
      blueprint.items.map((item, index) => ({
        estimatedUnitPrice: "9.18",
        id: demoId("a9", target.slot, slotIndex * 10 + index),
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
        quantity: sql`excluded.quantity`,
        requestedDeliveryDate: deliveryDate,
        updatedAt: now,
      },
    });

  if (blueprint.receipt) {
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
        blueprint.items.map((item, index) => ({
          demandItemId: demoId("a9", target.slot, slotIndex * 10 + index),
          id: demoId("b2", target.slot, slotIndex * 10 + index),
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
  }

  await transaction
    .insert(roundAwards)
    .values({
      buyingRoundId: roundId,
      createdByUserId: adminUserId,
      id: demoId("b3", target.slot, slotIndex),
      note: `Zuschlag nach Gruppenmenge ${blueprint.unitPriceCents === 842 ? "812" : "648"} kg.`,
      organizationId: target.organizationId,
      regionalKey,
      supplierName: "Anadolu Fleischhandel",
      unitPriceCents: blueprint.unitPriceCents,
    })
    .onConflictDoUpdate({
      target: roundAwards.id,
      set: {
        note: sql`excluded.note`,
        regionalKey,
        unitPriceCents: sql`excluded.unit_price_cents`,
        updatedAt: now,
      },
    });
}

// Auch die laufende Runde bekommt einen Zuschlag, damit die Bedarfsplanung
// das Lieferantenabzeichen zeigt.
async function seedOpenRoundAward(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
  now: Date,
  adminUserId: string,
): Promise<void> {
  if (!target.openRoundId) return;

  await transaction
    .insert(roundAwards)
    .values({
      buyingRoundId: target.openRoundId,
      createdByUserId: adminUserId,
      id: demoId("b3", target.slot, 9),
      note: "Vorläufiger Zuschlag, Menge wird bis Bestellschluss bestätigt.",
      organizationId: target.organizationId,
      regionalKey: target.openRoundRegionalKey ?? "nrw-west",
      supplierName: "Anadolu Fleischhandel",
      unitPriceCents: 905,
    })
    .onConflictDoUpdate({
      target: roundAwards.id,
      set: { unitPriceCents: 905, updatedAt: now },
    });
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

// Notizen am Gast sind im Alltag die halbe Miete: Allergien, Lieferhinweise,
// Sammelbestellungen. Vorher trug genau ein Gast eine Notiz.
const guestNotes: Array<string | null> = [
  "Immer ohne Zwiebeln",
  null,
  "Ruft vorher an, holt selbst ab",
  null,
  "Scharf – extra Soße dazu",
  null,
  "Klingelt nicht, bitte anrufen",
  "Sammelbestellung für 6 Personen, Rechnung monatlich",
  null,
  "Erdnussallergie – Küche informieren",
  null,
  "Lieferung nur bis 18:00 Uhr möglich",
];

// Bestellungen sind nicht immer sauber abgeschlossen: eine offene und eine
// stornierte Bestellung je Betrieb machen die Statusspalte erst sichtbar.
function orderStatusFor(
  guestIndex: number,
  orderIndex: number,
): "NEU" | "ABGESCHLOSSEN" | "STORNIERT" {
  if (guestIndex === 3 && orderIndex === 0) return "NEU";
  if (guestIndex === 6 && orderIndex === 1) return "STORNIERT";
  return "ABGESCHLOSSEN";
}

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
        note: guestNotes[guestIndex % guestNotes.length] ?? null,
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
          note:
            orderIndex === 0 && guestIndex === 2
              ? "ohne Zwiebeln"
              : orderIndex === 1 && guestIndex === 7
                ? "Sammelbestellung, bitte getrennt einpacken"
                : null,
          organizationId: target.organizationId,
          placedAt,
          source,
          status: orderStatusFor(guestIndex, orderIndex),
          totalCents: item.priceCents * quantity,
        })
        .onConflictDoUpdate({
          target: guestOrders.id,
          set: {
            note: sql`excluded.note`,
            placedAt,
            status: sql`excluded.status`,
            updatedAt: now,
          },
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

  const imports = [
    {
      createdCount: 9,
      fileName: "lieferando-export-august.csv",
      importedAt: atDaysAgo(now, 3, 11),
      index: 1,
      platform: "Lieferando",
      rowCount: 11,
      skippedCount: 2,
    },
    {
      createdCount: 14,
      fileName: "lieferando-export-juli.csv",
      importedAt: atDaysAgo(now, 31, 10),
      index: 2,
      platform: "Lieferando",
      rowCount: 14,
      skippedCount: 0,
    },
    {
      createdCount: 5,
      fileName: "wolt-bestellungen-kw33.csv",
      importedAt: atDaysAgo(now, 13, 16),
      index: 3,
      platform: "Wolt",
      rowCount: 8,
      skippedCount: 3,
    },
  ];

  for (const entry of imports) {
    await transaction
      .insert(platformImports)
      .values({
        createdCount: entry.createdCount,
        fileName: entry.fileName,
        id: demoId("c1", target.slot, entry.index),
        importedAt: entry.importedAt,
        importedByUserId,
        organizationId: target.organizationId,
        platform: entry.platform,
        rowCount: entry.rowCount,
        skippedCount: entry.skippedCount,
      })
      .onConflictDoUpdate({
        target: platformImports.id,
        set: {
          createdCount: sql`excluded.created_count`,
          fileName: sql`excluded.file_name`,
          importedAt: entry.importedAt,
          platform: sql`excluded.platform`,
          rowCount: sql`excluded.row_count`,
          skippedCount: sql`excluded.skipped_count`,
        },
      });
  }
}

// Frueher schrieb dieser Seed nur eine abgeschlossene Runde und leitete die
// Positionskennungen direkt aus dem Listenindex ab. Mit der zweiten Runde
// haben sich diese Kennungen verschoben. Ohne Aufraeumen blieben die alten
// Zeilen liegen: der Wareneingang zeigte jede Position doppelt, und der
// Zuschlag der laufenden Runde kollidierte mit round_awards_org_round_unique.
async function removeSupersededDemoRows(
  transaction: SeedTransaction,
  target: DemoOperationsTarget,
): Promise<void> {
  const legacyItemIds = [demoId("a9", target.slot, 0), demoId("a9", target.slot, 1)];
  const legacyReceiptItemIds = [
    demoId("b2", target.slot, 0),
    demoId("b2", target.slot, 1),
  ];

  await transaction
    .delete(goodsReceiptItems)
    .where(inArray(goodsReceiptItems.id, legacyReceiptItemIds));
  await transaction
    .delete(demandItems)
    .where(inArray(demandItems.id, legacyItemIds));

  // Der Zuschlag mit dieser Kennung gehoerte frueher zur laufenden Runde und
  // gehoert jetzt zur zweiten abgeschlossenen. Nur den alten Stand loeschen.
  await transaction
    .delete(roundAwards)
    .where(
      and(
        eq(roundAwards.id, demoId("b3", target.slot, 2)),
        ne(roundAwards.buyingRoundId, demoId("a7", target.slot, 2)),
      ),
    );
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
    await removeSupersededDemoRows(transaction, target);
    await seedSales(transaction, target, now, staffUserId);
    await seedHygiene(transaction, target, now);
    await seedShifts(transaction, target, now);
    await seedInvoices(transaction, target, now, target.ownerUserId);
    await seedCalculations(transaction, target, now, target.ownerUserId);
    for (const blueprint of closedRoundBlueprints) {
      await seedClosedRound(transaction, target, now, input.adminUserId, blueprint);
    }
    await seedOpenRoundAward(transaction, target, now, input.adminUserId);
    await seedTemplate(transaction, target, now);
    await seedGuests(transaction, target, now, target.ownerUserId);
  }
}
