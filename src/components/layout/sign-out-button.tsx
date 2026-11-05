"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await authClient.signOut();
          if (error) {
            toast.error("Não foi possível sair", { description: "Verifique sua conexão e tente de novo." });
            return;
          }
          router.replace("/login");
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden="true" />
      {pending ? "Saindo…" : "Sair"}
    </Button>
  );
}
