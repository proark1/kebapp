import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { registerAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { RegistrationForm } from "@/components/auth/registration-form";
import { isPublicDemo, publicDemoMessage } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: "Registrieren",
};

export default async function RegistrationPage() {
  await connection();
  const demoMode = isPublicDemo();

  return (
    <AuthCard
      description={
        demoMode
          ? "Diese öffentliche Version zeigt vorbereitete Demo-Zugänge und versendet keine E-Mails."
          : "Lege deinen persönlichen Zugang an. Die Daten deines Ladens folgen nach der E-Mail-Bestätigung."
      }
      eyebrow="Pilotzugang"
      footer={
        <p>
          Bereits registriert? <Link href="/anmelden">Zur Anmeldung</Link>
        </p>
      }
      title="Kebapp für deinen Laden."
    >
      {demoMode ? (
        <p className="auth-page-message" role="status">
          {publicDemoMessage}
        </p>
      ) : null}
      <RegistrationForm action={registerAction} disabled={demoMode} />
    </AuthCard>
  );
}
