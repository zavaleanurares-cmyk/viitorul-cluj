"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { redeemLink } from "@/lib/auth-actions";
import { useT } from "@/messages";

export function LinkForm({ token }: { token: string }) {
  const t = useT().auth.confirm;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : t.invalid);
  return (
    <div className="w-full max-w-xs space-y-3">
      <FormError>{error}</FormError>
      {error ? (
        <Link href="/parola-uitata" className="inline-flex h-12 items-center font-semibold underline">
          {t.askNew}
        </Link>
      ) : (
        <Button
          size="lg"
          className="w-full"
          pending={pending}
          onClick={async () => {
            setPending(true);
            const res = await redeemLink({ token });
            if (res.ok) return window.location.assign(res.data.to);
            setError(res.error);
            setPending(false);
          }}
        >
          {t.submit}
        </Button>
      )}
    </div>
  );
}
