import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink() {
  return (
    <Link
      href="/me"
      className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control px-2 text-body-sm text-fg-secondary transition-colors duration-150 ease-out hover:text-fg sm:min-h-8"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Painel
    </Link>
  );
}
