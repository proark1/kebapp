"use client";

import { Headset } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

export function SupportNavigation({ actorName }: { actorName: string }) {
  const pathname = usePathname();
  const active = pathname === "/support" || pathname.startsWith("/support/");

  return (
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
        <Link
          aria-current={active ? "page" : undefined}
          className={active ? "support-nav-link--active" : undefined}
          href="/support"
        >
          Meine Läden
        </Link>
      </nav>
      <footer>
        <Headset size={18} aria-hidden="true" />
        <p>Angemeldet als<strong>{actorName}</strong></p>
      </footer>
    </aside>
  );
}
