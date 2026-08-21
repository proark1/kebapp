import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = {
  title: "Passwort vergessen",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Wir legen einen zeitlich begrenzten Link in Mailpit ab. Die Antwort bleibt für jede Adresse gleich."
      eyebrow="Zugang wiederherstellen"
      footer={
        <p>
          Passwort wiedergefunden? <Link href="/anmelden">Zur Anmeldung</Link>
        </p>
      }
      title="Neues Passwort anfordern."
    >
      <PasswordResetForm action={requestPasswordResetAction} mode="request" />
    </AuthCard>
  );
}
