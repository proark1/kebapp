import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// Stage C/Kalkulation Patches. Ausfuehren: node scripts/patch-stage-c.mjs

let failures = 0;

function patch(file, pairs) {
  let text = readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      failures += 1;
      console.error(`!! Anker fehlt in ${file}: ${JSON.stringify(from.slice(0, 90))}`);
      continue;
    }
    text = text.split(from).join(to);
  }
  writeFileSync(file, text, "utf8");
  console.log("gepatcht:", file);
}

const page = "src/app/app/buchhaltung/page.tsx";

patch(page, [
  [
    `            <input maxLength={80} name="invoiceNumber" placeholder="2026-08-114" required />
          </label>`,
    `            <input maxLength={80} name="invoiceNumber" placeholder="2026-08-114" required />
          </label>
          <label className="field">
            <span>Kategorie</span>
            <select defaultValue="FLEISCH" name="category">
              {["FLEISCH","GEMUESE","TROCKEN","GETRAENKE","VERPACKUNG","SONSTIGES"].map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>`,
  ],
  [
    `        netCents19: Math.round((net19 || 0) * 100),`,
    `        category: value("category") || "SONSTIGES",
        netCents19: Math.round((net19 || 0) * 100),`,
  ],
  [
    `                  <th>Datum</th>
                  <th>Brutto</th>`,
    `                  <th>Datum</th>
                  <th>Kategorie</th>
                  <th>Brutto</th>`,
  ],
  [
    `                    <td data-label="Datum">{dayFormatter.format(new Date(\`\${invoice.documentDate}T12:00:00Z\`))}</td>`,
    `                    <td data-label="Datum">{dayFormatter.format(new Date(\`\${invoice.documentDate}T12:00:00Z\`))}</td>
                    <td data-label="Kategorie">{invoice.category}</td>`,
  ],
]);

// Auswertung je Kategorie: an die Vorsteuer-Zeile anhängen
patch(page, [
  [
    `(vatByRate.rate19 / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
    `(vatByRate.rate19 / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              {" · Netto je Kategorie: "}
              {invoices
                .reduce((acc, invoice) => {
                  acc[invoice.category] =
                    (acc[invoice.category] ?? 0) +
                    invoice.netCents7 +
                    invoice.netCents19;
                  return acc;
                }, {})
                .entries === undefined
                ? null
                : null}
              {Object.entries(
                invoices.reduce((acc, invoice) => {
                  acc[invoice.category] =
                    (acc[invoice.category] ?? 0) +
                    invoice.netCents7 +
                    invoice.netCents19;
                  return acc;
                }, {}),
              )
                .map(([catKey, cents]) =>
                  \`\${catKey} \${(cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}\`,
                )
                .join(", ")}`,
  ],
]);

patch("src/app/api/app/buchhaltung/export/route.ts", [
  [
    `"Betrag_EUR_brutto", "USt_Schluessel"`,
    `"Betrag_EUR_brutto", "Kategorie", "USt_Schluessel"`,
  ],
  [
    `          csvEscape(invoice.supplierName),
          (gross / 100).toFixed(2).replace(".", ","),
          vatKey,`,
    `          csvEscape(invoice.supplierName),
          (gross / 100).toFixed(2).replace(".", ","),
          csvEscape(invoice.category ?? ""),
          vatKey,`,
  ],
]);

patch("src/components/app-shell.tsx", [
  [
    `import {
  ChevronsUpDown,
  Clock3,`,
    `import {
  Calculator,
  ChevronsUpDown,
  Clock3,`,
  ],
  [
    `  { href: "/app/umsatz", label: "Umsätze", icon: TrendingUp, tabbar: false },`,
    `  { href: "/app/kalkulation", label: "Kalkulation", icon: Calculator, tabbar: false },
  { href: "/app/umsatz", label: "Umsätze", icon: TrendingUp, tabbar: false },`,
  ],
]);

if (failures > 0) {
  console.error(`${failures} Anker fehlgeschlagen.`);
  process.exit(1);
}
console.log("Patch Stage C abgeschlossen.");
