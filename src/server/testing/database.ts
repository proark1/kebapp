import path from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadDbEnv } from "../../../scripts/db-env";
import * as schema from "@/server/db/schema";

export type TestDatabaseHarness = {
  close: () => Promise<void>;
  ownerDatabase: NodePgDatabase<typeof schema>;
  ownerPool: Pool;
  resetAndMigrate: () => Promise<void>;
  runtimeDatabase: NodePgDatabase<typeof schema>;
  runtimePool: Pool;
};

export function requireTestDatabaseUrl(connectionString: string): string {
  const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "Destruktive Datenbanktests sind nur auf einer Datenbank mit _test erlaubt.",
    );
  }

  return databaseName;
}

export function createTestDatabaseHarness(): TestDatabaseHarness {
  const env = loadDbEnv();
  const expectedOwnerDatabase = requireTestDatabaseUrl(
    env.TEST_DATABASE_OWNER_URL,
  );
  const expectedRuntimeDatabase = requireTestDatabaseUrl(env.TEST_DATABASE_URL);

  if (expectedOwnerDatabase !== expectedRuntimeDatabase) {
    throw new Error("Owner- und Runtime-Verbindung müssen dieselbe Testdatenbank nutzen.");
  }

  const ownerPool = new Pool({ connectionString: env.TEST_DATABASE_OWNER_URL });
  const runtimePool = new Pool({
    connectionString: env.TEST_DATABASE_URL,
    max: 1,
  });
  const ownerDatabase = drizzle(ownerPool, { schema });
  const runtimeDatabase = drizzle(runtimePool, { schema });

  return {
    ownerDatabase,
    ownerPool,
    runtimeDatabase,
    runtimePool,
    async resetAndMigrate() {
      const currentDatabase = await ownerPool.query<{
        current_database: string;
      }>("select current_database()");

      if (currentDatabase.rows[0]?.current_database !== expectedOwnerDatabase) {
        throw new Error("Die verbundene Datenbank ist nicht die erwartete Testdatenbank.");
      }

      await ownerPool.query(`
        drop schema if exists kebapp_private cascade;
        drop schema if exists drizzle cascade;
        drop schema if exists public cascade;
        create schema public authorization current_user;
      `);

      await migrate(ownerDatabase, {
        migrationsFolder: path.resolve(process.cwd(), "drizzle"),
      });
    },
    async close() {
      await Promise.all([ownerPool.end(), runtimePool.end()]);
    },
  };
}
