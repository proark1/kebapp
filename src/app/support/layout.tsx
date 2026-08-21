import type { Metadata } from "next";
import Link from "next/link";
import { Headset, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { requirePlatformSupportPage } from "@/server/auth/page-guards";

export const metadata: Metadata = {
  title: { default: "Supporteinsatz", template: "%s · Kebapp Support" },
  robots: { follow: false, index: false },
};

export default async function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requirePlatformSupportPage("/support");

  return (
    <div className="support-shell">
      <a className="skip-link" href="#support-main">Zum Inhalt springen</a>
      <header className="support-context-bar">
        <div>
          <Headset size={18} aria-hidden="true" />
          <strong>Supporteinsatz</strong>
          <span>Du handelst als {actor.name} – niemals als Ladeninhaber:in.</span>
        </div>
        <span>
          <ShieldCheck size={17} aria-hidden="true" />
          Änderungen werden begründet protokolliert
        </span>
      </header>
      <aside className="support-rail">
        <Link href="/support" aria-label="Kebapp Support Startseite">
          <BrandMark inverse />
        </Link>
        <div className="support-rail__identity">
          <span>Betreuter Betrieb</span>
          <strong>Supportdesk NRW</strong>
          <small>Mönchengladbach · Pilot</small>
        </div>
        <nav aria-label="Support-Navigation">
          <Link href="/support">Meine Läden</Link>
        </nav>
        <footer>
          <Headset size={18} aria-hidden="true" />
          <p>Angemeldet als<strong>{actor.name}</strong></p>
        </footer>
      </aside>
      <main className="support-workspace" id="support-main">{children}</main>
    </div>
  );
}
