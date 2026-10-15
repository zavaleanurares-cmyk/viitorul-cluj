"use client";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import {
  buildFixtures, buildStandings, guessFixtureMapping, guessStandingMapping, parsePastedTable,
  type FixtureField, type StandingField,
} from "@club/shared";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { loadFile } from "@/components/imports/read-file";
import { importFixtures, importStandings } from "@/app/(app)/program/actions";

const FIXTURE_FIELDS: FixtureField[] = ["round", "date", "time", "home", "away", "venue", "score"];
const STANDING_FIELDS: StandingField[] = ["position", "team", "played", "won", "drawn", "lost", "goals", "goalsFor", "goalsAgainst", "points"];

/** Import din lista federației: lipire sau fișier → potrivirea coloanelor → previzualizare → confirmare. */
export function ImportWizard({ mode, competitionId, ownName, timezone, label }: {
  mode: "fixtures" | "standings"; competitionId: string; ownName: string; timezone: string; label: string;
}) {
  const m = useT();
  const t = m.schedule.import;
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<unknown[][]>([]);
  const [text, setText] = useState("");
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [defaultTime, setDefaultTime] = useState("11:00");
  const [fileError, setFileError] = useState<string | null>(null);
  const fixtures = useAction(importFixtures, { successMessage: false, onSuccess: (r) => { setOpen(false); toastDone(t.done(r.created, r.updated)); } });
  const standings = useAction(importStandings, { successMessage: false, onSuccess: (n) => { setOpen(false); toastDone(t.doneStandings(n)); } });
  const [done, setDone] = useState<string | null>(null);
  const toastDone = (msg: string) => setDone(msg);

  const headers = (table[0] ?? []).map((h) => String(h ?? ""));
  const body = table.slice(1);
  const fields = mode === "fixtures" ? FIXTURE_FIELDS : STANDING_FIELDS;
  const applyTable = (rows: unknown[][]) => {
    setTable(rows);
    const h = (rows[0] ?? []).map((x) => String(x ?? ""));
    setMapping(mode === "fixtures" ? guessFixtureMapping(h) : guessStandingMapping(h));
  };

  const preview = useMemo(() => {
    if (!body.length) return null;
    if (mode === "fixtures") return { kind: "fixtures" as const, ...buildFixtures(body, mapping, { ownName, defaultTime, timezone }) };
    return { kind: "standings" as const, rows: buildStandings(body, mapping) };
  }, [body, mapping, mode, ownName, defaultTime, timezone]);

  const reasons = { noDate: t.noDate, badDate: t.badDate, noTeams: t.noTeams } as const;

  return (
    <>
      <Button variant="secondary" icon={<Upload className="size-5" aria-hidden />} onClick={() => { setOpen(true); setDone(null); }}>{label}</Button>
      {done ? <Notice tone="green" className="mt-2" title={done} /> : null}
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "fixtures" ? t.title : t.standingsTitle} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{m.common.actions.cancel}</Button>
          {preview?.kind === "fixtures" ? (
            <Button variant="primary" disabled={!preview.payload.length} pending={fixtures.pending}
              onClick={() => fixtures.run({ competitionId, rows: preview.payload })}>{t.confirm(preview.payload.length)}</Button>
          ) : preview?.kind === "standings" ? (
            <Button variant="primary" disabled={!preview.rows.length} pending={standings.pending}
              onClick={() => standings.run({ competitionId, rows: preview.rows })}>{t.confirmStandings(preview.rows.length)}</Button>
          ) : null}
        </>}>
        <p className="mb-3 text-ink-2">{t.intro}</p>
        {mode === "fixtures" && !ownName ? <Notice tone="yellow" title={t.ownNameMissing} className="mb-3" /> : null}

        <Field label={t.paste}>
          <Textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); applyTable(parsePastedTable(e.target.value)); }}
            placeholder={mode === "fixtures" ? "Etapa\tData\tOra\tGazde\tOaspeți" : "Loc\tEchipa\tJ\tV\tE\tÎ\tGolaveraj\tPct"} />
        </Field>
        <label className="mt-2 inline-flex h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-border-control bg-surface px-4 font-semibold hover:bg-canvas">
          <Upload className="size-5" aria-hidden /> {t.file}
          <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const res = await loadFile(f);
            if (!res.ok) { setFileError(res.problem); return; }
            setFileError(null);
            applyTable(res.file.sheets[0]?.data ?? []);
          }} />
        </label>
        {fileError ? (
          <Notice tone="red" className="mt-2" title={m.imports.file.problems[fileError as keyof typeof m.imports.file.problems].title}>
            {m.imports.file.problems[fileError as keyof typeof m.imports.file.problems].body}
          </Notice>
        ) : null}

        {headers.length ? (
          <section className="mt-4">
            <h3 className="mb-2 text-base">{t.columns}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map((f) => (
                <Field key={f} label={t.map[f]} optional>
                  <Select value={mapping[f] ?? ""} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                    <option value="">{t.ignore}</option>
                    {headers.map((h, i) => <option key={i} value={i}>{t.column(h || String(i + 1))}</option>)}
                  </Select>
                </Field>
              ))}
              {mode === "fixtures" ? (
                <Field label={t.defaultTime}><Input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} /></Field>
              ) : null}
            </div>
          </section>
        ) : null}

        {preview?.kind === "fixtures" ? (
          <section className="mt-4 space-y-2" aria-live="polite">
            <h3 className="text-base">{t.preview}</h3>
            <p className="text-sm text-ink-2">{t.ours}: <strong>{preview.ours.length}</strong> · {t.notOurs}: {preview.others}</p>
            {preview.ours.length ? (
              <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line text-sm">
                {preview.ours.slice(0, 40).map((o) => (
                  <li key={o.line} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span className="font-semibold">{o.home} – {o.away}{o.score ? ` · ${o.score[0]}–${o.score[1]}` : ""}</span>
                    <span className="tabular-nums text-ink-2">{o.round ? `${m.schedule.roundShort(o.round)} · ` : ""}{o.date.split("-").reverse().join(".")} {o.time}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.invalid.length ? (
              <Notice tone="yellow" title={t.invalid}>
                <ul>{preview.invalid.slice(0, 10).map((x) => <li key={x.line}>{t.invalidRow(x.line + 1, reasons[x.reason])}</li>)}</ul>
              </Notice>
            ) : null}
          </section>
        ) : preview?.kind === "standings" ? (
          <section className="mt-4" aria-live="polite">
            <h3 className="mb-2 text-base">{t.preview}</h3>
            <ol className="divide-y divide-line rounded-[var(--radius-control)] border border-line text-sm">
              {preview.rows.map((r) => (
                <li key={r.position} className="flex justify-between gap-2 px-3 py-2">
                  <span><span className="tabular-nums text-ink-3">{r.position}.</span> <strong>{r.team}</strong></span>
                  <span className="tabular-nums">{r.points ?? "—"}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        <FormError>{fixtures.error ?? standings.error}</FormError>
      </Dialog>
    </>
  );
}
