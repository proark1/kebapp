"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveOrganizationPage } from "@/server/auth/page-guards";
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

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function redirectWithMessage(message: string): never {
  redirect(`/app/website?meldung=${message}`);
}

export async function saveStorefrontAction(formData: FormData): Promise<void> {
  const { actor, organization } = await requireActiveOrganizationPage(
    "/app/website",
  );

  let profile: unknown;
  try {
    profile = JSON.parse(formString(formData, "profile"));
  } catch {
    return redirectWithMessage("ungueltig");
  }
  const parsed = storefrontUpdateSchema.safeParse({
    isPublished: formData.get("isPublished") === "on",
    profile,
  });
  if (!parsed.success) {
    return redirectWithMessage("ungueltig");
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
