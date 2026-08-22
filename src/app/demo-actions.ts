"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isDemoRoleId, type DemoRoleId } from "@/lib/demo-roles";
import { getRuntimeEnv } from "@/lib/env";
import { getPostLoginDestination } from "@/server/auth/destination";

type DemoCredential = { email?: string; password?: string };

function roleCredential(role: DemoRoleId): DemoCredential {
  const env = getRuntimeEnv();
  const credentials: Record<DemoRoleId, DemoCredential> = {
    admin: { email: env.DEMO_ADMIN_EMAIL, password: env.DEMO_ADMIN_PASSWORD },
    support: {
      email: env.DEMO_SUPPORT_EMAIL,
      password: env.DEMO_SUPPORT_PASSWORD,
    },
    "owner-a": {
      email: env.DEMO_OWNER_EMAIL,
      password: env.DEMO_OWNER_PASSWORD,
    },
    "employee-a": {
      email: env.DEMO_EMPLOYEE_EMAIL,
      password: env.DEMO_EMPLOYEE_PASSWORD,
    },
    "owner-b": {
      email: env.DEMO_SECOND_OWNER_EMAIL,
      password: env.DEMO_SECOND_OWNER_PASSWORD,
    },
  };
  return credentials[role];
}

export async function demoSignInAction(formData: FormData): Promise<void> {
  const env = getRuntimeEnv();
  const rawRole = formData.get("role");
  if (!env.DEMO_MODE || typeof rawRole !== "string" || !isDemoRoleId(rawRole)) {
    redirect("/?demo=nicht-verfuegbar");
  }

  const credential = roleCredential(rawRole);
  if (!credential.email || !credential.password) {
    redirect("/?demo=nicht-konfiguriert");
  }

  let destination: string | null = null;
  try {
    const result = await auth.api.signInEmail({
      body: { email: credential.email, password: credential.password },
      headers: await headers(),
    });
    destination = await getPostLoginDestination(result.user.id);
  } catch {
    destination = null;
  }

  redirect(destination ?? "/?demo=fehlgeschlagen");
}
