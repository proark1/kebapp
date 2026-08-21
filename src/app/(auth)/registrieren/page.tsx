import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { RegistrationForm } from "@/components/auth/registration-form";

export const metadata: Metadata = {
  title: "Registrieren",
};

export default function RegistrationPage() {
  return (
    <AuthCard
      description="Lege deinen persönlichen Zugang an. Die Daten deines Ladens folgen nach der E-Mail-Bestätigung."
      eyebrow="Pilotzugang"
      footer={
        <p>
          Bereits registriert? <Link href="/anmelden">Zur Anmeldung</Link>
        </p>
      }
      title="Kebapp für deinen Laden."
    >
      <RegistrationForm action={registerAction} />
    </AuthCard>
  );
}
