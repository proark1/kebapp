import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  Globe2,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Users,
} from "lucide-react";
import { demoSignInAction } from "@/app/demo-actions";
import { BrandMark } from "@/components/brand-mark";
import { DemoRoleButton } from "@/components/demo-role-button";
import { DEMO_ROLES, type DemoRoleId } from "@/lib/demo-roles";
import { getPostLoginDestination } from "@/server/auth/destination";
import { getOptionalSession } from "@/server/auth/session";
import { isPublicDemo } from "@/server/demo/demo-mode";

export const metadata: Metadata = {
  title: "Öffentliche Demo",
  description:
    "Kebapp als betreuten Gruppeneinkauf und digitales Betriebssystem für unabhängige Dönerläden testen.",
};

type HomePageProps = {
  searchParams: Promise<{ demo?: string | string[] }>;
};

function roleIcon(role: DemoRoleId) {
  if (role === "admin") return <ShieldCheck aria-hidden="true" />;
  if (role === "support") return <ClipboardCheck aria-hidden="true" />;
  if (role === "employee-a") return <Users aria-hidden="true" />;
  if (role === "owner-b") return <Building2 aria-hidden="true" />;
  return <Store aria-hidden="true" />;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [session, params] = await Promise.all([getOptionalSession(), searchParams]);
  const demoMode = isPublicDemo();
  const destination = session
    ? await getPostLoginDestination(session.userId)
    : null;
  const demoMessage = Array.isArray(params.demo) ? params.demo[0] : params.demo;

  return (
    <main className="demo-landing">
      <a className="skip-link" href="#demo-roles">Zu den Demo-Rollen springen</a>
      <header className="demo-landing__nav">
        <BrandMark />
        <div>
          {destination ? (
            <Link className="demo-landing__session-link" href={destination}>
              Aktuellen Bereich öffnen
            </Link>
          ) : null}
          <Link className="demo-landing__login-link" href="/anmelden">
            Klassisch anmelden
          </Link>
        </div>
      </header>

      <section className="demo-hero">
        <div className="demo-hero__copy">
          <p className="demo-kicker">Pilotregion · Mönchengladbach + NRW</p>
          <h1>Gemeinsam einkaufen. Den Laden einfacher führen.</h1>
          <p className="demo-hero__lead">
            Kebapp bündelt den Fleischbedarf unabhängiger Dönerläden und bringt
            die wichtigsten digitalen Abläufe an einen Ort – betreut, regional
            und direkt testbar.
          </p>
          <ul className="demo-hero__benefits" aria-label="Kebapp Leistungen">
            <li><ShoppingBasket aria-hidden="true" /> Gruppeneinkauf</li>
            <li><ClipboardCheck aria-hidden="true" /> Betriebsübersicht</li>
            <li><Globe2 aria-hidden="true" /> Kostenlose Ladenwebsite</li>
          </ul>
        </div>

        <aside className="demo-hero__docket" aria-label="Demo-Hinweise">
          <header><span>Demo-Sammelzettel</span><strong>KEB–NRW</strong></header>
          <dl>
            <div><dt>Bestellungen</dt><dd>nur Beispieldaten</dd></div>
            <div><dt>E-Mail</dt><dd>Versand deaktiviert</dd></div>
            <div><dt>Zahlung</dt><dd>nicht enthalten</dd></div>
          </dl>
          <footer>Öffentliche Produktdemo · keine reale Bestellung</footer>
        </aside>
      </section>

      <section className="demo-role-section" id="demo-roles">
        <div className="demo-role-section__heading">
          <div>
            <p className="demo-kicker">Direkt ausprobieren</p>
            <h2>Wähle eine Perspektive.</h2>
          </div>
          <p>
            Die Anmeldung erfolgt automatisch. Zugangsdaten werden weder
            angezeigt noch an den Browser übertragen.
          </p>
        </div>

        {demoMessage ? (
          <p className="demo-landing__error" role="alert">
            Die Demo-Anmeldung ist gerade nicht verfügbar. Bitte versuche es
            gleich erneut oder nutze die klassische Anmeldung.
          </p>
        ) : null}

        {demoMode ? (
          <div className="demo-role-grid">
            {DEMO_ROLES.map((role, index) => (
              <article className="demo-role-card" key={role.id}>
                <header>
                  <span className="demo-role-card__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="demo-role-card__stamp">{role.stamp}</span>
                </header>
                <div className="demo-role-card__icon">{roleIcon(role.id)}</div>
                <h3>{role.label}</h3>
                <p>{role.description}</p>
                <form action={demoSignInAction}>
                  <input name="role" type="hidden" value={role.id} />
                  <DemoRoleButton />
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="demo-landing__local-note">
            <strong>Die Rollen-Demo ist in dieser Umgebung deaktiviert.</strong>
            <span>Nutze deinen lokalen Zugang über die klassische Anmeldung.</span>
          </div>
        )}
      </section>

      <footer className="demo-landing__footer">
        <BrandMark />
        <p>Betreuter Gruppeneinkauf für unabhängige Dönerläden in NRW.</p>
      </footer>
    </main>
  );
}
