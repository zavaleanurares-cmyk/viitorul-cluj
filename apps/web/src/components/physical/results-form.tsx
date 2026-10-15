"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@club/shared";
import { saveTestResults } from "@/app/(app)/fizic/actions";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { formatValue, parseDecimal } from "./domain";

export type ResultsPlayer = { id: string; name: string; current: number | null; previous: { value: number; tested_on: string } | null };

/**
 * Introducerea rapidă a unei testări pentru toată grupa: testul și data sus, apoi un câmp pe jucător.
 * Schimbarea grupei, a testului sau a datei reîncarcă pagina cu valorile deja salvate pentru acea zi.
 */
export function ResultsForm({ groups, groupId, tests, testId, date, today, players, backHref }: {
  groups: Array<{ id: string; name: string }>; groupId: string;
  tests: Array<{ id: string; name: string; unit: string; lower_is_better: boolean }>; testId: string;
  date: string; today: string; players: ResultsPlayer[]; backHref: string;
}) {
  const t = useT().physical.results;
  const router = useRouter();
  const test = tests.find((x) => x.id === testId);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, p.current === null ? "" : String(p.current).replace(".", ",")])),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction(saveTestResults);
  const go = (patch: { grupa?: string; test?: string; data?: string }) => {
    const q = new URLSearchParams({ grupa: groupId, test: testId, data: date, ...patch });
    router.replace(`/fizic/teste/rezultate?${q}`);
  };
  const invalid = (text: string) => {
    const n = parseDecimal(text);
    return Number.isNaN(n) || (n !== null && n <= 0);
  };
  const filled = players.filter((p) => (values[p.id] ?? "").trim()).length;

  const submit = () => {
    setProblem(null);
    if (players.some((p) => invalid(values[p.id] ?? ""))) return setProblem(t.badValues);
    save.run({ testId, date, rows: players.map((p) => ({ playerId: p.id, value: parseDecimal(values[p.id] ?? "") })) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.group}>
          <Select value={groupId} onChange={(e) => go({ grupa: e.target.value })}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label={t.test}>
          <Select value={testId} onChange={(e) => go({ test: e.target.value })}>
            {tests.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
          </Select>
        </Field>
        <Field label={t.date}>
          <Input type="date" value={date} max={today} onChange={(e) => e.target.value && go({ data: e.target.value })} />
        </Field>
      </div>
      <p className="text-sm text-ink-3">{test ? t.hint(test.unit, test.lower_is_better) : null}</p>

      {players.length ? (
        <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface md:mx-0 md:rounded-[var(--radius-card)] md:border">
          {players.map((p) => {
            const text = values[p.id] ?? "";
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-1.5">
                <label htmlFor={`r-${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-sm text-ink-3">
                    {p.previous ? t.previous(formatValue(p.previous.value), test?.unit ?? "", formatDateShort(p.previous.tested_on)) : t.noPrevious}
                  </span>
                </label>
                <input
                  id={`r-${p.id}`}
                  inputMode="decimal"
                  value={text}
                  aria-invalid={invalid(text) || undefined}
                  onChange={(e) => setValues((old) => ({ ...old, [p.id]: e.target.value }))}
                  className={cn(
                    "block h-12 w-24 shrink-0 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-right text-lg font-semibold text-ink",
                    "aria-[invalid=true]:border-2 aria-[invalid=true]:border-st-red",
                  )}
                />
                <span className="w-6 shrink-0 text-ink-3" aria-hidden>{test?.unit}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)] p-6 text-center text-ink-3">{t.noPlayers}</p>
      )}

      <FormError>{problem ?? save.error}</FormError>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-ink-3">{t.filled(filled, players.length)}</span>
        <LinkButton href={backHref}>{t.back}</LinkButton>
        <Button pending={save.pending} disabled={!players.length} onClick={submit}>{t.save}</Button>
      </div>
    </div>
  );
}
