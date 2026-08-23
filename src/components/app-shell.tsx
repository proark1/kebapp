"use client";

import {
  ChevronsUpDown,
  Clock3,
  Globe2,
  LayoutDashboard,
  Menu,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import { DemoEnvironmentBar } from "@/components/demo-environment-bar";
import type { ActiveOrganizationDTO } from "@/server/organizations/organization-dto";

const primaryNavigation = [
  { href: "/app", label: "Übersicht", icon: LayoutDashboard },
  { href: "/app/einkauf", label: "Einkauf", icon: PackageOpen },
  { href: "/app/eingang", label: "Wareneingang", icon: PackageCheck },
  { href: "/app/hygiene", label: "Hygiene", icon: ShieldCheck, tabbar: false },
  { href: "/app/umsatz", label: "Umsätze", icon: TrendingUp, tabbar: false },
  { href: "/app/zeit", label: "Zeit", icon: Clock3 },
  { href: "/app/website", label: "Website", icon: Globe2, ownerOnly: true, tabbar: false },
];

type AppShellProps = {
  children: React.ReactNode;
  demoMode: boolean;
  organization: ActiveOrganizationDTO;
  signOutAction: (formData: FormData) => Promise<void>;
  user: { initials: string; name: string };
};

export function AppShell({
  children,
  demoMode,
  organization,
  signOutAction,
  user,
}: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const visiblePrimaryNavigation = primaryNavigation.filter(
    (item) => !item.ownerOnly || organization.role === "OWNER",
  );

  useEffect(() => {
    if (!menuOpen) return;

    const sidebar = sidebarRef.current;
    const firstLink = sidebar?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  if (pathname === "/app/organisation-waehlen") {
    return <>{children}</>;
  }

  return (
    <div className={`app-frame ${demoMode ? "app-frame--demo" : ""}`}>
      <a className="skip-link" href="#main-content">
        Zum Inhalt springen
      </a>

      {demoMode ? <DemoEnvironmentBar /> : null}

      <header className="mobile-header">
        <BrandMark />
        <button
          className="icon-button"
          type="button"
          ref={menuToggleRef}
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
        ref={sidebarRef}
        className={`app-sidebar ${menuOpen ? "app-sidebar--open" : ""}`}
      >
        <div className="app-sidebar__brand">
          <BrandMark inverse />
        </div>

        {organization.organizationCount > 1 ? (
          <Link className="store-switcher" href="/app/organisation-waehlen">
            <span className="store-avatar">{organization.initials}</span>
            <span>
              <strong>{organization.storeName}</strong>
              <small>{organization.roleLabel}</small>
            </span>
            <ChevronsUpDown size={16} aria-hidden="true" />
          </Link>
        ) : (
          <div className="store-switcher store-switcher--static">
            <span className="store-avatar">{organization.initials}</span>
            <span>
              <strong>{organization.storeName}</strong>
              <small>{organization.roleLabel}</small>
            </span>
          </div>
        )}

        <nav className="app-nav" aria-label="Hauptnavigation">
          <span className="app-nav__label">Heute</span>
          {visiblePrimaryNavigation.filter((item) => item.tabbar !== false).map((item) => {
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
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}

        </nav>

        <div className="app-sidebar__footer">
          <AccountMenu
            roleLabel={organization.roleLabel}
            signOutAction={signOutAction}
            user={user}
          />
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

      <nav
        className="mobile-tabbar"
        aria-label="Mobile Navigation"
        style={{
          gridTemplateColumns: `repeat(${visiblePrimaryNavigation.length}, 1fr)`,
        }}
      >
        {visiblePrimaryNavigation.map((item) => {
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
              aria-current={active ? "page" : undefined}
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
