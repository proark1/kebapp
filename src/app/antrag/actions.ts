"use server";

import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import type {
  RegistrationFieldName,
  RegistrationFormState,
} from "@/lib/registration-form-state";
import { getOptionalSession } from "@/server/auth/session";
import {
  DuplicatePendingRegistrationError,
  storeRegistrationSchema,
  submitStoreRegistration,
} from "@/server/organizations/registration";

function stringValue(formData: FormData, name: RegistrationFieldName) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function validationState(error: ZodError): RegistrationFormState {
  const fieldErrors: RegistrationFormState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path[0] as RegistrationFieldName | undefined;
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return {
    fieldErrors,
    message: "Bitte prüfe die markierten Angaben.",
    status: "error",
  };
}

export async function submitStoreRegistrationAction(
  _previousState: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const actor = await getOptionalSession();

  if (!actor) {
    redirect("/anmelden?weiter=/antrag");
  }

  const parsed = storeRegistrationSchema.safeParse({
    city: stringValue(formData, "city"),
    contactEmail: stringValue(formData, "contactEmail"),
    contactName: stringValue(formData, "contactName"),
    contactPhone: stringValue(formData, "contactPhone"),
    legalName: stringValue(formData, "legalName"),
    postalCode: stringValue(formData, "postalCode"),
    storeName: stringValue(formData, "storeName"),
    street: stringValue(formData, "street"),
  });

  if (!parsed.success) {
    return validationState(parsed.error);
  }

  try {
    await submitStoreRegistration({ actor, input: parsed.data });
  } catch (error) {
    if (error instanceof DuplicatePendingRegistrationError) {
      redirect("/status");
    }

    console.error("Der Ladenantrag konnte lokal nicht gespeichert werden.");
    return {
      message:
        "Der Antrag konnte gerade nicht gespeichert werden. Bitte versuche es erneut.",
      status: "error",
    };
  }

  redirect("/status?neu=1");
}
