"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { setPassword } from "@/lib/auth-actions";
import { useT } from "@/messages";

export function PasswordForm({ needsCurrent }: { needsCurrent: boolean }) {
  const t = useT().auth.password;
  const [password, setPw] = useState("");
  const [repeat, setRepeat] = useState("");
  const [current, setCurrent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await setPassword({ password, repeat, current });
        if (res.ok) return window.location.assign(res.data.to);
        setError(res.error);
        setPending(false);
      }}
    >
      {needsCurrent ? (
        <Field label={t.current}>
          <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
      ) : null}
      <Field label={t.new} hint={t.rules}>
        <Input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label={t.repeat}>
        <Input type="password" autoComplete="new-password" minLength={10} required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </Field>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" className="w-full" pending={pending} disabled={!password || !repeat}>
        {t.submit}
      </Button>
    </form>
  );
}
