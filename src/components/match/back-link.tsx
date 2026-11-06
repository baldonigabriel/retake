import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href = "/me", label = "Painel" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="hover-layer press relative -ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control px-2 text-body-sm text-fg-secondary hover:text-fg focus-visible:text-fg sm:min-h-8"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}
