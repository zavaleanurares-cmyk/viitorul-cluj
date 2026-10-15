"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import readXlsxFile from "read-excel-file/browser";
import { CircleCheck, FileSpreadsheet, FileX, TriangleAlert, Upload } from "lucide-react";
import {
  detectTfbFile, formatLei, monthLabel, packTfbBundle, parseCsv, parseTfbFiles,
  type CsvTable, type TfbBundle, type TfbDecisions, type TfbPacked,
} from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { useT } from "@/messages";
import { previewTfb, runTfb, type TfbPreview } from "@/app/(app)/import/tfb/actions";
import { Problems, Section, StatRow, StepNav, Stepper } from "./parts";

type Loaded = { name: string; rows: CsvTable | null; kind: string | null };
type Done = TfbPreview & { written: Record<string, number | string> };

const toCell = (c: unknown) => (c instanceof Date ? c.toISOString() : c === null || c === undefined ? "" : String(c));

async function readTfbFile(file: File): Promise<CsvTable | null> {
  try {
    if (/\.xlsx$/i.test(file.name)) {
      const sheets = await readXlsxFile(file);
      return (sheets[0]?.data ?? []).map((r) => (r ?? []).map(toCell));
    }
    if (/\.(csv|txt)$/i.test(file.name)) return parseCsv((await file.text()).replace(/^﻿/, ""));
  } catch {
    /* fișier stricat sau alt format */
  }
  return null;
}

/** Asistentul de migrare din TFB: fișiere → potriviri → verificare → import. */
export function TfbWizard({ today }: { today: string }) {
  const t = useT().tfb;
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [bundle, setBundle] = useState<TfbBundle | null>(null);
  const packed = useRef<TfbPacked | null>(null);
  const [preview, setPreview] = useState<TfbPreview | null>(null);
  const [decisions, setDecisions] = useState<TfbDecisions | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const out: Loaded[] = [];
    for (const f of Array.from(list)) {
      const rows = await readTfbFile(f);
      const kind = rows ? detectTfbFile(rows) : null;
      out.push({ name: f.name, rows, kind: kind ? (kind.kind === "payments" && kind.year ? `payments:${kind.year}` : kind.kind) : null });
    }
    setLoaded(out);
    const usable = out.filter((f) => f.rows && f.kind).map((f) => ({ name: f.name, rows: f.rows! }));
    const b = usable.length ? parseTfbFiles(usable, today) : null;
    setBundle(b);
    packed.current = b ? packTfbBundle(b) : null;
  };

  const check = (next: TfbDecisions | null, toStep: number) => {
    if (!packed.current) return;
    setError(null);
    start(async () => {
      const res = await previewTfb({ bundle: packed.current!, decisions: next });
      if (!res.ok) { setError(res.error); return; }
      setPreview(res.data);
      setDecisions(res.data.decisions);
      setStep(toStep);
      window.scrollTo({ top: 0 });
    });
  };

  const execute = () => {
    if (!packed.current || !decisions) return;
    setError(null);
    start(async () => {
      const res = await runTfb({ bundle: packed.current!, decisions });
      if (!res.ok) { setError(res.error); return; }
      setDone(res.data);
      setStep(3);
      window.scrollTo({ top: 0 });
    });
  };

  const hasPlayers = loaded.some((f) => f.kind === "roster" || f.kind === "player_teams");

  return (
    <div>
      <Stepper steps={[...t.steps]} current={step} label={t.stepsLabel} />
      {step === 0 ? (
        <FilesStep loaded={loaded} bundle={bundle} onChoose={choose} />
      ) : null}
      {step === 1 && preview && decisions && bundle ? (
        <MatchStep preview={preview} bundle={bundle} decisions={decisions} onChange={setDecisions} />
      ) : null}
      {step === 2 && preview ? <ReviewStep preview={preview} warnings={bundle?.warnings ?? []} /> : null}
      {step === 3 && done ? <DoneStep done={done} onAgain={() => { setStep(0); setDone(null); setPreview(null); }} /> : null}

      <Problems items={error ? [error] : []} />

      {step === 0 ? (
        <StepNav
          next={t.files.next} onNext={() => check(null, 1)} pending={pending}
          disabled={!bundle || !hasPlayers}
          hint={loaded.length && !hasPlayers ? t.files.missingRoster : undefined}
        />
      ) : null}
      {step === 1 ? (
        <StepNav back={t.steps[0]} onBack={() => setStep(0)} next={t.match.next} onNext={() => check(decisions, 2)} pending={pending} />
      ) : null}
      {step === 2 ? (
        <StepNav back={t.review.back} onBack={() => setStep(1)} next={t.review.run} onNext={execute} pending={pending} hint={t.review.runHint} final />
      ) : null}
    </div>
  );
}

