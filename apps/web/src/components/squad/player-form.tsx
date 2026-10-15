"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { savePlayer, setPlayerActive, type PlayerInput } from "@/app/(app)/lot/actions";

type Team = { id: string; name: string };

export function PlayerForm({ initial, teams, isActive }: { initial: PlayerInput; teams: Team[]; isActive?: boolean }) {
  const t = useT().squad;
  const f = t.player.fields;
  const router = useRouter();
  const [v, setV] = useState<PlayerInput>(initial);
  const set = <K extends keyof PlayerInput>(k: K, value: PlayerInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const save = useAction(savePlayer, { onSuccess: (r) => router.push(`/lot/jucatori/${r.id}`) });
  const toggle = useAction(setPlayerActive);

  return (
    <form className="mx-auto max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); save.run(v); }}>
      <Card>
        <CardHeader title={t.form.identity} />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <Field label={f.fullName} className="md:col-span-2">
            <Input value={v.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="off" required />
          </Field>
          <Field label={f.displayName} hint={f.displayNameHint} optional>
            <Input value={v.displayName ?? ""} onChange={(e) => set("displayName", e.target.value)} />
          </Field>
          <Field label={f.birthDate} optional>
            <Input type="date" value={v.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>
          <Field label={f.nationality} optional>
            <Input value={v.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} placeholder="română" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.form.football} />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <Field label={f.team}>
            <Select value={v.groupId ?? ""} onChange={(e) => set("groupId", e.target.value)}>
              <option value="">{t.list.noTeam}</option>
              {teams.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={f.shirt} optional>
            <Input inputMode="numeric" value={String(v.shirt ?? "")} onChange={(e) => set("shirt", e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field label={f.position} optional>
            <Select value={v.position ?? ""} onChange={(e) => set("position", e.target.value as PlayerInput["position"])}>
              <option value="">{t.form.choose}</option>
              {Object.entries(t.player.positions).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
          <Field label={f.positionDetail} optional>
            <Input value={v.positionDetail ?? ""} onChange={(e) => set("positionDetail", e.target.value)} placeholder="fundaș dreapta" />
          </Field>
          <Field label={f.foot} optional>
            <Select value={v.foot ?? ""} onChange={(e) => set("foot", e.target.value as PlayerInput["foot"])}>
              <option value="">{t.form.choose}</option>
              {Object.entries(t.player.foot).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.form.documents} />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <Field label={f.visa} optional>
            <Input type="date" value={v.visa ?? ""} onChange={(e) => set("visa", e.target.value)} />
          </Field>
          <Field label={f.enrolledOn} optional>
            <Input type="date" value={v.enrolledOn ?? ""} onChange={(e) => set("enrolledOn", e.target.value)} />
          </Field>
          <Field label={f.registration} optional>
            <Input value={v.registration ?? ""} onChange={(e) => set("registration", e.target.value)} />
          </Field>
          <Field label={f.fifaId} optional>
            <Input value={v.fifaId ?? ""} onChange={(e) => set("fifaId", e.target.value)} />
          </Field>
          <Checkbox className="md:col-span-2" checked={v.photoConsent} onChange={(e) => set("photoConsent", e.target.checked)}
            label={f.photoConsent} description={f.photoConsentText} />
        </CardBody>
      </Card>

      <FormError>{save.error}</FormError>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {v.id ? (
          <Button variant="ghost" pending={toggle.pending} onClick={() => toggle.run({ id: v.id!, active: !isActive })}>
            {isActive ? t.form.deactivate : t.form.reactivate}
          </Button>
        ) : <span />}
        <Button type="submit" variant="primary" pending={save.pending}>{v.id ? t.form.save : t.form.create}</Button>
      </div>
    </form>
  );
}
