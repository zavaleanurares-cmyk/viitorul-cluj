"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { signIn } from "@/lib/auth-actions";
import { useT } from "@/messages";

export function SignInForm({ next }: { next: string | null }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn({ email: email.trim(), password, next });
    if (res.ok) {
      // navigare completă: pagina următoare pornește cu sesiunea nouă
      window.location.assign(res.data.to);
      return;
    }
    setError(res.error);
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label={t.common.fields.email}>
        <Input type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t.common.fields.password}>
        <Input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" pending={pending} disabled={!email || !password}>
        {t.auth.signIn.submit}
      </Button>
      <p className="text-center">
        <Link href="/parola-uitata" className="inline-flex h-12 items-center font-semibold underline">
          {t.auth.signIn.forgot}
        </Link>
      </p>
    </form>
  );
}
