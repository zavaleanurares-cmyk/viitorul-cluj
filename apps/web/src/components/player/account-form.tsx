"use client";
import { useState } from "react";
import { updateAccount } from "@/app/(app)/profil/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

/** Datele contului: nume, telefon (doar staff — jucătorul îl are la datele de contact), notificări pe e-mail. */
export function AccountForm({ fullName, email, phone, emailNotifications, showPhone }: {
  fullName: string; email: string | null; phone: string | null; emailNotifications: boolean; showPhone: boolean;
}) {
  const t = useT().player.account;
  const [name, setName] = useState(fullName);
  const [tel, setTel] = useState(phone ?? "");
  const [notify, setNotify] = useState(emailNotifications);
  const save = useAction(updateAccount);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({ fullName: name, phone: showPhone ? tel : null, emailNotifications: notify });
      }}
    >
      <Field label={t.name}>
        <Input value={name} autoComplete="name" maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t.email} hint={t.emailHint}>
        <Input value={email ?? ""} readOnly disabled />
      </Field>
      {showPhone ? (
        <Field label={t.phone} optional>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={tel} maxLength={30} onChange={(e) => setTel(e.target.value)} />
        </Field>
      ) : null}
      <Checkbox label={t.emailNotifications} description={t.emailNotificationsHint} checked={notify} onChange={(e) => setNotify(e.target.checked)} />
      <FormError>{save.error}</FormError>
      <Button type="submit" pending={save.pending} className="w-full sm:w-auto">{t.save}</Button>
    </form>
  );
}
