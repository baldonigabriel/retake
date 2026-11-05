"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LayoutDashboard, Palette, Settings, Users } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/me", label: "Painel", icon: LayoutDashboard },
  { href: "/groups", label: "Grupos", icon: Users },
  { href: "/settings", label: "Ajustes", icon: Settings },
  { href: "/design-system", label: "Design", icon: Palette },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * DESIGN.md › Barra de navegação. Desktop: fixed top bar, surface-0 at 80% +
 * blur, links centred, active link with a 2px accent indicator. Mobile: slim
 * top bar (logo + avatar) and a bottom bar with 4 icons + labels (≥44px).
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface-0/80 backdrop-blur-[24px]">
        <nav
          aria-label="Principal"
          className="mx-auto grid h-14 w-full max-w-[1200px] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]"
        >
          <Link href="/" aria-label="Retake, início" className="w-fit rounded-control">
            <Logo />
          </Link>

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

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="hidden min-h-8 items-center gap-2 rounded-control px-2.5 text-body-sm text-fg-secondary shadow-hairline transition-[color,box-shadow,transform] duration-150 ease-out hover:text-fg hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] active:scale-[0.97] sm:inline-flex"
              aria-label="Trocar de grupo. Grupo atual: Os Cria"
            >
              Os Cria
              <ChevronsUpDown aria-hidden="true" className="size-3.5 text-fg-muted" />
            </button>
            <span
              aria-label="Sua conta: nyx"
              role="img"
              className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 text-label font-medium text-fg-secondary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            >
              N
            </span>
          </div>
        </nav>
      </header>

      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-0/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-[24px] md:hidden"
      >
        <ul className="grid grid-cols-4">
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
      </nav>
    </>
  );
}
