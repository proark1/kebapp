import type { Metadata } from "next";
import { Building2, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { chooseSafeContinueDestination } from "@/lib/post-login-destination";
import { getOrganizationChoicesPage } from "@/server/auth/page-guards";
import { selectActiveOrganizationAction } from "./actions";

export const metadata: Metadata = {
  title: "Laden auswählen",
  robots: { follow: false, index: false },
};

export default async function OrganizationSelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; weiter?: string }>;
}) {
  const [{ actor, choices }, params] = await Promise.all([
    getOrganizationChoicesPage(),
    searchParams,
  ]);
  const continueTo = chooseSafeContinueDestination("/app", params.weiter);

  if (choices.length === 1) {
    redirect(continueTo === "/app/organisation-waehlen" ? "/app" : continueTo);
  }

  return (
    <div className="organization-picker-shell">
      <header className="organization-picker-topbar">
        <BrandMark />
        <span>GESCHÜTZTE LADENAUSWAHL</span>
      </header>
      <main className="organization-picker">
        <section className="organization-picker__intro">
          <span className="organization-picker__icon">
            <KeyRound size={24} aria-hidden="true" />
          </span>
          <p>Willkommen, {actor.name}</p>
          <h1>Welchen Laden öffnest du?</h1>
          <span>
            Die Auswahl merkt sich nur deinen Arbeitsbereich. Deine
            Berechtigungen werden bei jedem Zugriff erneut geprüft.
          </span>
        </section>

        {params.fehler === "ungueltig" ? (
          <p className="organization-picker__error" role="alert">
            Dieser Laden ist für dein Konto nicht mehr verfügbar. Bitte wähle
            erneut.
          </p>
        ) : null}

        <section className="organization-keyboard" aria-label="Verfügbare Läden">
          <header>
            <span>Ladenschlüssel</span>
            <strong>{choices.length} verfügbar</strong>
          </header>
          <ol>
            {choices.map((choice, index) => (
              <li key={choice.organizationId}>
                <form action={selectActiveOrganizationAction}>
                  <input name="organizationId" type="hidden" value={choice.organizationId} />
                  <input name="continueTo" type="hidden" value={continueTo} />
                  <button type="submit">
                    <span className="organization-keyboard__number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="organization-keyboard__avatar">
                      {choice.initials}
                    </span>
                    <span className="organization-keyboard__name">
                      <strong>{choice.storeName}</strong>
                      <small>{choice.roleLabel}</small>
                    </span>
                    <Building2 size={19} aria-hidden="true" />
                  </button>
                </form>
              </li>
            ))}
          </ol>
          <footer>
            <span>Jeder Laden bleibt technisch getrennt.</span>
            <strong>KEB–NRW</strong>
          </footer>
        </section>
      </main>
    </div>
  );
}
