"use server";

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import {
  emailOnlyFormSchema,
  loginFormSchema,
  registrationFormSchema,
  resetPasswordFormSchema,
} from "@/lib/auth-form-schema";
import type {
  AuthFieldName,
  AuthFormState,
} from "@/lib/auth-form-state";
import { chooseSafeContinueDestination } from "@/lib/post-login-destination";
import { getPostLoginDestination } from "@/server/auth/destination";
import {
  isPublicDemo,
  publicDemoAuthState,
} from "@/server/demo/demo-mode";

const infrastructureMessage =
  "Das hat gerade nicht geklappt. Prüfe bitte, ob PostgreSQL und Mailpit lokal laufen, und versuche es erneut.";

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalStringValue(
  formData: FormData,
  name: string,
): string | undefined {
  const value = stringValue(formData, name);
  return value.length > 0 ? value : undefined;
}

function validationError(error: ZodError): AuthFormState {
  const fieldErrors: Partial<Record<AuthFieldName, string>> = {};
  const knownFields: readonly AuthFieldName[] = [
    "confirmPassword",
    "email",
    "name",
    "password",
  ];

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      knownFields.includes(field as AuthFieldName) &&
      !fieldErrors[field as AuthFieldName]
    ) {
      fieldErrors[field as AuthFieldName] = issue.message;
    }
  }

  return {
    fieldErrors,
    message: "Bitte prüfe die markierten Felder.",
    status: "error",
  };
}

function apiErrorCode(error: APIError): string | null {
  const body = error.body;

  if (body && typeof body === "object" && "code" in body) {
    return typeof body.code === "string" ? body.code : null;
  }

  return null;
}

function rateLimitError(): AuthFormState {
  return {
    message:
      "Zu viele Versuche in kurzer Zeit. Bitte warte einen Moment und versuche es dann erneut.",
    status: "error",
  };
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginFormSchema.safeParse({
    continueTo: optionalStringValue(formData, "continueTo"),
    email: stringValue(formData, "email"),
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  let destination = "/antrag";

  try {
    const result = await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
    destination = chooseSafeContinueDestination(
      await getPostLoginDestination(result.user.id),
      parsed.data.continueTo,
    );
  } catch (error) {
    if (error instanceof APIError) {
      if (apiErrorCode(error) === "EMAIL_NOT_VERIFIED") {
        destination = "/email-bestaetigen?status=offen";
      } else if (error.statusCode === 429) {
        return rateLimitError();
      } else if (error.statusCode < 500) {
        return {
          message: "E-Mail-Adresse oder Passwort stimmt nicht.",
          status: "error",
        };
      } else {
        return { message: infrastructureMessage, status: "error" };
      }
    } else {
      console.error("Kebapp-Anmeldung ist lokal fehlgeschlagen.");
      return { message: infrastructureMessage, status: "error" };
    }
  }

  redirect(destination);
}

export async function registerAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isPublicDemo()) return publicDemoAuthState();

  const parsed = registrationFormSchema.safeParse({
    confirmPassword: stringValue(formData, "confirmPassword"),
    email: stringValue(formData, "email"),
    name: stringValue(formData, "name"),
    password: stringValue(formData, "password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await auth.api.signUpEmail({
      body: {
        callbackURL: "/email-bestaetigen?status=verified",
        email: parsed.data.email,
        name: parsed.data.name,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 429) {
        return rateLimitError();
      }

      if (
        error.statusCode >= 500 &&
        !apiErrorCode(error)?.startsWith("USER_ALREADY_EXISTS")
      ) {
        return { message: infrastructureMessage, status: "error" };
      }
    } else {
      console.error("Kebapp-Registrierung ist lokal fehlgeschlagen.");
      return { message: infrastructureMessage, status: "error" };
    }
  }

  redirect("/email-bestaetigen?status=gesendet");
}

export async function resendVerificationAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isPublicDemo()) return publicDemoAuthState();

  const parsed = emailOnlyFormSchema.safeParse({
    email: stringValue(formData, "email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await auth.api.sendVerificationEmail({
      body: {
        callbackURL: "/email-bestaetigen?status=verified",
        email: parsed.data.email,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 429) {
        return rateLimitError();
      }

      if (error.statusCode >= 500) {
        return { message: infrastructureMessage, status: "error" };
      }
    } else {
      console.error("Kebapp-Verifizierungs-E-Mail ist lokal fehlgeschlagen.");
      return { message: infrastructureMessage, status: "error" };
    }
  }

  return {
    message:
      "Wenn die Adresse zu einem unbestätigten Konto gehört, ist eine neue E-Mail unterwegs.",
    status: "success",
  };
}

export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isPublicDemo()) return publicDemoAuthState();

  const parsed = emailOnlyFormSchema.safeParse({
    email: stringValue(formData, "email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/passwort-zuruecksetzen",
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 429) {
        return rateLimitError();
      }

      if (error.statusCode >= 500) {
        return { message: infrastructureMessage, status: "error" };
      }
    } else {
      console.error("Kebapp-Passwort-E-Mail ist lokal fehlgeschlagen.");
      return { message: infrastructureMessage, status: "error" };
    }
  }

  return {
    message:
      "Wenn ein Konto zu dieser Adresse gehört, ist ein Link zum Zurücksetzen unterwegs.",
    status: "success",
  };
}

export async function resetPasswordAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isPublicDemo()) return publicDemoAuthState();

  const parsed = resetPasswordFormSchema.safeParse({
    confirmPassword: stringValue(formData, "confirmPassword"),
    password: stringValue(formData, "password"),
    token: stringValue(formData, "token"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.password,
        token: parsed.data.token,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.statusCode === 429) {
        return rateLimitError();
      }

      if (error.statusCode < 500) {
        return {
          message:
            "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
          status: "error",
        };
      }

      return { message: infrastructureMessage, status: "error" };
    }

    console.error("Kebapp-Passwortänderung ist lokal fehlgeschlagen.");
    return { message: infrastructureMessage, status: "error" };
  }

  redirect("/anmelden?reset=erfolgreich");
}
