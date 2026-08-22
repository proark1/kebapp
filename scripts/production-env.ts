import { z } from "zod";

const postgresUrl = z
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    { message: "Es wird eine PostgreSQL-Verbindung benötigt." },
  );

const productionEnvSchema = z
  .object({
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DATABASE_OWNER_URL: postgresUrl,
    DATABASE_URL: postgresUrl,
    DEMO_ADMIN_EMAIL: z.email(),
    DEMO_ADMIN_PASSWORD: z.string().min(16),
    DEMO_EMPLOYEE_EMAIL: z.email(),
    DEMO_EMPLOYEE_PASSWORD: z.string().min(16),
    DEMO_MODE: z.literal("true"),
    DEMO_OWNER_EMAIL: z.email(),
    DEMO_OWNER_PASSWORD: z.string().min(16),
    DEMO_SECOND_OWNER_EMAIL: z.email(),
    DEMO_SECOND_OWNER_PASSWORD: z.string().min(16),
    DEMO_SUPPORT_EMAIL: z.email(),
    DEMO_SUPPORT_PASSWORD: z.string().min(16),
    POSTGRES_APP_PASSWORD: z.string().min(16),
    POSTGRES_APP_USER: z.literal("kebapp_app"),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_OWNER_PASSWORD: z.string().min(16),
    POSTGRES_OWNER_USER: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.POSTGRES_OWNER_USER === value.POSTGRES_APP_USER) {
      context.addIssue({
        code: "custom",
        message: "Besitzer- und Laufzeitrolle müssen getrennt sein.",
        path: ["POSTGRES_APP_USER"],
      });
    }

    for (const connection of [
      {
        field: "DATABASE_URL",
        url: value.DATABASE_URL,
        user: value.POSTGRES_APP_USER,
      },
      {
        field: "DATABASE_OWNER_URL",
        url: value.DATABASE_OWNER_URL,
        user: value.POSTGRES_OWNER_USER,
      },
    ] as const) {
      const parsed = new URL(connection.url);
      const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

      if (decodeURIComponent(parsed.username) !== connection.user) {
        context.addIssue({
          code: "custom",
          message: `Die Verbindung muss die Rolle ${connection.user} verwenden.`,
          path: [connection.field],
        });
      }
      if (database !== value.POSTGRES_DB) {
        context.addIssue({
          code: "custom",
          message: `Die Verbindung muss auf ${value.POSTGRES_DB} zeigen.`,
          path: [connection.field],
        });
      }
    }

    const emails = [
      value.DEMO_ADMIN_EMAIL,
      value.DEMO_EMPLOYEE_EMAIL,
      value.DEMO_OWNER_EMAIL,
      value.DEMO_SECOND_OWNER_EMAIL,
      value.DEMO_SUPPORT_EMAIL,
    ].map((email) => email.toLowerCase());
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: "custom",
        message: "Jedes Demo-Konto benötigt eine eigene E-Mail-Adresse.",
        path: ["DEMO_ADMIN_EMAIL"],
      });
    }
  });

export type ProductionEnv = z.infer<typeof productionEnvSchema>;

export function parseProductionEnv(
  input: Record<string, string | undefined>,
): ProductionEnv {
  return productionEnvSchema.parse(input);
}
