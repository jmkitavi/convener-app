"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Building2,
  BarChart3,
  FileChartColumn,
  Flag,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScopeControls } from "@/components/scope-controls";
import type { DataScope } from "@/lib/insights";

const navLinks = [
  { href: "/", label: "Conveners desk", icon: LayoutDashboard },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/players", label: "Squad", icon: Users },
  { href: "/clubs", label: "Clubs", icon: Building2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileChartColumn },
] as const;

const analyticsLinks = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/leaderboards", label: "Points leaders" },
  { href: "/analytics/home-away", label: "Home vs away" },
  { href: "/analytics/pairings", label: "Partnerships" },
  { href: "/analytics/venues", label: "Venues" },
  { href: "/analytics/handicaps", label: "Handicaps" },
  { href: "/analytics/data-quality", label: "Data quality" },
] as const;

const lineupLinks = [
  { href: "/analytics/suggest", label: "Pairing suggestions" },
  { href: "/analytics/counter", label: "Counter-pairing" },
] as const;

export function Nav({ scope = "ndc" }: { scope?: DataScope }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sectionNav = useRef<HTMLElement>(null);
  const inAnalyticsSection = pathname.startsWith("/analytics/");

  useEffect(() => {
    const nav = sectionNav.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollLeft += offset - (nav.clientWidth - active.offsetWidth) / 2;
  }, [pathname, inAnalyticsSection]);

  function scopedHref(href: string) {
    const analytical = href === "/" || href === "/analytics" ||
      [...analyticsLinks, ...lineupLinks].some((link) => link.href === href);
    return analytical && scope === "all" ? `${href}?scope=all` : href;
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function linkClass(active: boolean) {
    return cn(
      "flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-secondary text-secondary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );
  }

  return (
    <header
      className="sticky top-0 z-40 border-b bg-card"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          menuButton.current?.focus();
        }
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-18 flex-wrap items-center justify-between gap-3 py-3 xl:flex-nowrap xl:py-0">
          <Link
            href={scopedHref("/")}
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-desk-navy"
            aria-label="Convener home"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex size-9 items-center justify-center rounded-xl border text-primary">
              <Flag className="size-5" aria-hidden="true" />
            </span>
            convener
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={scopedHref(href)}
                aria-current={isActive(href) ? (pathname === href ? "page" : "location") : undefined}
                className={linkClass(isActive(href))}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <Button
            ref={menuButton}
            variant="ghost"
            size="icon"
            className="size-11 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
          >
            {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
          <div className="flex w-full justify-end xl:w-auto">
            <ScopeControls scope={scope} />
          </div>
        </div>

        {inAnalyticsSection && <nav
          ref={sectionNav}
          aria-label="Analytics sections"
          className="flex gap-1 overflow-x-auto border-t py-2 lg:flex-wrap"
        >
          {[...analyticsLinks, ...lineupLinks].map(({ href, label }) => (
            <Link
              key={href}
              href={scopedHref(href)}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(linkClass(pathname === href), "shrink-0")}
            >
              {label}
            </Link>
          ))}
        </nav>}
      </div>

      <div
        id="mobile-navigation"
        hidden={!mobileOpen}
        className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t lg:hidden"
      >
        <nav aria-label="Mobile navigation" className="space-y-1 px-4 py-3">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={scopedHref(href)}
              aria-current={isActive(href) ? (pathname === href ? "page" : "location") : undefined}
              onClick={() => setMobileOpen(false)}
              className={linkClass(isActive(href))}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
