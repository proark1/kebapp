import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EInvoiceParseError,
  importEInvoice,
  parseXRechnung,
} from "@/server/accounting/einvoice";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const ids = {
  employeeA: "einv-employee-a",
  organizationA: "d0000000-0000-4000-8000-000000000001",
  ownerA: "einv-owner-a",
} as const;

const actors = { employeeA: { userId: ids.employeeA }, ownerA: { userId: ids.ownerA } };

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">RE-2026-0815</cbc:ID>
  <cbc:IssueDate xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">2026-08-20</cbc:IssueDate>
  <cac:AccountingSupplierParty xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cac:Party><cac:PartyName>
      <cbc:Name xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">Fleischwerk Rheinland GmbH</cbc:Name>
    </cac:PartyName></cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
    <cac:TaxSubtotal>
      <cbc:TaxableAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" currencyID="EUR">100.00</cbc:TaxableAmount>
      <cac:TaxCategory><cbc:Percent xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">7.00</cbc:Percent></cac:TaxCategory>
    </cac:TaxSubtotal>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" currencyID="EUR">200.00</cbc:TaxableAmount>
      <cac:TaxCategory><cbc:Percent xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">19.00</cbc:Percent></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
</Invoice>`;

describe("xrechnung import", () => {
  let harness: TestDatabaseHarness;

  beforeAll(async () => {
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    await harness.ownerPool.query(
      `insert into "user" (id, name, email, email_verified)
       values ($1, 'Inhaber A', 'o@einv.test', true), ($2, 'Mitarbeiter A', 'e@einv.test', true)`,
      [ids.ownerA, ids.employeeA],
    );
    await harness.ownerPool.query(
      `insert into organizations (id, slug, store_name, status)
       values ($1, 'einv-a', 'Laden A', 'ACTIVE')`,
      [ids.organizationA],
    );
    await harness.ownerPool.query(
      `insert into memberships
         (user_id, organization_id, role, status, joined_at)
       values ($1, $3, 'OWNER', 'ACTIVE', now()), ($2, $3, 'EMPLOYEE', 'ACTIVE', now())`,
      [ids.ownerA, ids.employeeA, ids.organizationA],
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  it("parses invoice number, date, supplier and vat buckets", () => {
    const parsed = parseXRechnung(sampleXml);
    expect(parsed).toEqual({
      documentDate: "2026-08-20",
      invoiceNumber: "RE-2026-0815",
      netCents7: 10_000,
      netCents19: 20_000,
      supplierName: "Fleischwerk Rheinland GmbH",
    });
  });

  it("rejects non-xrechnung input with a clear message", () => {
    expect(() => parseXRechnung("<pdf>ZUGFeRD</pdf>")).toThrow(/Keine XRechnung/);
    expect(() => parseXRechnung(sampleXml.replace(/<cbc:ID[\s\S]*?<\/cbc:ID>/, "")))
      .toThrow(/Rechnungsnummer/);
  });

  it("imports an e-invoice into incoming invoices with audit trail", async () => {
    const result = await importEInvoice({
      actor: actors.employeeA,
      database: harness.runtimeDatabase,
      fileName: "re-2026-0815.xml",
      organizationId: ids.organizationA,
      xmlText: sampleXml,
    });
    expect(result).toEqual({
      invoiceNumber: "RE-2026-0815",
      supplierName: "Fleischwerk Rheinland GmbH",
    });

    const persisted = await harness.ownerPool.query<{
      e_invoice_xml: string;
      net_cents_7: number;
      net_cents_19: number;
      source_file_name: string;
    }>(
      `select e_invoice_xml, net_cents_7, net_cents_19, source_file_name
       from incoming_invoices where invoice_number = 'RE-2026-0815'`,
    );
    expect(persisted.rows[0]).toMatchObject({
      net_cents_7: 10_000,
      net_cents_19: 20_000,
      source_file_name: "re-2026-0815.xml",
    });
    expect(persisted.rows[0]?.e_invoice_xml).toContain("<Invoice");

    const audit = await harness.ownerPool.query<{ count: string }>(
      `select count(*)::text as count from audit_events where action = 'E_INVOICE_IMPORTED'`,
    );
    expect(Number(audit.rows[0]?.count)).toBe(1);
  });
});
