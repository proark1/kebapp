import "server-only";

import { z } from "zod";

const postgresUrl = z
  .url()
  .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
    message: "Es wird eine PostgreSQL-Verbindung benötigt.",
  });

const runtimeEnvSchema = z
  .object({
    ALLOW_PUBLIC_DEMO: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DEMO_ADMIN_EMAIL: z.email().optional(),
    DEMO_ADMIN_PASSWORD: z.string().min(12).optional(),
    DEMO_EMPLOYEE_EMAIL: z.email().optional(),
    DEMO_EMPLOYEE_PASSWORD: z.string().min(12).optional(),
    DEMO_OWNER_EMAIL: z.email().optional(),
    DEMO_OWNER_PASSWORD: z.string().min(12).optional(),
    DEMO_SECOND_OWNER_EMAIL: z.email().optional(),
    DEMO_SECOND_OWNER_PASSWORD: z.string().min(12).optional(),
    DEMO_SUPPORT_EMAIL: z.email().optional(),
    DEMO_SUPPORT_PASSWORD: z.string().min(12).optional(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_FROM: z.string().min(3).optional(),
    // Ohne Angabe gilt: in der Produktionsumgebung STARTTLS erzwingen, sonst
    // nicht. Nur setzen, wenn der Relay bewusst ohne TLS spricht - lokal und
    // in der Abnahme ist das Mailpit, das kein STARTTLS kann.
    SMTP_REQUIRE_TLS: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
  })
  .superRefine((value, context) => {
    if (
      value.DEMO_MODE &&
      process.env.NODE_ENV === "production" &&
      !value.ALLOW_PUBLIC_DEMO
    ) {
      context.addIssue({
        code: "custom",
        message:
          "DEMO_MODE=true ist in der Produktionsumgebung gesperrt. Für eine bewusst öffentliche Demo zusätzlich ALLOW_PUBLIC_DEMO=true setzen.",
        path: ["ALLOW_PUBLIC_DEMO"],
      });
    }

    if (value.DEMO_MODE) return;

    for (const field of ["SMTP_HOST", "SMTP_PORT", "SMTP_FROM"] as const) {
      if (value[field] === undefined) {
        context.addIssue({
          code: "custom",
          message: "Außerhalb des Demo-Modus ist SMTP erforderlich.",
          path: [field],
        });
      }
    }
  });

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function parseRuntimeEnv(
  input: Record<string, string | undefined>,
): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}

let cachedRuntimeEnv: RuntimeEnv | undefined;

export function getRuntimeEnv(): RuntimeEnv {
  cachedRuntimeEnv ??= parseRuntimeEnv(process.env);
  return cachedRuntimeEnv;
}
