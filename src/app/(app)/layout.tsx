import { Suspense } from "react";

import { AccountMenu, AccountMenuSkeleton } from "@/components/layout/account-menu";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { getViewerIdentity } from "@/lib/auth/session";

/**
 * Signed-in area. The nav and footer are static; the account menu and each
 * page read the session behind their own Suspense boundaries (loading.tsx),
 * and every page re-checks the session on the server (requireUser).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteNav
        account={
          <Suspense fallback={<AccountMenuSkeleton />}>
            <NavAccount />
          </Suspense>
        }
      />
      <main id="conteudo" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-14 pb-24 sm:px-6 md:pb-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

async function NavAccount() {
  const user = await getViewerIdentity();
  if (!user) return <AccountMenuSkeleton />;
  return <AccountMenu name={user.displayName} image={user.image} />;
}
