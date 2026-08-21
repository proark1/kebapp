import "server-only";

import { getRuntimeEnv } from "@/lib/env";
import { createKebappAuth } from "@/server/auth/create-auth";
import { database } from "@/server/db/client";
import { createMailer } from "@/server/email/mailer";

const runtimeEnv = getRuntimeEnv();
const runtimeMailer = createMailer({
  from: runtimeEnv.SMTP_FROM,
  host: runtimeEnv.SMTP_HOST,
  port: runtimeEnv.SMTP_PORT,
});

export const auth = createKebappAuth({
  baseURL: runtimeEnv.BETTER_AUTH_URL,
  database,
  secret: runtimeEnv.BETTER_AUTH_SECRET,
  sendEmail: runtimeMailer.send,
});
