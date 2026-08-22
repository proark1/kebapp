import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requestPasswordResetAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { isPublicDemo, publicDemoMessage } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: "Passwort vergessen",
};

export default async function ForgotPasswordPage() {
  await connection();
  const demoMode = isPublicDemo();

  return (
    <AuthCard
      description={
        demoMode
          ? "Passwort-E-Mails sind in dieser öffentlichen Demo abgeschaltet."
          : "Wir legen einen zeitlich begrenzten Link in Mailpit ab. Die Antwort bleibt für jede Adresse gleich."
      }
      eyebrow="Zugang wiederherstellen"
      footer={
        <p>
          Passwort wiedergefunden? <Link href="/anmelden">Zur Anmeldung</Link>
        </p>
      }
      title="Neues Passwort anfordern."
    >
      {demoMode ? (
        <p className="auth-page-message" role="status">
          {publicDemoMessage}
        </p>
      ) : null}
      <PasswordResetForm
        action={requestPasswordResetAction}
        disabled={demoMode}
        mode="request"
      />
    </AuthCard>
  );
}
