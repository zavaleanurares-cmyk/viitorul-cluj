"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { requestPasswordReset } from "@/lib/auth-actions";
import { useT } from "@/messages";

export function ForgotForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        await requestPasswordReset({ email: email.trim() });
        setPending(false);
        setSent(true);
      }}
    >
      {sent ? (
        <Notice tone="green">{t.auth.forgot.sent}</Notice>
      ) : (
        <>
          <Field label={t.common.fields.email}>
            <Input type="email" autoComplete="username" inputMode="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" pending={pending} disabled={!email}>
            {t.auth.forgot.submit}
          </Button>
        </>
      )}
      <p className="text-center">
        <Link href="/autentificare" className="inline-flex h-12 items-center font-semibold underline">
          {t.auth.forgot.back}
        </Link>
      </p>
    </form>
  );
}
