import type { Metadata } from "next";
import { CheckCircle2, Clock3, KeyRound, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { getOptionalSession } from "@/server/auth/session";
import { getInvitationForRecipient } from "@/server/invitations/service";
import { acceptInvitationAction } from "./actions";

export const metadata: Metadata = {
  title: "Teameinladung",
  robots: { follow: false, index: false },
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const errorMessages: Record<string, string> = {
  abgelaufen:
    "Diese Einladung ist abgelaufen. Bitte den Laden um eine neue Einladung.",
  mitglied:
    "Für dieses Konto besteht bereits eine Mitgliedschaft in diesem Laden.",
  ungueltig:
    "Diese Einladung ist ungültig, widerrufen oder für ein anderes Konto bestimmt.",
  verwendet:
    "Diese Einladung wurde bereits verwendet und kann nicht erneut angenommen werden.",
};

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const [{ token }, query, actor] = await Promise.all([
    params,
    searchParams,
    getOptionalSession(),
  ]);
  if (!actor) {
    redirect(`/anmelden?weiter=${encodeURIComponent(`/einladung/${token}`)}`);
  }

  const invitation = await getInvitationForRecipient({ actor, token });
  const canAccept = invitation?.status === "PENDING" && !invitation.expired;
  const errorMessage = query.fehler ? errorMessages[query.fehler] : undefined;
  const acceptAction = acceptInvitationAction.bind(null, token);

  return (
    <div className="invitation-page">
      <header className="invitation-page__topbar">
        <BrandMark />
        <span>GESCHÜTZTE EINLADUNG</span>
      </header>
      <main className="invitation-page__content">
        <section className="invitation-ticket">
          <span className="invitation-ticket__punch" aria-hidden="true" />
          <div className="invitation-ticket__icon">
            {canAccept ? (
              <KeyRound size={27} aria-hidden="true" />
            ) : (
              <ShieldAlert size={27} aria-hidden="true" />
            )}
          </div>
          <span className="eyebrow">KEBAPP TEAMZUGANG</span>
          <h1>
            {canAccept ? "Dein Platz im Team ist reserviert." : "Einladung prüfen"}
          </h1>
          <p>
            {canAccept
              ? `Du bist als Mitarbeiter:in mit ${invitation.email} eingeladen.`
              : "Diese Einladung kann mit dem aktuell angemeldeten Konto nicht angenommen werden."}
          </p>

          {canAccept ? (
            <div className="invitation-ticket__facts">
              <span>
                <CheckCircle2 size={16} aria-hidden="true" />
                E-Mail bestätigt
              </span>
              <span>
                <Clock3 size={16} aria-hidden="true" />
                gültig bis {dateFormatter.format(invitation.expiresAt)} Uhr
              </span>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="invitation-ticket__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {canAccept ? (
            <form action={acceptAction}>
              <button type="submit">Einladung annehmen</button>
            </form>
          ) : (
            <a href="/app">Zur Kebapp-Übersicht</a>
          )}

          <small>
            Das Token wird nur einmal verwendet. Kebapp prüft deine Berechtigung
            serverseitig erneut.
          </small>
        </section>
      </main>
    </div>
  );
}
