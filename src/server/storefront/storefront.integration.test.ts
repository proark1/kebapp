import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TenantAccessDeniedError } from "@/server/db/tenant-context";
import {
  requestStorefrontDomain,
  updateStorefrontProfile,
  StorefrontPermissionDeniedError,
  StorefrontPublicationError,
} from "@/server/storefront/mutations";
import {
  getPublicStorefrontBySlug,
  getStorefrontEditor,
} from "@/server/storefront/queries";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  employeeA: "storefront-employee-a",
  organizationA: "51000000-0000-4000-8000-000000000001",
  organizationB: "51000000-0000-4000-8000-000000000002",
  organizationPending: "51000000-0000-4000-8000-000000000003",
  organizationRejected: "51000000-0000-4000-8000-000000000004",
  organizationSuspended: "51000000-0000-4000-8000-000000000005",
  ownerA: "storefront-owner-a",
  ownerB: "storefront-owner-b",
} as const;

const actors = {
  employeeA: { userId: ids.employeeA },
  ownerA: { userId: ids.ownerA },
  ownerB: { userId: ids.ownerB },
};

describe.sequential("tenant storefronts", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values
         ($1, 'Inhaber A', 'owner-a@storefront.test', true),
         ($2, 'Mitarbeiter A', 'employee-a@storefront.test', true),
         ($3, 'Inhaber B', 'owner-b@storefront.test', true)`,
      [ids.ownerA, ids.employeeA, ids.ownerB],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values
         ($1, 'laden-a', 'Laden A', 'ACTIVE'),
         ($2, 'laden-b', 'Laden B', 'ACTIVE'),
         ($3, 'laden-pending', 'Laden Pending', 'PENDING'),
         ($4, 'laden-rejected', 'Laden Rejected', 'REJECTED'),
         ($5, 'laden-suspended', 'Laden Suspended', 'SUSPENDED')`,
      [
        ids.organizationA,
        ids.organizationB,
        ids.organizationPending,
        ids.organizationRejected,
        ids.organizationSuspended,
      ],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values
         ($1, $3, 'OWNER', 'ACTIVE', now()),
         ($2, $3, 'EMPLOYEE', 'ACTIVE', now()),
         ($4, $5, 'OWNER', 'ACTIVE', now())`,
      [
        ids.ownerA,
        ids.employeeA,
        ids.organizationA,
        ids.ownerB,
        ids.organizationB,
      ],
    );
    await harness.ownerPool.query(
      `insert into store_profiles (
         organization_id,
         public_slug,
         name,
         short_name,
         eyebrow,
         tagline,
         description,
         phone,
         email,
         street,
         postal_code,
         city,
         accent_color,
         opening_hours,
         menu,
         is_published,
         published_at
       ) values
         ($1, 'laden-a', 'Laden A', 'LA', 'Seit 1998', 'Frisch in Rheydt.',
          'Drehspieß und frische Zutaten.', '02161 111111', 'intern-a@storefront.test',
          'Markt 1', '41061', 'Mönchengladbach', '#f3b83f',
          '[{"days":"Montag–Samstag","hours":"11:00–23:00"}]'::jsonb,
          '[{"id":"menu-a","name":"Döner","description":"Salat und Sauce","price":"7.50","category":"Döner"}]'::jsonb,
          true, now()),
         ($2, 'laden-b', 'Laden B', 'LB', 'Am Markt', 'Frisch für dich.',
          'Täglich geöffnet.', '02161 222222', 'intern-b@storefront.test',
          'Markt 2', '41061', 'Mönchengladbach', '#1f6b4f', '[]'::jsonb, '[]'::jsonb,
          true, now()),
         ($3, 'laden-pending', 'Laden Pending', 'LP', null, null, null, null, null,
          null, null, null, '#f3b83f', '[]'::jsonb, '[]'::jsonb, true, now()),
         ($4, 'laden-rejected', 'Laden Rejected', 'LR', null, null, null, null, null,
          null, null, null, '#f3b83f', '[]'::jsonb, '[]'::jsonb, true, now()),
         ($5, 'laden-suspended', 'Laden Suspended', 'LS', null, null, null, null, null,
          null, null, null, '#f3b83f', '[]'::jsonb, '[]'::jsonb, true, now())`,
      [
        ids.organizationA,
        ids.organizationB,
        ids.organizationPending,
        ids.organizationRejected,
        ids.organizationSuspended,
      ],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("loads the selected owner's editor data only", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    expect(editor.publicSlug).toBe("laden-a");
    expect(editor.isPublished).toBe(true);
    expect(editor.profile.name).toBe("Laden A");
    expect(JSON.stringify(editor)).not.toContain(ids.organizationA);
    expect(JSON.stringify(editor)).not.toContain("intern-a@storefront.test");
  });

  it("lets the owner update the own profile", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    await updateStorefrontProfile({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      isPublished: true,
      organizationId: ids.organizationA,
      profile: { ...editor.profile, name: "Kebap Haus am Markt" },
    });

    const persisted = await harness.ownerPool.query<{ name: string }>(
      "select name from store_profiles where organization_id = $1",
      [ids.organizationA],
    );
    expect(persisted.rows[0]?.name).toBe("Kebap Haus am Markt");
  });

  it("stores storefront media, ordering settings, and a domain review request", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });
    const logoUrl = "data:image/png;base64,iVBORw0KGgo=";
    const heroImageUrl = "data:image/webp;base64,UklGRg==";

    await updateStorefrontProfile({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      isPublished: true,
      organizationId: ids.organizationA,
      profile: {
        ...editor.profile,
        deliveryEnabled: true,
        features: ["HALAL", "HOMEMADE_SAUCES"],
        heroImageUrl,
        logoUrl,
        pickupEnabled: true,
        whatsappPhone: "+49 2161 111111",
      },
    });
    await requestStorefrontDomain({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
      requestedDomain: "Laden-A.DE",
    });

    await expect(
      getStorefrontEditor({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
      }),
    ).resolves.toMatchObject({
      domainRequestStatus: "REVIEW_REQUESTED",
      profile: {
        features: ["HALAL", "HOMEMADE_SAUCES"],
        heroImageUrl,
        logoUrl,
        whatsappPhone: "+49 2161 111111",
      },
      requestedDomain: "laden-a.de",
    });
    await expect(
      getPublicStorefrontBySlug({
        database: harness.runtimeDatabase,
        slug: "laden-a",
      }),
    ).resolves.toMatchObject({
      profile: {
        deliveryEnabled: true,
        features: ["HALAL", "HOMEMADE_SAUCES"],
        heroImageUrl,
        logoUrl,
        pickupEnabled: true,
        whatsappPhone: "+49 2161 111111",
      },
    });
  });

  it("rejects publishing WhatsApp ordering without an available order mode", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    await expect(
      updateStorefrontProfile({
        actor: actors.ownerA,
        database: harness.runtimeDatabase,
        isPublished: true,
        organizationId: ids.organizationA,
        profile: {
          ...editor.profile,
          deliveryEnabled: false,
          pickupEnabled: false,
          whatsappPhone: "+49 2161 111111",
        },
      }),
    ).rejects.toBeInstanceOf(StorefrontPublicationError);
  });

  it("rejects domain review requests from employees", async () => {
    await expect(
      requestStorefrontDomain({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        organizationId: ids.organizationA,
        requestedDomain: "manipuliert.de",
      }),
    ).rejects.toBeInstanceOf(StorefrontPermissionDeniedError);
  });

  it("rejects profile changes by an employee", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    await expect(
      updateStorefrontProfile({
        actor: actors.employeeA,
        database: harness.runtimeDatabase,
        isPublished: true,
        organizationId: ids.organizationA,
        profile: { ...editor.profile, name: "Manipuliert" },
      }),
    ).rejects.toBeInstanceOf(StorefrontPermissionDeniedError);
  });

  it("rejects a foreign organization even with a valid owner account", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationB,
    });

    await expect(
      updateStorefrontProfile({
        actor: actors.ownerB,
        database: harness.runtimeDatabase,
        isPublished: false,
        organizationId: ids.organizationA,
        profile: editor.profile,
      }),
    ).rejects.toBeInstanceOf(TenantAccessDeniedError);
  });

  it("returns an explicit public DTO for an active published store", async () => {
    const storefront = await getPublicStorefrontBySlug({
      database: harness.runtimeDatabase,
      slug: "LADEN-A",
    });

    expect(storefront?.profile.name).toBe("Kebap Haus am Markt");
    expect(storefront?.publicSlug).toBe("laden-a");
    expect(JSON.stringify(storefront)).not.toContain(ids.organizationA);
    expect(JSON.stringify(storefront)).not.toContain("intern-a@storefront.test");
  });

  it("hides incomplete, non-active, and unknown published stores", async () => {
    for (const slug of [
      "laden-b",
      "laden-pending",
      "laden-rejected",
      "laden-suspended",
      "gibt-es-nicht",
    ]) {
      await expect(
        getPublicStorefrontBySlug({
          database: harness.runtimeDatabase,
          slug,
        }),
      ).resolves.toBeNull();
    }
  });

  it("takes the public route offline and publishes it again", async () => {
    const editor = await getStorefrontEditor({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationA,
    });

    await updateStorefrontProfile({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      isPublished: false,
      organizationId: ids.organizationA,
      profile: editor.profile,
    });
    await expect(
      getPublicStorefrontBySlug({
        database: harness.runtimeDatabase,
        slug: editor.publicSlug,
      }),
    ).resolves.toBeNull();

    await updateStorefrontProfile({
      actor: actors.ownerA,
      database: harness.runtimeDatabase,
      isPublished: true,
      organizationId: ids.organizationA,
      profile: editor.profile,
    });
    await expect(
      getPublicStorefrontBySlug({
        database: harness.runtimeDatabase,
        slug: editor.publicSlug,
      }),
    ).resolves.toMatchObject({ publicSlug: "laden-a" });
  });

  it("creates a safe draft template for an active store without a profile", async () => {
    await harness.ownerPool.query(
      "delete from store_profiles where organization_id = $1",
      [ids.organizationB],
    );

    const editor = await getStorefrontEditor({
      actor: actors.ownerB,
      database: harness.runtimeDatabase,
      organizationId: ids.organizationB,
    });
    expect(editor).toMatchObject({
      isPublished: false,
      profile: { name: "Laden B" },
      publicSlug: "laden-b",
    });

    await updateStorefrontProfile({
      actor: actors.ownerB,
      database: harness.runtimeDatabase,
      isPublished: false,
      organizationId: ids.organizationB,
      profile: editor.profile,
    });
    const persisted = await harness.ownerPool.query<{ public_slug: string }>(
      "select public_slug from store_profiles where organization_id = $1",
      [ids.organizationB],
    );
    expect(persisted.rows).toEqual([{ public_slug: "laden-b" }]);
  });
});
