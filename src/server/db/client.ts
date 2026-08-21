import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getRuntimeEnv } from "@/lib/env";
import * as schema from "@/server/db/schema";

const globalForDatabase = globalThis as typeof globalThis & {
  kebappDatabasePool?: Pool;
};

function createPool(): Pool {
  return new Pool({
    connectionString: getRuntimeEnv().DATABASE_URL,
    max: 10,
  });
}

export const databasePool =
  globalForDatabase.kebappDatabasePool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.kebappDatabasePool = databasePool;
}

export const database = drizzle(databasePool, { schema });
