"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Users } from "lucide-react";
import { Suspense } from "react";

import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/me", label: "Painel", icon: LayoutDashboard },
  { href: "/groups", label: "Grupos", icon: Users },
  { href: "/settings", label: "Ajustes", icon: Settings },
] as const;

function isActive(pathname: string | null, href: string) {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

/**
 * The pathname is request data on dynamic routes, so the links that depend
 * on it render inside Suspense; the fallback is the same links without the
 * active marker (no layout shift).
 */
function WithPathname({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return <Suspense fallback={children(null)}><PathnameReader>{children}</PathnameReader></Suspense>;
}

function PathnameReader({ children }: { children: (pathname: string | null) => React.ReactNode }) {
  return children(usePathname());
}

/**
 * DESIGN.md › Barra de navegação. Desktop: fixed top bar, surface-0 at 80% +
 * blur, links centred, active link with a 2px accent indicator. Mobile: slim
 * top bar (logo + avatar) and a bottom bar with icons + labels (≥44px).
 * `account` is the signed-in user's menu, streamed in behind a Suspense
 * boundary by the (app) layout so the bar itself is part of the static shell.
 */
export function SiteNav({ account }: { account?: React.ReactNode }) {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface-0/80 backdrop-blur-[24px]">
        <nav
          aria-label="Principal"
          className="mx-auto grid h-14 w-full max-w-[1200px] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]"
        >
          <Link href="/" aria-label="Retake, início" className="-ml-1 flex min-h-11 w-fit items-center rounded-control px-1">
            <Logo />
          </Link>

          <WithPathname>{(pathname) => (
          <ul className="hidden h-full items-stretch gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="flex">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center px-3 text-body-sm transition-colors duration-150 ease-out focus-visible:outline-offset-[-2px]",
                      active ? "text-fg" : "text-fg-secondary hover:text-fg",
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          )}</WithPathname>

          <div className="flex items-center justify-end gap-2">{account}</div>
        </nav>
      </header>

      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-0/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-[24px] md:hidden"
      >
        <WithPathname>{(pathname) => (
        <ul className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 flex-col items-center justify-center gap-1 text-eyebrow focus-visible:outline-offset-[-2px]",
                    active ? "text-fg" : "text-fg-secondary",
                  )}
                >
                  {active ? (
                    <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />
                  ) : null}
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        )}</WithPathname>
      </nav>
    </>
  );
}
