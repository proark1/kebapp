import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getPostLoginDestination } from "@/server/auth/destination";
import { getOptionalSession } from "@/server/auth/session";

export default async function OperatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await getOptionalSession();
  if (!actor) {
    redirect("/anmelden?weiter=/app");
  }

  const destination = await getPostLoginDestination(actor.userId);
  if (destination !== "/app") {
    redirect(destination);
  }

  return <AppShell>{children}</AppShell>;
}
