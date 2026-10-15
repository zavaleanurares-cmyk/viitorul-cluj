"use client";
import { useState } from "react";
import { Check, Layers, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { addStandardBattery, createBattery, deleteBattery } from "@/app/(app)/fizic/teste/actions";
import { STANDARD_BATTERIES } from "./standard-batteries";

type Battery = { id: string; name: string; tests: string[] };

/** Bateriile clubului: cele gata făcute (un clic) și cele compuse din testele existente. */
export function BatteriesManager({ batteries, tests }: { batteries: Battery[]; tests: Array<{ id: string; name: string; unit: string }> }) {
  const t = useT().performance.tests;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const std = useAction(addStandardBattery);
  const create = useAction(createBattery, { onSuccess: () => { setName(""); setPicked([]); } });
  const del = useAction(deleteBattery);
  const has = new Set(batteries.map((b) => b.name));
  return (
    <>
      <Button variant="secondary" icon={<Layers className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.batteries}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.batteriesTitle} wide
        footer={<Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.close}</Button>}>
        <div className="space-y-5">
          <p className="text-ink-2">{t.batteriesHint}</p>
          {batteries.length ? (
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {batteries.map((b) => (
                <li key={b.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{b.name}</span>
                    <span className="block text-sm text-ink-3">{b.tests.join(", ")}</span>
                  </span>
                  <IconButton label={t.deleteBattery} onClick={() => del.run({ id: b.id })}><Trash2 className="size-5" aria-hidden /></IconButton>
                </li>
              ))}
            </ul>
          ) : <p className="text-ink-3">{t.noBatteries}</p>}

          <section className="space-y-2">
            <h3 className="font-semibold">{t.standard}</h3>
            <p className="text-sm text-ink-3">{t.standardHint}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {STANDARD_BATTERIES.map((b) => (
                <li key={b.key} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-3">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-sm text-ink-3">{b.tests.map((x) => x.name).join(", ")}</span>
                  {has.has(b.name) ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-st-green"><Check className="size-4" aria-hidden />{t.added}</span>
                  ) : (
                    <Button size="sm" variant="secondary" className="self-start" pending={std.pending} icon={<Plus className="size-4" aria-hidden />} onClick={() => std.run({ key: b.key })}>{t.add}</Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {tests.length ? (
            <section className="space-y-3">
              <h3 className="font-semibold">{t.custom}</h3>
              <Field label={t.name}><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
              <div className="flex flex-wrap gap-2">
                {tests.map((x) => {
                  const on = picked.includes(x.id);
                  return (
                    <button key={x.id} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((p) => p !== x.id) : [...picked, x.id])}
                      className={on ? "inline-flex h-10 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-surface" : "inline-flex h-10 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>
                      {on ? <Check className="size-4" aria-hidden /> : null}{x.name} ({x.unit})
                    </button>
                  );
                })}
              </div>
              <Button disabled={name.trim().length < 2 || !picked.length} pending={create.pending} onClick={() => create.run({ name, testIds: picked })}>{t.create}</Button>
            </section>
          ) : null}
          <FormError>{std.error ?? create.error ?? del.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
