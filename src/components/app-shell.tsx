"use client";

import {
  Boxes,
  ChevronsUpDown,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  Menu,
  PackageOpen,
  ReceiptText,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { BrandMark } from "@/components/brand-mark";
import type { ActiveOrganizationDTO } from "@/server/organizations/organization-dto";

const primaryNavigation = [
  { href: "/app", label: "Übersicht", icon: LayoutDashboard },
  { href: "/app/einkauf", label: "Einkauf", icon: PackageOpen },
  { href: "/app/website", label: "Website", icon: Globe2, ownerOnly: true },
];

const laterNavigation: Array<{
  href?: string;
  icon: typeof Boxes;
  label: string;
  ownerOnly?: boolean;
}> = [
  { label: "Waren", icon: Boxes },
  { label: "Belege", icon: ReceiptText },
  {
    href: "/app/einstellungen/team",
    label: "Team",
    icon: Users,
    ownerOnly: true,
  },
  { label: "Hygiene", icon: ClipboardCheck },
];

type AppShellProps = {
  children: React.ReactNode;
  organization: ActiveOrganizationDTO;
  signOutAction: (formData: FormData) => Promise<void>;
  user: { initials: string; name: string };
};

export function AppShell({
  children,
  organization,
  signOutAction,
  user,
}: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visiblePrimaryNavigation = primaryNavigation.filter(
    (item) => !item.ownerOnly || organization.role === "OWNER",
  );
  const visibleLaterNavigation = laterNavigation.filter(
    (item) => !item.ownerOnly || organization.role === "OWNER",
  );

  if (pathname === "/app/organisation-waehlen") {
    return <>{children}</>;
  }

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
          {visiblePrimaryNavigation.map((item) => {
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
          {visibleLaterNavigation.map((item) => {
            const Icon = item.icon;
            if (item.href) {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  className={
                    active
                      ? "app-nav__link app-nav__link--active"
                      : "app-nav__link"
                  }
                  href={item.href}
                  key={item.label}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                  {item.label}
                </Link>
              );
            }
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
          <AccountMenu
            role={organization.role}
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

      <nav className="mobile-tabbar" aria-label="Mobile Navigation">
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
