import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export type SessionActor = {
  email: string;
  emailVerified: true;
  name: string;
  userId: string;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Eine gültige Anmeldung ist erforderlich.");
    this.name = "AuthenticationRequiredError";
  }
}

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super("Die E-Mail-Adresse muss zuerst bestätigt werden.");
    this.name = "EmailVerificationRequiredError";
  }
}

export const getOptionalSession = cache(async (): Promise<SessionActor | null> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  if (!session.user.emailVerified) {
    throw new EmailVerificationRequiredError();
  }

  return {
    email: session.user.email,
    emailVerified: true,
    name: session.user.name,
    userId: session.user.id,
  };
});

export const requireSession = cache(async (): Promise<SessionActor> => {
  const session = await getOptionalSession();

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session;
});
