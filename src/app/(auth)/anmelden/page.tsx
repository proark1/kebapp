import type { Metadata } from "next";
import Link from "next/link";
import { signInAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Anmelden",
};

type LoginPageProps = {
  searchParams: Promise<{
    reset?: string | string[];
    weiter?: string | string[];
  }>;
};

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const resetWasSuccessful = firstValue(params.reset) === "erfolgreich";

  return (
    <AuthCard
      description="Melde Bedarf, verfolge Sammelrunden und pflege deine Laden-Website."
      eyebrow="Betriebszugang"
      footer={
        <p>
          Noch kein Kebapp-Zugang? <Link href="/registrieren">Jetzt registrieren</Link>
        </p>
      }
      title="Willkommen zurück."
    >
      {resetWasSuccessful ? (
        <p className="auth-page-message auth-page-message--success" role="status">
          Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.
        </p>
      ) : null}
      <LoginForm action={signInAction} continueTo={firstValue(params.weiter)} />
    </AuthCard>
  );
}
