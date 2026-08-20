"use client";

import {
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  Menu,
  PackageOpen,
  ReceiptText,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";

const primaryNavigation = [
  { href: "/app", label: "Übersicht", icon: LayoutDashboard },
  { href: "/app/einkauf", label: "Einkauf", icon: PackageOpen },
  { href: "/app/website", label: "Website", icon: Globe2 },
];

const laterNavigation = [
  { label: "Waren", icon: Boxes },
  { label: "Belege", icon: ReceiptText },
  { label: "Personal", icon: Users },
  { label: "Hygiene", icon: ClipboardCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Zum Inhalt springen
      </a>

      <header className="mobile-header">
        <BrandMark />
        <button
          className="icon-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          aria-label={menuOpen ? "Navigation schließen" : "Navigation öffnen"}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <aside
        id="app-sidebar"
        className={`app-sidebar ${menuOpen ? "app-sidebar--open" : ""}`}
      >
        <div className="app-sidebar__brand">
          <BrandMark inverse />
        </div>

        <button className="store-switcher" type="button">
          <span className="store-avatar">OR</span>
          <span>
            <strong>Ocakbaşı Rheydt</strong>
            <small>Inhaberbereich</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        <nav className="app-nav" aria-label="Hauptnavigation">
          <span className="app-nav__label">Heute</span>
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/app"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                className={active ? "app-nav__link app-nav__link--active" : "app-nav__link"}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}

          <span className="app-nav__label app-nav__label--spaced">Betrieb</span>
          {laterNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button className="app-nav__link app-nav__link--disabled" type="button" key={item.label}>
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                {item.label}
                <span className="soon-pill">bald</span>
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar__footer">
          <button className="app-nav__link" type="button">
            <Settings size={19} strokeWidth={1.9} aria-hidden="true" />
            Einstellungen
          </button>
          <div className="pilot-chip">
            <span aria-hidden="true" />
            Pilot Mönchengladbach
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Navigation schließen"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <main id="main-content" className="app-main">
        {children}
      </main>

      <nav className="mobile-tabbar" aria-label="Mobile Navigation">
        {primaryNavigation.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/app"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              className={active ? "mobile-tabbar__link mobile-tabbar__link--active" : "mobile-tabbar__link"}
              href={item.href}
              key={item.href}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
