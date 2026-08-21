import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

const postgresUrl = z
  .url()
  .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
    message: "Es wird eine PostgreSQL-Verbindung benötigt.",
  });

const dbEnvSchema = z
  .object({
    POSTGRES_DB: z.string().min(1),
    POSTGRES_TEST_DB: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().min(1).max(65_535),
    POSTGRES_OWNER_USER: z.string().min(1),
    POSTGRES_OWNER_PASSWORD: z.string().min(12),
    POSTGRES_APP_USER: z.string().min(1),
    POSTGRES_APP_PASSWORD: z.string().min(12),
    DATABASE_URL: postgresUrl,
    DATABASE_OWNER_URL: postgresUrl,
    TEST_DATABASE_URL: postgresUrl,
    TEST_DATABASE_OWNER_URL: postgresUrl,
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(12),
  })
  .superRefine((value, context) => {
    if (value.POSTGRES_OWNER_USER === value.POSTGRES_APP_USER) {
      context.addIssue({
        code: "custom",
        path: ["POSTGRES_APP_USER"],
        message: "Besitzer- und Laufzeitrolle müssen getrennt sein.",
      });
    }

    if (!value.POSTGRES_TEST_DB.endsWith("_test")) {
      context.addIssue({
        code: "custom",
        path: ["POSTGRES_TEST_DB"],
        message: "Die Testdatenbank muss auf _test enden.",
      });
    }

    const connections = [
      {
        field: "DATABASE_URL",
        url: value.DATABASE_URL,
        user: value.POSTGRES_APP_USER,
        database: value.POSTGRES_DB,
      },
      {
        field: "DATABASE_OWNER_URL",
        url: value.DATABASE_OWNER_URL,
        user: value.POSTGRES_OWNER_USER,
        database: value.POSTGRES_DB,
      },
      {
        field: "TEST_DATABASE_URL",
        url: value.TEST_DATABASE_URL,
        user: value.POSTGRES_APP_USER,
        database: value.POSTGRES_TEST_DB,
      },
      {
        field: "TEST_DATABASE_OWNER_URL",
        url: value.TEST_DATABASE_OWNER_URL,
        user: value.POSTGRES_OWNER_USER,
        database: value.POSTGRES_TEST_DB,
      },
    ] as const;

    for (const connection of connections) {
      const parsed = new URL(connection.url);
      const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

      if (decodeURIComponent(parsed.username) !== connection.user) {
        context.addIssue({
          code: "custom",
          path: [connection.field],
          message: "Die Verbindung muss die Rolle " + connection.user + " verwenden.",
        });
      }

      if (database !== connection.database) {
        context.addIssue({
          code: "custom",
          path: [connection.field],
          message: "Die Verbindung muss auf " + connection.database + " zeigen.",
        });
      }
    }
  });

export type DbEnv = z.infer<typeof dbEnvSchema>;

export function parseDbEnv(
  input: Record<string, string | undefined>,
): DbEnv {
  return dbEnvSchema.parse(input);
}

export function loadDbEnv(
  filePath = path.resolve(process.cwd(), ".env.db.local"),
): DbEnv {
  const result = loadDotEnv({ path: filePath, quiet: true });

  if (result.error) {
    throw new Error(
      "Datenbank-Umgebung konnte nicht geladen werden: " + filePath,
      { cause: result.error },
    );
  }

  return parseDbEnv(process.env);
}
