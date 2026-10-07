"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteTestResult, saveTestResult } from "@/app/(app)/fizic/actions";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { parseDecimal } from "./domain";

/** Preparatorul adaugă un rezultat de test pentru un jucător. */
export function AddResultButton({ player, tests, today }: {
  player: { id: string; name: string }; tests: Array<{ id: string; name: string; unit: string }>; today: string;
}) {
  const t = useT().physical.addResult;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [testId, setTestId] = useState(tests[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction(saveTestResult, { onSuccess: () => { setOpen(false); setValue(""); setNotes(""); } });
  const test = tests.find((x) => x.id === testId);

  const submit = () => {
    setProblem(null);
    const n = parseDecimal(value);
    if (n === null || Number.isNaN(n) || n <= 0) return setProblem(t.badValue);
    save.run({ testId, playerId: player.id, date, value: n, notes: notes.trim() || null });
  };

  return (
    <>
      <Button icon={<Plus className="size-5" aria-hidden />} disabled={!tests.length} onClick={() => setOpen(true)}>{t.open}</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
            <Button pending={save.pending} disabled={!testId || !date} onClick={submit}>{t.save}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-lg font-bold">{player.name}</p>
          <Field label={t.test}>
            <Select value={testId} onChange={(e) => setTestId(e.target.value)}>
              {tests.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.date}>
              <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={test ? t.valueIn(test.unit) : t.value}>
              <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
          </div>
          <Field label={t.notes} optional>
            <Input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <p className="text-sm text-ink-3">{t.hint}</p>
          <FormError>{problem ?? save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteResultButton({ id, label, text }: { id: string; label: string; text: string }) {
  const t = useT().physical.addResult;
  const [open, setOpen] = useState(false);
  const remove = useAction(deleteTestResult, { onSuccess: () => setOpen(false) });
  return (
    <>
      <IconButton label={label} className="size-10" onClick={() => setOpen(true)}><Trash2 className="size-4" aria-hidden /></IconButton>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => remove.run({ id })}
      >
        {text}
      </ConfirmDialog>
    </>
  );
}
