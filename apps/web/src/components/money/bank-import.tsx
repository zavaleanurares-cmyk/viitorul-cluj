"use client";
import { useMemo, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { buildBankLines, findHeaderRow, formatDateShort, formatLei, guessBankMapping, type BankField, type BankLine } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { loadFile } from "@/components/imports/read-file";
import { importBank, previewBank, type BankPreviewRow } from "@/app/(app)/bani/banca/actions";
import { Money } from "./bits";

type Action = "match_guardian" | "match_expense" | "unassigned_payment" | "ignore" | "leave";
const FIELDS: BankField[] = ["date", "credit", "debit", "amount", "description", "counterparty", "reference"];

/** Importul unui extras: fișier → coloane → verificare (cu propunerile serverului) → import. Fișierul nu pleacă din browser. */
export function BankImportButton() {
  const m = useT();
  const t = m.money.bank.wizard;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Partial<Record<BankField, number>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BankPreviewRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Action>>({});
  const headers = (rows[headerRow] ?? []).map((c) => String(c ?? ""));
  const built = useMemo(() => buildBankLines(rows.slice(headerRow + 1), mapping), [rows, headerRow, mapping]);
  const check = useAction(previewBank, { successMessage: false, refresh: false });
  const save = useAction(importBank, { successMessage: false, onSuccess: (r) => { toast(t.done(r.inserted, r.matched)); setOpen(false); } });

  const reset = () => { setStep(1); setFileName(""); setRows([]); setMapping({}); setFileError(null); setPreview([]); setDecisions({}); };
  const goReview = async () => {
    const res = await check.run({ lines: built.lines });
    if (!res.ok) return;
    setPreview(res.data);
    const d: Record<string, Action> = {};
    for (const p of res.data) d[p.hash] = p.duplicate ? "leave" : p.guardian_id ? "match_guardian" : p.expense_id ? "match_expense" : "leave";
    setDecisions(d);
    setStep(3);
  };
  const pv = new Map(preview.map((p) => [p.hash, p]));
  const fresh = built.lines.filter((l) => !pv.get(l.hash)?.duplicate);
  const inc = built.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const out = built.lines.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0);
  const canMap = mapping.date !== undefined && (mapping.amount !== undefined || mapping.credit !== undefined || mapping.debit !== undefined);

  const options = (l: BankLine): Action[] => {
    const p = pv.get(l.hash);
    if (l.amount > 0) return [...(p?.guardian_id ? ["match_guardian" as const] : []), "unassigned_payment", "ignore", "leave"];
    return [...(p?.expense_id ? ["match_expense" as const] : []), "ignore", "leave"];
  };

  return (
    <>
      <Button icon={<FileUp className="size-5" aria-hidden />} onClick={() => { reset(); setOpen(true); }}>{m.money.bank.import}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.title} wide
        footer={step === 2 ? (
          <><Button variant="ghost" onClick={() => setStep(1)}>{t.back}</Button>
            <Button disabled={!canMap || built.lines.length === 0} pending={check.pending} onClick={goReview}>{t.next}</Button></>
        ) : step === 3 ? (
          <><Button variant="ghost" onClick={() => setStep(2)}>{t.back}</Button>
            <Button disabled={fresh.length === 0} pending={save.pending} onClick={() => save.run({
              fileName, lines: fresh.map((l) => {
                const p = pv.get(l.hash);
                const a = decisions[l.hash] ?? "leave";
                return { ...l, action: a, guardian_id: a === "match_guardian" ? p?.guardian_id ?? null : null, expense_id: a === "match_expense" ? p?.expense_id ?? null : null };
              }),
            })}>{t.import}</Button></>
        ) : undefined}>
        <ol className="mb-4 flex gap-2 text-sm font-semibold" aria-label={t.title}>
          {[t.step1, t.step2, t.step3].map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={step === i + 1 ? "rounded-full bg-brand px-3 py-1 text-brand-ink" : "rounded-full bg-sunken px-3 py-1 text-ink-3"}>{i + 1}. {label}</li>
          ))}
        </ol>

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-ink-2">{t.fileHint}</p>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">
              <Upload className="size-5" aria-hidden /> {t.choose}
              <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const res = await loadFile(f);
                if (!res.ok) { setFileError(res.problem); return; }
                const data = res.file.sheets[0]?.data ?? [];
                const h = findHeaderRow(data);
                setFileName(f.name);
                setRows(data);
                setHeaderRow(h);
                setMapping(guessBankMapping((data[h] ?? []).map((c) => String(c ?? ""))));
                setFileError(null);
                setStep(2);
              }} />
            </label>
            {fileError ? (
              <Notice tone="red" title={m.imports.file.problems[fileError as keyof typeof m.imports.file.problems].title}>
                {m.imports.file.problems[fileError as keyof typeof m.imports.file.problems].body}
              </Notice>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-ink-2">{t.columnsHint}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f} label={t.fields[f]}>
                  <Select value={mapping[f] ?? ""} onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? undefined : Number(e.target.value) })}>
                    <option value="">{t.noColumn}</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `#${i + 1}`}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            {mapping.date === undefined ? <FormError>{t.needDate}</FormError> : !canMap ? <FormError>{t.needAmount}</FormError> : (
              <Notice tone="blue">
                {t.summary(built.lines.length, formatLei(inc), formatLei(out))}
                {built.skipped.length ? <span className="block">{t.skipped(built.skipped.length)}</span> : null}
              </Notice>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <Notice tone="blue">
              {t.summary(fresh.length, formatLei(fresh.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)), formatLei(fresh.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0)))}
              <span className="block">{t.autoMatched(preview.filter((p) => !p.duplicate && p.guardian_id).length)} · {t.expenseMatched(preview.filter((p) => !p.duplicate && p.expense_id).length)}</span>
              {built.lines.length > fresh.length ? <span className="block">{t.duplicates(built.lines.length - fresh.length)}</span> : null}
            </Notice>
            <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {built.lines.map((l) => {
                const p = pv.get(l.hash);
                return (
                  <li key={l.hash} className={p?.duplicate ? "grid gap-2 px-3 py-2 opacity-60 sm:grid-cols-[1fr_auto_14rem] sm:items-center" : "grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_14rem] sm:items-center"}>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-3">{formatDateShort(l.booked_on)}{l.counterparty ? ` · ${l.counterparty}` : ""}</span>
                      <span className="block truncate">{l.description}</span>
                      {p?.guardian_name ? <span className="block text-sm font-semibold">{p.guardian_name} · {p.payment_ref}</span> : null}
                      {p?.expense_label ? <span className="block text-sm font-semibold">{p.expense_label}</span> : null}
                    </span>
                    <Money value={l.amount} sign className={l.amount > 0 ? "font-bold" : "font-bold text-ink-2"} />
                    {p?.duplicate ? <span className="text-sm font-semibold text-ink-3">{t.dup}</span> : (
                      <Select aria-label={t.decision} value={decisions[l.hash] ?? "leave"} onChange={(e) => setDecisions({ ...decisions, [l.hash]: e.target.value as Action })} className="h-11">
                        {options(l).map((o) => <option key={o} value={o}>{t.decisions[o]}</option>)}
                      </Select>
                    )}
                  </li>
                );
              })}
            </ul>
            <FormError>{save.error}</FormError>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
