import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LOYALTY_TARGET } from "@/lib/guest-identity";
import {
  deleteGuest,
  getGuestDetail,
  getGuestOverview,
  importPlatformOrders,
  listGuests,
  LoyaltyNotReadyError,
  recordManualOrder,
  recordStorefrontOrder,
  redeemLoyalty,
  StorefrontOrderRejectedError,
} from "@/server/guests/service";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  employeeA: "guest-employee-a",
  organizationA: "d0000000-0000-4000-8000-000000000001",
  organizationB: "d0000000-0000-4000-8000-000000000002",
  ownerA: "guest-owner-a",
  ownerB: "guest-owner-b",
} as const;

const actors = {
  employeeA: { userId: ids.employeeA },
  ownerA: { userId: ids.ownerA },
  ownerB: { userId: ids.ownerB },
};

const menu = [
  {
    category: "Döner",
    description: "Drehspieß",
    id: "doener",
    name: "Döner",
    price: "7.50",
  },
  {
    category: "Teller",
    description: "Teller",
    id: "teller",
    name: "Teller",
    price: "13.00",
  },
];

describe.sequential("Gaeste, Stempelkarte und Plattformimport", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values ($1, 'Inhaber A', 'o@guest.test', true),
              ($2, 'Mitarbeiter A', 'e@guest.test', true),
              ($3, 'Inhaber B', 'b@guest.test', true)`,
      [ids.ownerA, ids.employeeA, ids.ownerB],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values ($1, 'guest-a', 'Laden A', 'ACTIVE'),
              ($2, 'guest-b', 'Laden B', 'ACTIVE')`,
      [ids.organizationA, ids.organizationB],
    );
    await harness.ownerPool.query(
      `insert into memberships (user_id, organization_id, role, status, joined_at)
       values ($1, $4, 'OWNER', 'ACTIVE', now()),
              ($2, $4, 'EMPLOYEE', 'ACTIVE', now()),
              ($3, $5, 'OWNER', 'ACTIVE', now())`,
      [
        ids.ownerA,
        ids.employeeA,
        ids.ownerB,
        ids.organizationA,
        ids.organizationB,
      ],
    );
    await harness.ownerPool.query(
      `insert into store_profiles
         (organization_id, public_slug, name, short_name, menu,
          is_published, pickup_enabled, delivery_enabled)
       values ($1, 'laden-a', 'Laden A', 'LA', $2::jsonb, true, true, true)`,
      [ids.organizationA, JSON.stringify(menu)],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("legt einen Gast nur einmal an, egal wie die Nummer geschrieben wird", async () => {
    const first = await recordStorefrontOrder({
      database: harness.runtimeDatabase,
      itemId: "doener",
      mode: "PICKUP",
      name: "Ayse",
      phone: "491761111111",
      quantity: 2,
      slug: "laden-a",
    });
    expect(first.stampCount).toBe(1);

    const second = await recordStorefrontOrder({
      database: harness.runtimeDatabase,
      itemId: "teller",
      mode: "DELIVERY",
      deliveryAddress: "Teststraße 1",
      phone: "491761111111",
      quantity: 1,
      slug: "laden-a",
    });
    expect(second.guestId).toBe(first.guestId);
    expect(second.stampCount).toBe(2);

    const detail = await getGuestDetail({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      guestId: first.guestId,
      organizationId: ids.organizationA,
    });
    // Der Preis stammt aus dem gespeicherten Menue, nicht aus der Anfrage.
    expect(detail.guest.totalCents).toBe(750 * 2 + 1_300);
    expect(detail.guest.name).toBe("Ayse");
    expect(detail.orders).toHaveLength(2);
    expect(detail.orders[0]?.items[0]?.name).toBe("Teller");
  });

  it("weist unbekannte Laeden, Gerichte und Bestellarten ab", async () => {
    await expect(
      recordStorefrontOrder({
        database: harness.runtimeDatabase,
        itemId: "doener",
        mode: "PICKUP",
        phone: "491761111111",
        quantity: 1,
        slug: "gibt-es-nicht",
      }),
    ).rejects.toBeInstanceOf(StorefrontOrderRejectedError);

    await expect(
      recordStorefrontOrder({
        database: harness.runtimeDatabase,
        itemId: "pizza",
        mode: "PICKUP",
        phone: "491761111111",
        quantity: 1,
        slug: "laden-a",
      }),
    ).rejects.toBeInstanceOf(StorefrontOrderRejectedError);

    await expect(
      recordStorefrontOrder({
        database: harness.runtimeDatabase,
        itemId: "doener",
        mode: "DELIVERY",
        phone: "491761111111",
        quantity: 1,
        slug: "laden-a",
      }),
    ).rejects.toBeInstanceOf(StorefrontOrderRejectedError);
  });

  it("loest die Stempelkarte erst bei voller Karte ein und behaelt Reststempel", async () => {
    const phone = "491762222222";
    const first = await recordStorefrontOrder({
      database: harness.runtimeDatabase,
      itemId: "doener",
      mode: "PICKUP",
      phone,
      quantity: 1,
      slug: "laden-a",
    });

    await expect(
      redeemLoyalty({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        guestId: first.guestId,
        organizationId: ids.organizationA,
      }),
    ).rejects.toBeInstanceOf(LoyaltyNotReadyError);

    // Restliche Bestellungen ueber den Tresen, damit die Missbrauchsbremse des
    // oeffentlichen Endpunkts nicht greift.
    for (let index = 1; index < LOYALTY_TARGET + 2; index += 1) {
      await recordManualOrder({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        order: { amountCents: 750, mode: "PICKUP", phone },
        organizationId: ids.organizationA,
      });
    }

    const beforeRedeem = await getGuestDetail({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      guestId: first.guestId,
      organizationId: ids.organizationA,
    });
    expect(beforeRedeem.guest.stampCount).toBe(LOYALTY_TARGET + 2);
    expect(beforeRedeem.guest.redeemable).toBe(true);

    const redeemed = await redeemLoyalty({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      guestId: first.guestId,
      organizationId: ids.organizationA,
    });
    expect(redeemed.remainingStamps).toBe(2);

    const detail = await getGuestDetail({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      guestId: first.guestId,
      organizationId: ids.organizationA,
    });
    expect(detail.guest.stampCount).toBe(2);
    expect(detail.guest.redeemable).toBe(false);
    expect(detail.redemptions[0]?.stampsUsed).toBe(LOYALTY_TARGET);
  });

  it("bremst sehr viele Bestellungen derselben Nummer ueber die Ladenseite", async () => {
    const phone = "491767777777";
    for (let index = 0; index < 10; index += 1) {
      await recordStorefrontOrder({
        database: harness.runtimeDatabase,
        itemId: "doener",
        mode: "PICKUP",
        phone,
        quantity: 1,
        slug: "laden-a",
      });
    }

    await expect(
      recordStorefrontOrder({
        database: harness.runtimeDatabase,
        itemId: "doener",
        mode: "PICKUP",
        phone,
        quantity: 1,
        slug: "laden-a",
      }),
    ).rejects.toMatchObject({ code: "kebapp_rate_limited" });
  });

  it("erfasst Bestellungen im Laden und findet Gaeste ueber die Suche", async () => {
    await recordManualOrder({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      order: {
        amountCents: 2_400,
        mode: "PICKUP",
        name: "Murat",
        phone: "0176 3333333",
      },
      organizationId: ids.organizationA,
    });

    const byName = await listGuests({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
      search: "Murat",
    });
    expect(byName).toHaveLength(1);
    expect(byName[0]?.phone).toBe("491763333333");
    expect(byName[0]?.phoneLabel).toBe("+49 176 3333333");

    const byNumber = await listGuests({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
      search: "0176 3333",
    });
    expect(byNumber).toHaveLength(1);
  });

  it("importiert Plattformbestellungen und ueberspringt Dubletten", async () => {
    const csv = [
      "Bestellnummer;Datum;Telefon;Name;Art;Betrag;Artikel",
      "LF-1;20.08.2026 18:30;0176 4444444;Kevin;Lieferung;18,00;2x Döner",
      "LF-2;21.08.2026 19:00;0176 4444444;Kevin;Abholung;7,50;1x Döner",
      "LF-3;21.08.2026 19:30;keine-nummer;;Abholung;7,50;",
    ].join("\n");

    const first = await importPlatformOrders({
      actor: actors.ownerA,
      content: csv,
      database: harness.runtimeDatabase,
      fileName: "lieferando.csv",
      organizationId: ids.organizationA,
      platform: "Lieferando",
    });
    expect(first.createdCount).toBe(2);
    expect(first.skippedCount).toBe(1);

    const second = await importPlatformOrders({
      actor: actors.ownerA,
      content: csv,
      database: harness.runtimeDatabase,
      fileName: "lieferando.csv",
      organizationId: ids.organizationA,
      platform: "Lieferando",
    });
    expect(second.createdCount).toBe(0);
    expect(second.skippedCount).toBe(3);
  });

  it("zeigt einem anderen Betrieb keine fremden Gaeste", async () => {
    const foreign = await listGuests({
      actor: actors.ownerB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationB,
    });
    expect(foreign).toEqual([]);

    const overviewB = await getGuestOverview({
      actor: actors.ownerB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationB,
    });
    expect(overviewB.guestCount).toBe(0);

    const overviewA = await getGuestOverview({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    expect(overviewA.guestCount).toBeGreaterThan(0);
    expect(overviewA.returningCount).toBeGreaterThan(0);
  });

  it("loescht einen Gast samt Bestellungen auf Anfrage", async () => {
    const created = await recordStorefrontOrder({
      database: harness.runtimeDatabase,
      itemId: "doener",
      mode: "PICKUP",
      phone: "491765555555",
      quantity: 1,
      slug: "laden-a",
    });

    await deleteGuest({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      guestId: created.guestId,
      organizationId: ids.organizationA,
      reason: "Löschanfrage",
    });

    const remaining = await harness.ownerPool.query(
      "select count(*)::int as anzahl from guest_orders where guest_id = $1",
      [created.guestId],
    );
    expect(remaining.rows[0].anzahl).toBe(0);

    const list = await listGuests({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
      search: "491765555555",
    });
    expect(list).toEqual([]);
  });
});
