"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  Compass,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Smartphone,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LanguageSelector, useI18n, type TranslationKey } from "@/lib/i18n";
import { logout } from "@/app/auth/actions";

const navigation: { label: TranslationKey; href: string; icon: LucideIcon }[] = [
  { label: "common.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "common.myTests", href: "/my-tests", icon: ClipboardList },
  { label: "common.myApps", href: "/apps", icon: Smartphone },
  { label: "common.exploreTests", href: "/explore", icon: Compass },
  { label: "common.profile", href: "/profile", icon: UserRound },
];

function titleForPath(pathname: string, t: (key: TranslationKey) => string) {
  if (pathname.startsWith("/explore/")) return t("common.campaignDetails");
  if (pathname.startsWith("/explore")) return t("common.exploreTests");
  if (pathname.startsWith("/my-tests")) return t("common.myTests");
  if (pathname.startsWith("/apps")) return t("common.myApps");
  if (pathname.includes("/tracking")) return t("common.campaignTracking");
  if (pathname.startsWith("/campaigns/new")) return t("common.newCampaign");
  if (pathname.startsWith("/campaigns/")) return t("common.editCampaign");
  if (pathname.startsWith("/campaigns")) return t("common.myCampaigns");
  if (pathname.startsWith("/profile")) return t("common.profile");
  return t("common.dashboard");
}

export function AppShell({
  children,
  displayName,
  email,
  initials,
}: {
  children: React.ReactNode;
  displayName: string;
  email: string;
  initials: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  function toggleTheme() {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
  }

  return (
    <div className="workspace">
      {mobileOpen && <button aria-label={t("common.closeMenu")} className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" href="/dashboard" onClick={() => setMobileOpen(false)}>
          <span className="brand-symbol"><Grid2X2 size={18} strokeWidth={2.4} /></span>
          <span>tester<span className="brand-light">hub</span></span>
        </Link>
        <div className="workspace-switcher">
          <span className="workspace-avatar">TH</span>
          <span className="workspace-name"><strong>{t("common.workspace")}</strong><small>{t("common.personal")}</small></span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{t("common.mainMenu")}</div>
        <nav className="side-nav" aria-label={t("common.mainMenu")}>
          {navigation.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link
                className={`nav-link ${active ? "nav-link-active" : ""}`}
                href={href}
                key={href}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(label)}</span>
                {label === "common.myTests" && <span className="nav-count">3</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <strong>{t("common.helpNeeded")}</strong>
          <p>{t("common.supportEmail")}</p>
        </div>
        <div className="sidebar-profile">
          <span className="avatar avatar-profile">{initials}</span>
          <span className="profile-copy"><strong>{displayName}</strong><small>{email}</small></span>
          <form action={logout}>
            <button className="icon-button logout-button" aria-label={t("common.logout")} title={t("common.logout")} type="submit">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label={mobileOpen ? t("common.closeMenu") : t("common.openMenu")} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="breadcrumbs"><span>{t("shell.breadcrumbWorkspace")}</span><span className="crumb-separator">/</span><strong>{titleForPath(pathname, t)}</strong></div>
          <div className="topbar-actions">
            <LanguageSelector />
            <button className="icon-button theme-button" aria-label={t("common.changeTheme")} onClick={toggleTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button notification-button" aria-label={t("common.notifications")}>
              <Bell size={18} /><span />
            </button>
            <span className="top-avatar" aria-label={displayName} title={displayName}>{initials}</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>© 2026 Tester Hub</span>
          <span>{t("common.footer")} <span className="footer-heart">♥</span></span>
        </footer>
      </div>
    </div>
  );
}
