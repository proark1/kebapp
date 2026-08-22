import path from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { parseProductionEnv } from "./production-env";

export async function migrateProduction(
  input: Record<string, string | undefined>,
): Promise<void> {
  const env = parseProductionEnv(input);
  const pool = new Pool({
    connectionString: env.DATABASE_OWNER_URL,
    max: 1,
  });

  try {
    const connection = await pool.query<{
      current_database: string;
      current_user: string;
    }>("select current_database(), current_user");
    const identity = connection.rows[0];

    if (
      identity?.current_database !== env.POSTGRES_DB ||
      identity.current_user !== env.POSTGRES_OWNER_USER
    ) {
      throw new Error(
        "Die Produktionsmigration ist nicht mit der erwarteten Besitzerverbindung verbunden.",
      );
    }

    await migrate(drizzle(pool), {
      migrationsFolder: path.resolve(process.cwd(), "drizzle"),
    });
  } finally {
    await pool.end();
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  migrateProduction(process.env)
    .then(() => console.info("Produktionsmigrationen sind aktuell."))
    .catch(() => {
      console.error("Produktionsmigrationen konnten nicht ausgeführt werden.");
      process.exitCode = 1;
    });
}
