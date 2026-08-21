import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadDbEnv } from "../../../scripts/db-env";
import { createKebappAuth } from "@/server/auth/create-auth";
import { createMailer } from "@/server/email/mailer";
import {
  createTestDatabaseHarness,
  type TestDatabaseHarness,
} from "@/server/testing/database";

const baseURL = "http://localhost:3000";
const testSecret =
  "kebapp-auth-integration-secret-with-more-than-32-characters";

type AuthInstance = ReturnType<typeof createKebappAuth>;

type MailpitMessage = {
  ID: string;
  Subject: string;
};

type MailpitSearchResult = {
  messages: MailpitMessage[];
};

type AuthRequestOptions = {
  body?: Record<string, unknown>;
  cookie?: string;
  ip?: string;
  method?: "GET" | "POST";
};

function uniqueEmail(): string {
  return `auth-${randomUUID()}@example.com`;
}

function sessionCookie(response: Response): string | null {
  const setCookie = response.headers.get("set-cookie");
  return (
    setCookie?.match(/(?:^|,\s*)([^=;,]*session_token=[^;,]+)/)?.[1] ?? null
  );
}

async function waitForMail(
  mailpitURL: string,
  recipient: string,
  subject: string,
): Promise<string> {
  const query = encodeURIComponent(`to:${recipient}`);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const searchResponse = await fetch(
      `${mailpitURL}/api/v1/search?query=${query}`,
    );
    const search = (await searchResponse.json()) as MailpitSearchResult;
    const message = search.messages.find((candidate) =>
      candidate.Subject.includes(subject),
    );

    if (message) {
      const textResponse = await fetch(`${mailpitURL}/view/${message.ID}.txt`);
      return textResponse.text();
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Mailpit hat keine passende Nachricht für ${recipient}.`);
}

function emailLink(message: string, pathname: string): URL {
  const links = message.match(/https?:\/\/[^\s<>]+/g) ?? [];
  const link = links
    .map((candidate) => new URL(candidate))
    .find((candidate) => candidate.pathname.startsWith(pathname));

  if (!link) {
    throw new Error(`Die E-Mail enthält keinen Link für ${pathname}.`);
  }

  return link;
}

describe.sequential("Better Auth with PostgreSQL and Mailpit", () => {
  let auth: AuthInstance;
  let harness: TestDatabaseHarness;
  let mailer: ReturnType<typeof createMailer>;
  let mailpitURL: string;

  const email = uniqueEmail();
  const initialPassword = "Sehr-sicheres-Passwort-2026";
  const resetPassword = "Noch-sichereres-Passwort-2026";

  async function authRequest(
    path: string,
    options: AuthRequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers({
      origin: baseURL,
      "x-forwarded-for": options.ip ?? `127.1.${Date.now() % 250}.1`,
    });

    if (options.body) {
      headers.set("content-type", "application/json");
    }

    if (options.cookie) {
      headers.set("cookie", options.cookie);
    }

    return auth.handler(
      new Request(`${baseURL}/api/auth${path}`, {
        body: options.body ? JSON.stringify(options.body) : undefined,
        headers,
        method: options.method ?? (options.body ? "POST" : "GET"),
      }),
    );
  }

  beforeAll(async () => {
    const env = loadDbEnv();
    harness = createTestDatabaseHarness();
    await harness.resetAndMigrate();

    mailpitURL = `http://127.0.0.1:${env.MAILPIT_HTTP_PORT}`;
    mailer = createMailer({
      from: "Kebapp Integrationstest <no-reply@kebapp.local>",
      host: "127.0.0.1",
      port: env.MAILPIT_SMTP_PORT,
    });
    auth = createKebappAuth({
      baseURL,
      database: harness.runtimeDatabase,
      secret: testSecret,
      sendEmail: mailer.send,
    });
  });

  afterAll(async () => {
    mailer.close();
    await harness.close();
  });

  it("registers without a session and requires the Mailpit verification link", async () => {
    const shortPassword = await authRequest("/sign-up/email", {
      body: {
        email: uniqueEmail(),
        name: "Test Inhaber",
        password: "Kurz-2026",
      },
      ip: "127.10.0.9",
    });
    expect(shortPassword.status).toBe(400);

    const signUp = await authRequest("/sign-up/email", {
      body: {
        callbackURL: "/email-bestaetigen?status=verified",
        email,
        name: "Test Inhaber",
        password: initialPassword,
      },
      ip: "127.10.0.1",
    });

    expect(signUp.status).toBe(200);
    expect(sessionCookie(signUp)).toBeNull();

    const duplicateSignUp = await authRequest("/sign-up/email", {
      body: {
        callbackURL: "/email-bestaetigen?status=verified",
        email,
        name: "Test Inhaber",
        password: initialPassword,
      },
      ip: "127.10.0.8",
    });
    expect(duplicateSignUp.status).toBe(200);
    expect(sessionCookie(duplicateSignUp)).toBeNull();

    const registeredUsers = await harness.ownerPool.query<{ count: number }>(
      'select count(*)::int as count from "user" where email = $1',
      [email],
    );
    expect(registeredUsers.rows[0]?.count).toBe(1);

    const beforeVerification = await authRequest("/sign-in/email", {
      body: {
        callbackURL: "/email-bestaetigen?status=verified",
        email,
        password: initialPassword,
      },
      ip: "127.10.0.2",
    });
    expect(beforeVerification.status).toBe(403);
    expect(sessionCookie(beforeVerification)).toBeNull();

    const verificationMail = await waitForMail(
      mailpitURL,
      email,
      "E-Mail-Adresse bestätigen",
    );
    const verificationURL = emailLink(
      verificationMail,
      "/api/auth/verify-email",
    );

    expect(verificationURL.origin).toBe(baseURL);
    expect(verificationURL.searchParams.get("callbackURL")).toBe(
      "/email-bestaetigen?status=verified",
    );

    const verification = await auth.handler(new Request(verificationURL));
    expect(verification.status).toBe(302);
    expect(
      new URL(verification.headers.get("location")!, baseURL).href,
    ).toBe(
      `${baseURL}/email-bestaetigen?status=verified`,
    );

    const signIn = await authRequest("/sign-in/email", {
      body: { email, password: initialPassword },
      ip: "127.10.0.3",
    });
    const cookie = sessionCookie(signIn);

    expect(signIn.status).toBe(200);
    expect(cookie).not.toBeNull();

    const session = await authRequest("/get-session", { cookie: cookie! });
    const sessionData = (await session.json()) as {
      user: { email: string; emailVerified: boolean };
    };
    expect(sessionData.user).toMatchObject({
      email,
      emailVerified: true,
    });

    const signOut = await authRequest("/sign-out", {
      body: {},
      cookie: cookie!,
    });
    expect(signOut.status).toBe(200);

    const revokedSession = await authRequest("/get-session", {
      cookie: cookie!,
    });
    expect(await revokedSession.json()).toBeNull();
  });

  it("returns a neutral reset response and revokes every session after reset", async () => {
    const firstSignIn = await authRequest("/sign-in/email", {
      body: { email, password: initialPassword },
      ip: "127.11.0.1",
    });
    const secondSignIn = await authRequest("/sign-in/email", {
      body: { email, password: initialPassword },
      ip: "127.11.0.2",
    });
    const firstCookie = sessionCookie(firstSignIn);
    const secondCookie = sessionCookie(secondSignIn);

    expect(firstCookie).not.toBeNull();
    expect(secondCookie).not.toBeNull();

    const unknownReset = await authRequest("/request-password-reset", {
      body: {
        email: uniqueEmail(),
        redirectTo: "/passwort-zuruecksetzen",
      },
      ip: "127.11.0.3",
    });
    const knownReset = await authRequest("/request-password-reset", {
      body: { email, redirectTo: "/passwort-zuruecksetzen" },
      ip: "127.11.0.4",
    });

    expect(unknownReset.status).toBe(200);
    expect(knownReset.status).toBe(200);
    expect(await unknownReset.json()).toEqual(await knownReset.json());

    const resetMail = await waitForMail(
      mailpitURL,
      email,
      "Passwort zurücksetzen",
    );
    const resetURL = emailLink(resetMail, "/api/auth/reset-password/");

    expect(resetURL.origin).toBe(baseURL);
    expect(resetURL.searchParams.get("callbackURL")).toBe(
      "/passwort-zuruecksetzen",
    );

    const resetCallback = await auth.handler(new Request(resetURL));
    expect(resetCallback.status).toBe(302);
    const resetLocation = new URL(resetCallback.headers.get("location")!);
    const token = resetLocation.searchParams.get("token");
    expect(resetLocation.pathname).toBe("/passwort-zuruecksetzen");
    expect(token).not.toBeNull();

    const reset = await authRequest("/reset-password", {
      body: { newPassword: resetPassword, token },
      ip: "127.11.0.5",
    });
    expect(reset.status).toBe(200);

    for (const cookie of [firstCookie!, secondCookie!]) {
      const revoked = await authRequest("/get-session", { cookie });
      expect(await revoked.json()).toBeNull();
    }

    const oldPassword = await authRequest("/sign-in/email", {
      body: { email, password: initialPassword },
      ip: "127.11.0.6",
    });
    const newPassword = await authRequest("/sign-in/email", {
      body: { email, password: resetPassword },
      ip: "127.11.0.7",
    });
    const reusedToken = await authRequest("/reset-password", {
      body: { newPassword: initialPassword, token },
      ip: "127.11.0.8",
    });

    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
    expect(reusedToken.status).toBe(400);
  });

  it("rate-limits repeated sign-in attempts in the database", async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await authRequest("/sign-in/email", {
        body: { email, password: "Falsches-Passwort-2026" },
        ip: "127.12.0.1",
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);

    const persistedRateLimit = await harness.ownerPool.query<{
      count: number;
    }>("select count(*)::int as count from rate_limit");
    expect(persistedRateLimit.rows[0]?.count).toBeGreaterThan(0);
  });
});
