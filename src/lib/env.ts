import "server-only";

import { z } from "zod";

const postgresUrl = z
  .url()
  .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
    message: "Es wird eine PostgreSQL-Verbindung benötigt.",
  });

const runtimeEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_FROM: z.string().min(3),
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
