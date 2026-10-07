"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRAM_KINDS } from "@club/shared";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { saveProgram, type ProgramInput } from "@/app/(app)/programe/actions";
import { ItemsEditor } from "./items-editor";
import { SaveBar, useUnsavedWarning } from "./save-bar";
import { itemFromRow, itemProblem, itemToPayload, type ExerciseOption, type ItemRow } from "./types";

type ProgramValues = { id: string; name: string; description: string | null; kind: string; is_template: boolean };

/** Editorul unui program: detalii + lista de exerciții cu parametri. */
export function ProgramEditor({ program, items: rows, exercises }: {
  program: ProgramValues | null;
  items: ItemRow[];
  exercises: ExerciseOption[];
}) {
  const t = useT().planning;
  const f = t.programs.form;
  const router = useRouter();
  const [v, setV] = useState(() => ({
    name: program?.name ?? "",
    description: program?.description ?? "",
    kind: program?.kind ?? "prevention",
    is_template: program?.is_template ?? false,
  }));
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));
  const [items, setItems] = useState(() => rows.map((r) => itemFromRow(r)));
  const [problem, setProblem] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);

  const payload = useMemo(() => JSON.stringify({ ...v, items: items.map(itemToPayload) }), [v, items]);
  const [baseline] = useState(payload);
  const dirty = payload !== baseline;
  useUnsavedWarning(dirty);

  const save = useAction(saveProgram, {
    successMessage: program ? f.saved : f.created,
    refresh: !!program,
    onSuccess: (data) => { if (data.created) router.push(`/programe/${data.id}`); },
  });

  const submit = async () => {
    setProblem(null);
    save.clearError();
    if (!v.name.trim()) return setProblem(f.nameRequired);
    if (!items.length) return setProblem(f.itemsRequired);
    if (items.some((i) => itemProblem(i))) {
      setShowProblems(true);
      return setProblem(t.items.fixProblems);
    }
    await save.run({
      id: program?.id ?? null,
      name: v.name,
      description: v.description,
      kind: v.kind as ProgramInput["kind"],
      is_template: v.is_template,
      items: items.map(itemToPayload),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={f.details} />
        <CardBody className="space-y-4">
          <Field label={f.name}>
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder={f.namePlaceholder} required autoComplete="off" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label={f.kind}>
              <Select value={v.kind} onChange={(e) => set({ kind: e.target.value })}>
                {Object.entries(PROGRAM_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label={f.description} optional>
              <Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} rows={2} placeholder={f.descriptionPlaceholder} />
            </Field>
          </div>
          <Checkbox label={f.isTemplate} description={f.isTemplateHint} checked={v.is_template} onChange={(e) => set({ is_template: e.target.checked })} />
        </CardBody>
      </Card>

      <section aria-labelledby="program-items">
        <h2 id="program-items" className="mb-2 text-lg">{f.exercises} <span className="font-normal text-ink-3">({items.length})</span></h2>
        <ItemsEditor items={items} onChange={setItems} exercises={exercises} showProblems={showProblems} />
      </section>

      <FormError>{problem ?? save.error}</FormError>
      <SaveBar note={dirty && !save.pending ? f.unsaved : null}>
        <Button pending={save.pending} disabled={!!program && !dirty} onClick={() => void submit()} className="w-full sm:w-auto">{program ? f.save : f.create}</Button>
      </SaveBar>
    </div>
  );
}
