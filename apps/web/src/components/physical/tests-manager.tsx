"use client";
import { useState } from "react";
import { Pencil, Plus, Settings2 } from "lucide-react";
import { saveTest, setTestActive } from "@/app/(app)/fizic/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export type ManagedTest = { id: string; name: string; unit: string; lower_is_better: boolean; is_active: boolean };
type Draft = { id: string | null; name: string; unit: string; lowerIsBetter: boolean };

/** Definirea testelor clubului: nume, unitate, „mai mic = mai bine"; dezactivarea le ascunde din liste. */
export function TestsManager({ tests }: { tests: ManagedTest[] }) {
  const t = useT().physical.manage;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useAction(saveTest, { onSuccess: () => setDraft(null) });
  const toggle = useAction(setTestActive, { successMessage: false });

  return (
    <>
      <Button variant="secondary" icon={<Settings2 className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.open}</Button>
      <Dialog open={open} onClose={() => { setOpen(false); setDraft(null); }} title={t.title}>
        <div className="space-y-4">
          {draft ? (
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); save.run(draft); }}
            >
              <p className="text-lg font-bold">{draft.id ? t.editTitle : t.addTitle}</p>
              <Field label={t.name}>
                <Input value={draft.name} maxLength={60} required placeholder={t.namePlaceholder} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label={t.unit} hint={t.unitHint}>
                <Input value={draft.unit} maxLength={12} required onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
              </Field>
              <Checkbox label={t.lower} description={t.lowerHint} checked={draft.lowerIsBetter} onChange={(e) => setDraft({ ...draft, lowerIsBetter: e.target.checked })} />
              <FormError>{save.error}</FormError>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDraft(null)}>{c.actions.cancel}</Button>
                <Button type="submit" pending={save.pending}>{t.save}</Button>
              </div>
            </form>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {tests.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {x.name}
                        {!x.is_active ? <Badge tone="outline">{t.inactive}</Badge> : null}
                      </p>
                      <p className="text-sm text-ink-3">{x.unit} · {x.lower_is_better ? t.lowerShort : t.higherShort}</p>
                    </div>
                    <IconButton label={t.edit(x.name)} onClick={() => setDraft({ id: x.id, name: x.name, unit: x.unit, lowerIsBetter: x.lower_is_better })}>
                      <Pencil className="size-5" aria-hidden />
                    </IconButton>
                    <Button variant="secondary" size="sm" className="h-12" pending={toggle.pending} onClick={() => toggle.run({ id: x.id, active: !x.is_active })}>
                      {x.is_active ? t.deactivate : t.activate}
                    </Button>
                  </li>
                ))}
              </ul>
              {!tests.length ? <p className="text-ink-3">{t.empty}</p> : null}
              <FormError>{toggle.error}</FormError>
              <p className="text-sm text-ink-3">{t.hint}</p>
              <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setDraft({ id: null, name: "", unit: "", lowerIsBetter: false })}>{t.add}</Button>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