function FilesStep({ loaded, bundle, onChoose }: { loaded: Loaded[]; bundle: TfbBundle | null; onChoose: (f: FileList | null) => void }) {
  const t = useT().tfb.files;
  const input = useRef<HTMLInputElement>(null);
  const kindLabel = (k: string | null) => {
    if (!k) return null;
    if (k.startsWith("payments:")) return `${t.kinds.payments} ${k.slice(9)}`;
    return t.kinds[k as keyof typeof t.kinds] ?? k;
  };
  const active = bundle?.players.filter((p) => p.active).length ?? 0;
  return (
    <div className="grid gap-5 lg:grid-cols-2 [&>section]:mt-0">
      <Section title={t.title} description={t.intro}>
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {t.expected.map(([name, what]) => (
            <li key={name} className="px-4 py-2">
              <span className="font-semibold">{name}</span>
              <span className="block text-sm text-ink-3">{what}</span>
            </li>
          ))}
        </ul>
        <input ref={input} type="file" multiple accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => onChoose(e.target.files)} />
        <Button className="mt-3 w-full md:w-auto" icon={<Upload className="size-5" aria-hidden />} onClick={() => input.current?.click()}>
          {t.choose}
        </Button>
      </Section>

      <Section title={t.found} description={loaded.length ? t.chosen(loaded.length) : undefined}>
        {loaded.length ? (
          <>
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {loaded.map((f) => (
                <li key={f.name} className="flex items-center gap-3 px-4 py-2">
                  {f.kind ? <FileSpreadsheet className="size-5 shrink-0 text-st-green" aria-hidden /> : <FileX className="size-5 shrink-0 text-st-red" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  {f.kind ? <Badge tone="green">{kindLabel(f.kind)}</Badge> : <Badge tone="red">{f.rows ? t.unknown : t.unreadable}</Badge>}
                </li>
              ))}
            </ul>
            {bundle ? (
              <div className="mt-3">
                <StatRow stats={[
                  { label: t.counts.teams, value: bundle.teams.length, tone: "green" },
                  { label: t.counts.players, value: active, tone: "green" },
                  { label: t.counts.former, value: bundle.players.length - active, tone: "gray" },
                  { label: t.counts.guardians, value: bundle.guardians.length, tone: "green" },
                  { label: t.counts.months, value: bundle.months.length, tone: "green" },
                  { label: t.counts.years, value: bundle.years.length, tone: "gray" },
                ]} />
                {bundle.warnings.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-ink-2">
                    {bundle.warnings.map((w) => (
                      <li key={w} className="flex items-start gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-st-orange" aria-hidden />{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onChoose(e.dataTransfer.files); }}
            className="flex min-h-40 w-full items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong p-6 text-center text-ink-3 hover:border-brand hover:bg-surface hover:text-ink lg:min-h-[22rem]"
          >
            <Upload className="mr-2 size-5" aria-hidden />{t.drop}
          </button>
        )}
      </Section>
    </div>
  );
}

function MatchStep({ preview, bundle, decisions, onChange }: {
  preview: TfbPreview; bundle: TfbBundle; decisions: TfbDecisions; onChange: (d: TfbDecisions) => void;
}) {
  const t = useT().tfb.match;
  const unclear = preview.proposals.players.filter((p) => !p.clear);
  const sure = preview.proposals.players.filter((p) => p.clear);
  const everyone = useMemo(
    () => [...bundle.players].sort((a, b) => a.fullName.localeCompare(b.fullName, "ro"))
      .map((p) => ({ key: p.key, label: `${p.fullName}${p.birthDate ? ` · ${p.birthDate.slice(0, 4)}` : ""}${p.teams[0] ? ` · ${p.teams[0]}` : ""}` })),
    [bundle],
  );
  const setPlayer = (id: string, key: string) => onChange({ ...decisions, players: { ...decisions.players, [id]: key } });

  return (
    <div>
      <Section title={t.groupsTitle} description={t.groupsText}>
        <ul className="grid gap-2 md:grid-cols-2">
          {preview.proposals.groups.map((g) => (
            <li key={g.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2">
              <label htmlFor={`g-${g.id}`} className="truncate font-semibold">{g.name}</label>
              <Select id={`g-${g.id}`} value={decisions.groups[g.id] ?? ""} onChange={(e) => onChange({ ...decisions, groups: { ...decisions.groups, [g.id]: e.target.value } })}>
                <option value="">{t.keep}</option>
                {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.playersTitle} description={unclear.length ? t.playersText(unclear.length) : t.playersAllClear}>
        {unclear.length ? (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {unclear.map((p) => (
              <li key={p.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-center">
                <label htmlFor={`p-${p.id}`} className="min-w-0">
                  <span className="font-semibold">{p.name}</span>
                  {p.group ? <span className="ml-2 text-sm text-ink-3">{p.group}</span> : null}
                </label>
                <Select id={`p-${p.id}`} value={decisions.players[p.id] ?? ""} onChange={(e) => setPlayer(p.id, e.target.value)}>
                  <option value="">{t.notInTfb}</option>
                  {p.candidates.length ? (
                    <optgroup label={t.suggested}>
                      {p.candidates.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </optgroup>
                  ) : null}
                  <optgroup label={t.allTfb}>
                    {everyone.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </optgroup>
                </Select>
              </li>
            ))}
          </ul>
        ) : null}
        {sure.length ? (
          <details className="mt-3 rounded-[var(--radius-card)] border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 font-semibold">
              <CircleCheck className="size-5 text-st-green" aria-hidden />{t.sure(sure.length)}
            </summary>
            <ul className="grid gap-x-6 border-t border-line px-4 py-2 text-sm md:grid-cols-2">
              {sure.map((p) => (
                <li key={p.id} className="flex min-w-0 justify-between gap-3 py-1">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="truncate text-ink-3">{p.candidates[0]?.label ?? p.suggested}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <Checkbox
          className="mt-3"
          label={t.deactivate} description={t.deactivateHint}
          checked={decisions.deactivateMissing}
          onChange={(e) => onChange({ ...decisions, deactivateMissing: e.target.checked })}
        />
      </Section>
    </div>
  );
}

function Numbers({ preview }: { preview: TfbPreview }) {
  const t = useT().tfb.review;
  const s = preview.summary;
  return (
    <StatRow className="md:grid-cols-5" stats={[
      { label: t.stats.groupsCreated, value: s.groupsCreated, tone: "green" },
      { label: t.stats.groupsRenamed, value: s.groupsRenamed, tone: "green" },
      { label: t.stats.playersCreated, value: s.playersCreated, tone: "green" },
      { label: t.stats.playersUpdated, value: s.playersUpdated, tone: "green" },
      { label: t.stats.playersInactive, value: s.playersInactive, tone: "gray" },
      { label: t.stats.playersDeactivated, value: s.playersDeactivated, tone: "orange" },
      { label: t.stats.guardiansCreated, value: s.guardiansCreated, tone: "green" },
      { label: t.stats.links, value: s.links, tone: "green" },
      { label: t.stats.charges, value: s.charges, tone: "green" },
      { label: t.stats.payments, value: s.payments, tone: "green" },
    ]} />
  );
}

/** Tabelele de reconciliere: echipe și bani pe luni. */
export function Reconciliation({ preview }: { preview: Pick<TfbPreview, "reconciliation"> }) {
  const t = useT().tfb.review;
  const r = preview.reconciliation;
  const months = [...r.months].sort((a, b) => b.period.localeCompare(a.period));
  const mark = (ok: boolean, label: string) => (ok
    ? <CircleCheck className="size-5 text-st-green" aria-label={t.ok} />
    : <TriangleAlert className="size-5 text-st-orange" aria-label={label} />);
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-2 [&>section]:mt-0 [&>section]:min-w-0">
      <Section title={t.teamsTitle} description={t.teamsText}>
        <p className="mb-2 text-sm font-semibold">{t.playersLine(r.playersTfb, r.playersAfter)}</p>
        <TableWrap className="max-h-[32rem] overflow-y-auto">
          <thead><tr>
            <th scope="col">{t.team}</th><th scope="col" className="text-right">{t.inTfb}</th>
            <th scope="col" className="text-right">{t.primary}</th><th scope="col" className="text-right">{t.alsoIn}</th><th scope="col"><span className="sr-only">{t.ok}</span></th>
          </tr></thead>
          <tbody className="tabular-nums">
            {r.teams.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td>
                <td className="text-right">{x.tfb ?? "—"}</td>
                <td className="text-right">{x.primary}</td>
                <td className="text-right text-ink-3">{x.alsoIn || "—"}</td>
                <td className="w-10">{mark(x.ok, t.diff(String(x.primary - (x.tfb ?? 0))))}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>
      <Section title={t.monthsTitle} description={t.monthsText}>
        <TableWrap className="max-h-[32rem] overflow-y-auto">
          <thead><tr>
            <th scope="col">{t.month}</th><th scope="col" className="text-right">{t.tfb}</th><th scope="col" className="text-right">{t.locker}</th><th scope="col"><span className="sr-only">{t.ok}</span></th>
          </tr></thead>
          <tbody className="tabular-nums">
            {months.map((m) => (
              <tr key={m.period}>
                <td className="whitespace-nowrap first-letter:uppercase">{monthLabel(m.period)}</td>
                <td className="text-right">{formatLei(m.tfb)}</td>
                <td className="text-right">{formatLei(m.locker)}</td>
                <td className="w-10">{mark(m.ok, t.diff(formatLei(m.locker - m.tfb, { sign: true })))}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
}

function ReviewStep({ preview, warnings }: { preview: TfbPreview; warnings: string[] }) {
  const t = useT().tfb.review;
  const s = preview.summary;
  return (
    <div>
      <Section title={t.title} description={t.money(formatLei(s.paidTotal), formatLei(s.dueTotal))}>
        <Numbers preview={preview} />
      </Section>
      <Notice tone="yellow" className="mt-4">{t.autoIssue}</Notice>
      <Reconciliation preview={preview} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>section]:mt-0">
        {s.multiTeam.length ? (
          <Section title={t.multiTitle(s.multiTeam.length)}>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface text-sm">
              {s.multiTeam.map((m) => (
                <li key={m.name} className="px-4 py-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="block text-ink-3">{m.primary} · {m.others.join(", ")}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        {s.staff.length ? (
          <Section title={t.staffTitle(s.staff.length)} description={t.staffText}>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface text-sm">
              {s.staff.map((m) => (
                <li key={`${m.name}-${m.role}`} className="flex justify-between gap-3 px-4 py-2">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-right text-ink-3">{m.role}{m.license ? ` · ${m.license}` : ""}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>section]:mt-0">
        <Section title={t.notMigratedTitle}>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">{t.notMigrated.map((x) => <li key={x}>{x}</li>)}</ul>
        </Section>
        {warnings.length ? (
          <Section title={t.warnings}>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">{warnings.map((x) => <li key={x}>{x}</li>)}</ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function DoneStep({ done, onAgain }: { done: Done; onAgain: () => void }) {
  const t = useT().tfb.done;
  const written = Object.entries(t.written).map(([k, label]) => ({ label, value: Number(done.written[k] ?? 0) + (k === "payments" ? Number(done.written.payments_existing ?? 0) : 0), tone: "green" as const }));
  const importId = typeof done.written.import_id === "string" ? done.written.import_id : null;
  return (
    <div>
      <Notice tone="green" title={t.title}>{t.text}</Notice>
      <div className="mt-4"><StatRow className="md:grid-cols-5" stats={written} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/lot">{t.squad}</LinkButton>
        <LinkButton href="/bani">{t.money}</LinkButton>
        {importId ? <Link href={`/import/${importId}`} className="inline-flex h-12 items-center px-2 font-semibold text-brand hover:underline">{t.report}</Link> : null}
      </div>
      <Reconciliation preview={done} />
      <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-ink-3">{t.againHint}</p>
        <Button variant="secondary" onClick={onAgain}>{t.again}</Button>
      </div>
    </div>
  );
}
