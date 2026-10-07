"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { acceptConsent, signOut } from "@/lib/auth-actions";
import { useT } from "@/messages";

export function ConsentForm({ minor, acceptLabel }: { minor: boolean; acceptLabel: string }) {
  const t = useT().auth.consent;
  const [guardianName, setGuardianName] = useState("");
  const [relation, setRelation] = useState("mother");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-6 space-y-4">
      {minor ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label={t.guardianName}>
            <Input autoComplete="name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
          </Field>
          <Field label={t.guardianRelation}>
            <Select value={relation} onChange={(e) => setRelation(e.target.value)}>
              <option value="mother">{t.relations.mother}</option>
              <option value="father">{t.relations.father}</option>
              <option value="guardian">{t.relations.guardian}</option>
            </Select>
          </Field>
        </div>
      ) : null}
      <FormError>{error}</FormError>
      <Button
        size="lg"
        className="w-full"
        pending={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await acceptConsent({ guardianName, guardianRelation: relation });
          if (res.ok) return window.location.assign(res.data.to);
          setError(res.error);
          setPending(false);
        }}
      >
        {acceptLabel}
      </Button>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full">
          {t.decline}
        </Button>
      </form>
    </div>
  );
}
