"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { addCaseNote, deleteCaseNote } from "@/app/(app)/cazuri/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { ConfirmDialog } from "./confirm-dialog";

export type CaseNote = { id: string; note: string; when: string; mine: boolean };

/** Notele partenerului medical pe un caz: adaugă și își poate șterge propriile note. */
export function CaseNotes({ referralId, notes }: { referralId: string; notes: CaseNote[] }) {
  const t = useT().partner;
  const c = useT().common;
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState<CaseNote | null>(null);
  const add = useAction(addCaseNote, { onSuccess: () => setText("") });
  const remove = useAction(deleteCaseNote, { onSuccess: () => setDeleting(null) });

  return (
    <Card>
      <CardHeader title={t.notesTitle} description={t.notesDescription} />
      <CardBody className="space-y-4">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); add.run({ referralId, note: text }); }}>
          <Field label={t.noteLabel}>
            <Textarea rows={3} maxLength={4000} value={text} placeholder={t.notePlaceholder} onChange={(e) => setText(e.target.value)} />
          </Field>
          <FormError>{add.error}</FormError>
          <div className="flex justify-end">
            <Button type="submit" pending={add.pending} disabled={text.trim().length < 2}>{t.noteAdd}</Button>
          </div>
        </form>
        {notes.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{n.note}</p>
                  <p className="mt-0.5 text-sm text-ink-3">{n.when}</p>
                </div>
                {n.mine ? (
                  <IconButton label={t.noteDelete} className="-my-1 size-10 text-ink-3" onClick={() => setDeleting(n)}>
                    <Trash2 className="size-5" aria-hidden />
                  </IconButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-3">{t.notesEmpty}</p>
        )}
      </CardBody>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t.noteDeleteTitle}
        confirmLabel={c.actions.delete}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => deleting && remove.run({ id: deleting.id })}
      >
        {deleting ? <p className="line-clamp-3">{deleting.note}</p> : null}
      </ConfirmDialog>
    </Card>
  );
}
