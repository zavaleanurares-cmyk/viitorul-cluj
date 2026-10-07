"use client";
import { useState } from "react";
import { saveContact } from "@/app/(app)/profil/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export type ContactValues = { phone: string; email: string; guardianName: string; guardianPhone: string; guardianEmail: string };

/** Datele de contact ale jucătorului; pentru minori, și ale părintelui / tutorelui. */
export function ContactForm({ initial, minor }: { initial: ContactValues; minor: boolean }) {
  const t = useT().player.contact;
  const [v, setV] = useState(initial);
  const save = useAction(saveContact);
  const set = (k: keyof ContactValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV((old) => ({ ...old, [k]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(v);
      }}
    >
      <Field label={t.phone} optional>
        <Input type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={v.phone} onChange={set("phone")} />
      </Field>
      <Field label={t.email} optional hint={t.emailHint}>
        <Input type="email" inputMode="email" autoComplete="email" maxLength={200} value={v.email} onChange={set("email")} />
      </Field>
      {minor ? (
        <fieldset className="space-y-4 border-t border-line pt-4">
          <legend className="float-left mb-3 w-full text-lg font-bold">{t.guardianTitle}</legend>
          <Field label={t.guardianName} optional className="clear-both">
            <Input autoComplete="off" maxLength={120} value={v.guardianName} onChange={set("guardianName")} />
          </Field>
          <Field label={t.guardianPhone} optional>
            <Input type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={v.guardianPhone} onChange={set("guardianPhone")} />
          </Field>
          <Field label={t.guardianEmail} optional>
            <Input type="email" inputMode="email" autoComplete="off" maxLength={200} value={v.guardianEmail} onChange={set("guardianEmail")} />
          </Field>
        </fieldset>
      ) : null}
      <FormError>{save.error}</FormError>
      <Button type="submit" pending={save.pending} className="w-full sm:w-auto">{t.save}</Button>
    </form>
  );
}
