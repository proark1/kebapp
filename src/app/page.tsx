import { redirect } from "next/navigation";
import { getPostLoginDestination } from "@/server/auth/destination";
import { getOptionalSession } from "@/server/auth/session";

export default async function HomePage() {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/anmelden");
  }

  redirect(await getPostLoginDestination(session.userId));
}
