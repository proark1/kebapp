import "server-only";

import { z } from "zod";

const postgresUrl = z
  .url()
  .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
    message: "Es wird eine PostgreSQL-Verbindung benötigt.",
  });

const runtimeEnvSchema = z
  .object({
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    DEMO_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_FROM: z.string().min(3).optional(),
  })
  .superRefine((value, context) => {
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
