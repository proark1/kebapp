import { execFileSync } from "node:child_process";

// Bringt die Erwartungs-Arrays im Schema-Integrationstest auf den aktuellen
// Migrationsstand (Tabellen + Foreign Keys), indem sie aus der Test-DB
// ausgelesen werden. Einmalig nach neuen Migrationen ausfuehren:
//   node scripts/sync-schema-expectations.mjs

// Ueberschreibbar, damit der Abgleich auch aus einem Worktree gegen eine
// eigene Pruefdatenbank laufen kann.
const container = process.env.KEBAPP_PG_CONTAINER ?? "kebapp-local-postgres-1";
const database = "kebapp_test";

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "kebapp_owner", "-d", database, "-tA"],
    { input: sql, encoding: "utf8" },
  );
}

const tables = psql(
  `select string_agg(table_name, E'\\n' order by table_name)
   from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE';`,
)
  .trim()
  .split("\n")
  .filter(Boolean);

const fks = psql(
  `select string_agg(st.relname||'.'||sa.attname||'->'||tt.relname||'.'||ta.attname, E'\\n' order by 1)
   from pg_constraint c
   join pg_class st on st.oid=c.conrelid
   join pg_class tt on tt.oid=c.confrelid
   join lateral unnest(c.conkey,c.confkey) as k(sn,tn) on true
   join pg_attribute sa on sa.attrelid=st.oid and sa.attnum=k.sn
   join pg_attribute ta on ta.attrelid=tt.oid and ta.attnum=k.tn
   where c.contype='f' and st.relnamespace='public'::regnamespace;`,
)
  .trim()
  .split("\n")
  .filter(Boolean);

const file = new URL("../src/server/db/schema/schema.integration.test.ts", import.meta.url);
let text = await (await import("node:fs/promises")).readFile(file, "utf8");

const tablesBlock =
  "const expectedTables = [\n" +
  tables.map((name) => `  "${name}",`).join("\n") +
  "\n] as const;";
text = text.replace(
  /const expectedTables = \[[\s\S]*?\] as const;/,
  tablesBlock,
);

const fksBlock =
  "const expectedForeignKeys = [\n" +
  fks.map((name) => `  "${name}",`).join("\n") +
  "\n] as const;";
text = text.replace(
  /const expectedForeignKeys = \[[\s\S]*?\] as const;/,
  fksBlock,
);

await (await import("node:fs/promises")).writeFile(file, text, "utf8");
console.log(
  `sync-schema-expectations: ${tables.length} Tabellen, ${fks.length} Foreign Keys uebernommen.`,
);
