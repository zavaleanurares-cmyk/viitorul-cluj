"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SESSION_TYPES } from "@club/shared";
import { saveSession } from "@/app/(app)/fizic/actions";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { METRIC_KEYS, SESSION_TYPE_CODES, parseDecimal, type MetricKey, type MetricValues } from "./domain";

type Texts = Record<MetricKey, string>;
export type EditorPlayer = { id: string; name: string; group_id: string | null };
export type EditorSession = {
  id: string; group_id: string | null; session_date: string; session_type: string; name: string; duration_min: number | null;
};

const emptyTexts = () => Object.fromEntries(METRIC_KEYS.map((k) => [k, ""])) as Texts;
const toTexts = (v: MetricValues) => Object.fromEntries(METRIC_KEYS.map((k) => [k, v[k] === null ? "" : String(v[k]).replace(".", ",")])) as Texts;

/** Formular tabelar: antetul sesiunii + un rând pe jucător, cu câte un câmp pentru fiecare indicator. */
export function SessionEditor({ session, groups, defaultGroupId, players, existing, today, backHref }: {
  session: EditorSession | null;
  groups: Array<{ id: string; name: string }>;
  defaultGroupId: string | null;
  players: EditorPlayer[];
  existing: Record<string, MetricValues>;
  today: string;
  backHref: string;
}) {
  const t = useT().physical;
  const ed = t.editor;
  const router = useRouter();
  const [groupId, setGroupId] = useState<string | null>(session ? session.group_id : defaultGroupId);
  const [date, setDate] = useState(session?.session_date ?? today);
  const [type, setType] = useState(session?.session_type ?? "training");
  const [name, setName] = useState(session?.name ?? "");
  const [duration, setDuration] = useState(session?.duration_min ? String(session.duration_min) : "");
  const [values, setValues] = useState<Record<string, Texts>>(() =>
    Object.fromEntries(Object.entries(existing).map(([id, v]) => [id, toTexts(v)])),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction(saveSession, { refresh: false, onSuccess: (d) => router.push(`/fizic/sesiuni/${d.id}`) });

  // rândurile: jucătorii grupei alese + cei care au deja valori în sesiune
  const rows = useMemo(
    () => players.filter((p) => (groupId && p.group_id === groupId) || existing[p.id]),
    [players, groupId, existing],
  );
  const cell = (playerId: string, key: MetricKey) => values[playerId]?.[key] ?? "";
  const setCell = (playerId: string, key: MetricKey, text: string) =>
    setValues((old) => ({ ...old, [playerId]: { ...(old[playerId] ?? emptyTexts()), [key]: text } }));
  const invalid = (text: string) => Number.isNaN(parseDecimal(text));
  const filledRows = rows.filter((p) => METRIC_KEYS.some((k) => cell(p.id, k).trim())).length;

  const submit = () => {
    setProblem(null);
    const dur = parseDecimal(duration);
    if (Number.isNaN(dur) || (dur !== null && !Number.isInteger(dur))) return setProblem(ed.badDuration);
    if (rows.some((p) => METRIC_KEYS.some((k) => invalid(cell(p.id, k))))) return setProblem(ed.badValues);
    if (!session && !filledRows) return setProblem(ed.noRows);
    save.run({
      id: session?.id ?? null,
      groupId,
      date,
      type: type as (typeof SESSION_TYPE_CODES)[number],
      name,
      durationMin: dur,
      rows: rows.map((p) => ({
        playerId: p.id,
        values: Object.fromEntries(METRIC_KEYS.map((k) => [k, parseDecimal(cell(p.id, k))])) as MetricValues,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_10rem]">
        <Field label={ed.group}>
          <Select value={groupId ?? ""} onChange={(e) => setGroupId(e.target.value || null)}>
            {session && !session.group_id ? <option value="">{ed.noGroup}</option> : null}
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label={ed.date}>
          <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={ed.type}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {SESSION_TYPE_CODES.map((c) => <option key={c} value={c}>{SESSION_TYPES[c]}</option>)}
          </Select>
        </Field>
        <Field label={ed.name} optional>
          <Input value={name} maxLength={120} placeholder={ed.namePlaceholder} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={ed.duration} optional>
          <Input inputMode="numeric" value={duration} aria-invalid={invalid(duration) || undefined} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>

      {rows.length ? (
        <>
          <p className="text-sm text-ink-3">{ed.hint}</p>
          <TableWrap>
            <caption className="sr-only">{ed.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 min-w-28 max-w-36 border-r border-line bg-canvas px-2! md:max-w-none md:px-3!">{t.session.player}</th>
                {METRIC_KEYS.map((k) => (
                  <th key={k} scope="col" className="px-1! text-center leading-tight" title={t.metrics[k].label}>
                    {t.metrics[k].short}
                    <span className="block text-2xs font-normal">{t.metrics[k].unit}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="sticky left-0 z-10 min-w-28 max-w-36 border-r border-line bg-surface px-2! py-1! border-t border-line text-base! font-semibold! text-ink! md:max-w-none md:px-3!">
                    <span className="block truncate" title={p.name}>{p.name}</span>
                  </th>
                  {METRIC_KEYS.map((k) => {
                    const text = cell(p.id, k);
                    return (
                      <td key={k} className="px-0.5! py-1!">
                        <input
                          inputMode="decimal"
                          aria-label={`${p.name}: ${t.metrics[k].label}`}
                          aria-invalid={invalid(text) || undefined}
                          value={text}
                          onChange={(e) => setCell(p.id, k, e.target.value)}
                          className={cn(
                            "block h-11 w-16 rounded-md border border-line-strong bg-surface px-1.5 text-right text-ink",
                            "aria-[invalid=true]:border-2 aria-[invalid=true]:border-st-red",
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)] p-6 text-center text-ink-3">{ed.noPlayers}</p>
      )}

      <FormError>{problem ?? save.error}</FormError>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-ink-3">{ed.filled(filledRows, rows.length)}</span>
        <LinkButton href={backHref}>{ed.cancel}</LinkButton>
        <Button pending={save.pending} onClick={submit}>{session ? ed.saveEdit : ed.saveNew}</Button>
      </div>
    </div>
  );
}
