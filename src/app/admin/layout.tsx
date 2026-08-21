import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { requirePlatformAdminPage } from "@/server/auth/page-guards";

export const metadata: Metadata = {
  title: { default: "Prüftisch", template: "%s · Kebapp Prüftisch" },
  robots: { follow: false, index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformAdminPage("/admin");

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main">
        Zum Inhalt springen
      </a>
      <aside className="admin-rail">
        <Link href="/admin" aria-label="Kebapp Prüftisch Startseite">
          <BrandMark inverse />
        </Link>
        <div className="admin-rail__office">
          <span>Interner Bereich</span>
          <strong>Prüftisch NRW</strong>
          <small>Mönchengladbach · Pilot</small>
        </div>
        <nav aria-label="Admin-Navigation">
          <Link href="/admin">Übersicht</Link>
          <Link href="/admin/antraege">Ladenanträge</Link>
        </nav>
        <footer>
          <span aria-hidden="true" />
          <p>
            Angemeldet als
            <strong>{actor.name}</strong>
          </p>
        </footer>
      </aside>
      <div className="admin-workspace">
        <header className="admin-mobile-header">
          <BrandMark />
          <span>Prüftisch NRW</span>
        </header>
        <main id="admin-main">{children}</main>
      </div>
    </div>
  );
}
