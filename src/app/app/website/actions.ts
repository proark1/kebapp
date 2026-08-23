"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
import type { WebsiteSaveState } from "@/lib/website-save-state";
import {
  requestStorefrontDomain,
  StorefrontDomainRequestError,
  StorefrontPermissionDeniedError,
  StorefrontPublicationError,
  updateStorefrontProfile,
} from "@/server/storefront/mutations";
import {
  requestedDomainSchema,
  storefrontUpdateSchema,
} from "@/server/storefront/validation";

const fieldLabelsByPath: Record<string, string> = {
  accent: "Akzentfarbe",
  city: "Ort",
  description: "Kurzbeschreibung",
  eyebrow: "Kurze Zeile über dem Titel",
  features: "Merkmale",
  heroImageUrl: "Headerbild",
  isPublished: "Veröffentlichung",
  logoUrl: "Logo",
  name: "Ladenname",
  phone: "Telefon",
  postalCode: "PLZ",
  shortName: "Kürzel",
  street: "Straße und Hausnummer",
  tagline: "Hauptüberschrift",
  whatsappPhone: "WhatsApp-Nummer",
};

function labelForIssuePath(path: PropertyKey[]): string {
  const segments = path.map((segment) => String(segment));
  if (segments.includes("menu")) {
    if (segments.at(-1) === "price") {
      return "Preis in der Speisekarte";
    }
    return "Speisekarte";
  }
  if (segments.includes("openingHours")) {
    return "Öffnungszeiten";
  }
  for (const segment of segments) {
    const label = fieldLabelsByPath[segment];
    if (label) {
      return label;
    }
  }
  return "Weitere Angaben";
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function redirectWithMessage(message: string): never {
  redirect(`/app/website?meldung=${message}`);
}

export async function saveStorefrontAction(
  _state: WebsiteSaveState,
  formData: FormData,
): Promise<WebsiteSaveState> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/website",
  );

  let profile: unknown;
  try {
    profile = JSON.parse(formString(formData, "profile"));
  } catch {
    return {
      message: "Die Angaben konnten nicht gelesen werden. Bitte erneut versuchen.",
      status: "error",
    };
  }
  const parsed = storefrontUpdateSchema.safeParse({
    isPublished: formData.get("isPublished") === "on",
    profile,
  });
  if (!parsed.success) {
    const labels: string[] = [];
    for (const issue of parsed.error.issues) {
      const label = labelForIssuePath(issue.path);
      if (!labels.includes(label)) {
        labels.push(label);
      }
    }
    return {
      fieldLabels: labels,
      message: "Bitte prüfe die markierten Angaben.",
      status: "error",
    };
  }

  let saved: { isPublished: boolean; publicSlug: string };
  try {
    saved = await updateStorefrontProfile({
      actor,
      isPublished: parsed.data.isPublished,
      organizationId: organization.organizationId,
      profile: parsed.data.profile,
    });
  } catch (error) {
    if (error instanceof StorefrontPublicationError) {
      return redirectWithMessage("unvollstaendig");
    }
    if (error instanceof StorefrontPermissionDeniedError) {
      redirect("/app");
    }
    throw error;
  }

  revalidatePath("/app/website");
  revalidatePath("/app");
  revalidatePath(`/laden/${saved.publicSlug}`);
  redirectWithMessage(saved.isPublished ? "veroeffentlicht" : "gespeichert");
}

export async function requestStorefrontDomainAction(
  formData: FormData,
): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/website",
  );
  const requestedDomain = requestedDomainSchema.safeParse(
    formString(formData, "requestedDomain"),
  );
  if (!requestedDomain.success) {
    return redirectWithMessage("domain-ungueltig");
  }

  try {
    await requestStorefrontDomain({
      actor,
      organizationId: organization.organizationId,
      requestedDomain: requestedDomain.data,
    });
  } catch (error) {
    if (error instanceof StorefrontPermissionDeniedError) {
      redirect("/app");
    }
    if (error instanceof StorefrontDomainRequestError) {
      return redirectWithMessage("domain-fehler");
    }
    throw error;
  }

  revalidatePath("/app/website");
  redirectWithMessage("domain-vorgemerkt");
}
