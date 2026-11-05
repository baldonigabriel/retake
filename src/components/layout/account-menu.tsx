"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

const ITEM =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 text-body-sm text-fg-secondary outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-fg sm:min-h-9 [&_svg]:size-4 [&_svg]:text-fg-muted";

/**
 * Avatar button + menu. DESIGN.md › Popover: surface-3, border-strong, the
 * only drop shadow; grows from the trigger (scale 0.95 + fade, 150ms ease-out).
 */
export function AccountMenu({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      toast.error("Não foi possível sair", { description: "Verifique sua conexão e tente de novo." });
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Sua conta: ${name}`}
        className="inline-flex size-11 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 sm:size-10"
      >
        <Avatar name={name} image={image} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-50 min-w-52 origin-(--radix-dropdown-menu-content-transform-origin) rounded-control border border-line-strong bg-surface-3 p-1 shadow-pop",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-150 data-[state=open]:ease-out",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100 data-[state=closed]:ease-out",
            "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
          )}
        >
          <DropdownMenu.Label className="truncate px-2.5 pt-1.5 pb-2 text-label text-fg-muted">
            Conectado como <span className="text-fg-secondary">{name}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Item asChild className={ITEM}>
            <Link href="/settings">
              <Settings aria-hidden="true" />
              Ajustes
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="mx-1 my-1 h-px bg-line" />
          <DropdownMenu.Item
            className={ITEM}
            disabled={signingOut}
            onSelect={(event) => {
              event.preventDefault();
              void signOut();
            }}
          >
            <LogOut aria-hidden="true" />
            {signingOut ? "Saindo…" : "Sair"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function Avatar({ name, image, className }: { name: string; image: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-label font-medium text-fg-secondary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Discord CDN avatar, 32px
        <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

export function AccountMenuSkeleton() {
  return (
    <span aria-hidden="true" className="inline-flex size-11 items-center justify-center sm:size-10">
      <span className="size-8 rounded-full bg-surface-2" />
    </span>
  );
}
