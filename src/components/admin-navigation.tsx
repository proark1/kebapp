"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/admin", label: "Übersicht" },
  { href: "/admin/antraege", label: "Ladenanträge" },
  { href: "/admin/laeden", label: "Läden" },
  { href: "/admin/runden", label: "Sammelrunden" },
  { href: "/admin/support", label: "Supporteinsätze" },
  { href: "/admin/audit", label: "Auditprotokoll" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

function AdminLinks({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return links.map((link) => {
    const active = isActive(pathname, link.href);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={active ? "admin-nav-link--active" : undefined}
        href={link.href}
        key={link.href}
        onClick={close}
      >
        {link.label}
      </Link>
    );
  });
}

export function AdminNavigation({ actorName }: { actorName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="admin-rail">
        <Link href="/admin" aria-label="Kebapp Prüftisch Startseite">
          <BrandMark inverse />
        </Link>
        <div className="admin-rail__office">
          <span>Interner Bereich</span>
          <strong>Prüftisch NRW</strong>
          <small>Mönchengladbach · Pilot</small>
        </div>
        <nav aria-label="Admin-Navigation"><AdminLinks /></nav>
        <footer>
          <span aria-hidden="true" />
          <p>Angemeldet als<strong>{actorName}</strong></p>
        </footer>
      </aside>

      <header className="admin-mobile-header">
        <BrandMark />
        <div>
          <span>Prüftisch NRW</span>
          <button
            aria-controls="admin-mobile-menu"
            aria-expanded={open}
            aria-label={open ? "Navigation schließen" : "Navigation öffnen"}
            className="icon-button icon-button--bordered"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>
      {open ? (
        <nav className="admin-mobile-menu" id="admin-mobile-menu" aria-label="Mobile Admin-Navigation">
          <AdminLinks close={() => setOpen(false)} />
        </nav>
      ) : null}
    </>
  );
}
