import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import type { KebappDatabase } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import {
  passwordResetEmail,
  verificationEmail,
  type AuthEmail,
} from "@/server/email/templates";

export type CreateKebappAuthOptions = {
  baseURL: string;
  database: KebappDatabase;
  secret: string;
  sendEmail: (message: AuthEmail) => Promise<void>;
};

function dispatchEmail(
  sendEmail: CreateKebappAuthOptions["sendEmail"],
  message: AuthEmail,
): void {
  void sendEmail(message).catch(() => {
    console.error(
      "Kebapp konnte eine Authentifizierungs-E-Mail nicht zustellen.",
    );
  });
}

export function createKebappAuth(options: CreateKebappAuthOptions) {
  const origin = new URL(options.baseURL).origin;
  const useSecureCookies = new URL(options.baseURL).protocol === "https:";

  return betterAuth({
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies,
      },
      useSecureCookies,
    },
    appName: "Kebapp",
    baseURL: options.baseURL,
    database: drizzleAdapter(options.database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    emailAndPassword: {
      autoSignIn: false,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ url, user }) {
        dispatchEmail(
          options.sendEmail,
          passwordResetEmail({
            name: user.name,
            to: user.email,
            url,
          }),
        );
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendOnSignIn: true,
      sendOnSignUp: true,
      async sendVerificationEmail({ url, user }) {
        dispatchEmail(
          options.sendEmail,
          verificationEmail({
            name: user.name,
            to: user.email,
            url,
          }),
        );
      },
    },
    logger: {
      disabled: true,
    },
    plugins: [nextCookies()],
    rateLimit: {
      customRules: {
        "/request-password-reset": { max: 3, window: 5 * 60 },
        "/reset-password": { max: 5, window: 5 * 60 },
        "/send-verification-email": { max: 3, window: 5 * 60 },
        "/sign-in/email": { max: 5, window: 60 },
        "/sign-up/email": { max: 5, window: 60 },
        "/verify-email": { max: 10, window: 60 },
      },
      enabled: true,
      max: 100,
      modelName: "rateLimit",
      storage: "database",
      window: 60,
    },
    secret: options.secret,
    trustedOrigins: [origin],
  });
}
