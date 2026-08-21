import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    token?: string | string[];
  }>;
};

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = firstValue(params.token);
  const hasCallbackError = Boolean(firstValue(params.error));

  return (
    <AuthCard
      description="Wähle ein neues, nur für Kebapp verwendetes Passwort mit mindestens 12 Zeichen."
      eyebrow="Zugang absichern"
      footer={
        <p>
          Anderen Link anfordern? <Link href="/passwort-vergessen">Zurücksetzen neu starten</Link>
        </p>
      }
      title="Neues Passwort festlegen."
    >
      {!token || hasCallbackError ? (
        <>
          <p className="auth-page-message auth-page-message--error" role="alert">
            Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.
          </p>
          <Link className="auth-submit" href="/passwort-vergessen">
            Neuen Link anfordern
          </Link>
        </>
      ) : (
        <PasswordResetForm
          action={resetPasswordAction}
          mode="reset"
          token={token}
        />
      )}
    </AuthCard>
  );
}
