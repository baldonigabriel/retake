import Link from "next/link";
import { Suspense } from "react";

import { HeaderSearch } from "@/components/layout/header-search";
import { AccountMenu, AccountMenuSkeleton } from "@/components/layout/account-menu";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { buttonVariants } from "@/components/ui/button";
import { getViewerIdentity } from "@/lib/auth/session";

/**
 * Pages anyone can open without signing in: public profiles and the search
 * (SPEC §6). A signed-in user gets the app's own header; a visitor gets the
 * logo, the search and a discreet "Entrar".
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<VisitorNav />}>
        <ViewerNav />
      </Suspense>
      <main id="conteudo" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-14 pb-24 sm:px-6 md:pb-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

async function ViewerNav() {
  const user = await getViewerIdentity();
  if (!user) return <VisitorNav />;
  return (
    <SiteNav
      account={
        <Suspense fallback={<AccountMenuSkeleton />}>
          <AccountMenu name={user.displayName} image={user.image} />
        </Suspense>
      }
    />
  );
}

function VisitorNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-surface-0/80 backdrop-blur-[24px]">
      <nav aria-label="Principal" className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Retake, início" className="-ml-1 flex min-h-11 w-fit items-center rounded-control px-1">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <HeaderSearch />
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Entrar
          </Link>
        </div>
      </nav>
    </header>
  );
}
