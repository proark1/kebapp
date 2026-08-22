import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { resendVerificationAction } from "../actions";
import { AuthCard } from "@/components/auth/auth-card";
import { EmailVerificationForm } from "@/components/auth/email-verification-form";
import { isPublicDemo, publicDemoMessage } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
};

type VerificationPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
};

function firstValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerificationPage({
  searchParams,
}: VerificationPageProps) {
  await connection();
  const params = await searchParams;
  const demoMode = isPublicDemo();
  const status = firstValue(params.status);
  const verified = status === "verified" && !firstValue(params.error);

  if (verified) {
    return (
      <AuthCard
        description="Dein Zugang ist bestätigt. Als Nächstes meldest du dich sicher an."
        eyebrow="Bestätigung abgeschlossen"
        title="E-Mail bestätigt."
      >
        <p className="auth-page-message auth-page-message--success" role="status">
          Die Bestätigung war erfolgreich. Dein Passwort bleibt unverändert.
        </p>
        <Link className="auth-submit" href="/anmelden">
          Weiter zur Anmeldung
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      description={
        demoMode
          ? "E-Mail-Bestätigungen sind in dieser öffentlichen Demo abgeschaltet."
          : "Öffne die Nachricht von Kebapp in Mailpit und klicke dort auf den Bestätigungslink."
      }
      eyebrow="Ein Schritt fehlt"
      footer={
        <p>
          Schon bestätigt? <Link href="/anmelden">Zur Anmeldung</Link>
        </p>
      }
      title="Postfach prüfen."
    >
      <p className="auth-page-message" role="status">
        {demoMode
          ? publicDemoMessage
          : status === "offen"
          ? "Deine E-Mail ist noch nicht bestätigt. Beim Anmeldeversuch wurde eine neue Nachricht angefordert."
          : "Wenn ein nutzbarer Zugang angelegt werden konnte, liegt eine Bestätigungs-E-Mail in Mailpit bereit."}
      </p>
      <div className="auth-divider"><span>Keine Nachricht gefunden?</span></div>
      <EmailVerificationForm
        action={resendVerificationAction}
        disabled={demoMode}
      />
    </AuthCard>
  );
}
