"use client";
import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { IMPORT_KINDS, cell, formatDateTime } from "@club/shared";
import { Notice } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { columnLetter, loadFile, type FileProblem } from "./read-file";
import { Section, StepNav } from "./parts";
import type { ImportKind, KnownFile, LoadedFile } from "./types";

const PREVIEW_ROWS = 8;
const PREVIEW_COLS = 10;

/** Pasul 1: alegerea fișierului. Fișierul se citește în browser; nu se încarcă pe server. */
export function FileStep({ kind, file, sheetIndex, knownFiles, timezone, onFile, onSheet, onNext }: {
  kind: ImportKind; file: LoadedFile | null; sheetIndex: number; knownFiles: KnownFile[]; timezone: string;
  onFile: (file: LoadedFile | null) => void; onSheet: (index: number) => void; onNext: () => void;
}) {
  const t = useT().imports;
  const f = t.file;
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setProblem(null);
    const res = await loadFile(picked);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (res.ok) onFile(res.file);
    else {
      setProblem(res.problem);
      onFile(null);
    }
  };

  const sheet = file?.sheets[sheetIndex];
  const width = sheet ? Math.max(...sheet.data.map((r) => (r ?? []).length), 0) : 0;
  const earlier = sheet ? knownFiles.filter((k) => k.file_hash === sheet.hash) : [];

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files[0]); }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-8 text-center",
          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
          over ? "border-brand bg-sunken" : "border-transparent bg-sunken hover:bg-line",
        )}
      >
        <Upload className="size-8 text-ink-3" aria-hidden />
        <span className="text-lg font-semibold">{busy ? f.reading : file ? f.replace : f.drop}</span>
        <span className="max-w-prose text-sm text-ink-3">{f.accepted}</span>
        <input
          ref={input} type="file" className="sr-only" aria-label={f.choose}
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </label>
      <p className="mt-2 text-sm text-ink-3">{f.expected[kind]}</p>

      {problem ? <Notice tone="red" title={f.problems[problem].title} className="mt-4">{f.problems[problem].body}</Notice> : null}

      {file && sheet ? (
        <Section
          className="mt-5"
          title={<span className="inline-flex items-center gap-2"><FileSpreadsheet className="size-5 text-ink-3" aria-hidden />{file.filename}</span>}
          description={f.size(sheet.data.length, width)}
        >
          {file.sheets.length > 1 ? (
            <Field label={f.sheet} hint={f.sheetHint(file.sheets.length)} className="mb-3 max-w-sm">
              <Select value={sheetIndex} onChange={(e) => onSheet(Number(e.target.value))}>
                {file.sheets.map((s, i) => <option key={s.name + i} value={i}>{s.name}</option>)}
              </Select>
            </Field>
          ) : null}

          {earlier.length ? (
            <Notice tone="yellow" title={f.knownTitle} className="mb-3">
              {f.knownBody(formatDateTime(earlier[0].created_at, timezone), IMPORT_KINDS[earlier[0].kind])}
            </Notice>
          ) : null}

          <TableWrap>
            <thead>
              <tr>
                <th scope="col" className="w-10">{f.rowNo}</th>
                {Array.from({ length: Math.min(width, PREVIEW_COLS) }, (_, c) => <th key={c} scope="col">{columnLetter(c)}</th>)}
              </tr>
            </thead>
            <tbody className="text-sm">
              {sheet.data.slice(0, PREVIEW_ROWS).map((row, i) => (
                <tr key={i}>
                  <td className="text-ink-3">{i + 1}</td>
                  {Array.from({ length: Math.min(width, PREVIEW_COLS) }, (_, c) => (
                    <td key={c} className="max-w-48 truncate whitespace-nowrap">{cell((row ?? [])[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {sheet.data.length > PREVIEW_ROWS || width > PREVIEW_COLS ? (
            <p className="mt-2 text-sm text-ink-3">{f.previewNote(Math.min(PREVIEW_ROWS, sheet.data.length))}</p>
          ) : null}
        </Section>
      ) : null}

      <StepNav next={t.nav.next} onNext={onNext} disabled={!sheet || busy} />
    </div>
  );
}
