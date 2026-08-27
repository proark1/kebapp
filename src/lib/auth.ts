import "server-only";

import { getRuntimeEnv } from "@/lib/env";
import { createKebappAuth } from "@/server/auth/create-auth";
import { database } from "@/server/db/client";
import { createMailer } from "@/server/email/mailer";

const runtimeEnv = getRuntimeEnv();
const runtimeMailer = runtimeEnv.DEMO_MODE
  ? null
  : createMailer({
      from: runtimeEnv.SMTP_FROM!,
      host: runtimeEnv.SMTP_HOST!,
      port: runtimeEnv.SMTP_PORT!,
      requireTls: runtimeEnv.SMTP_REQUIRE_TLS,
    });

export const auth = createKebappAuth({
  baseURL: runtimeEnv.BETTER_AUTH_URL,
  database,
  demoMode: runtimeEnv.DEMO_MODE,
  secret: runtimeEnv.BETTER_AUTH_SECRET,
  sendEmail:
    runtimeMailer?.send ??
    (async () => {
      throw new Error("E-Mail-Versand ist im öffentlichen Demo-Modus deaktiviert.");
    }),
});
