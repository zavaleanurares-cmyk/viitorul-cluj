"use client";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { IMPORT_KINDS, type ImportMeta, type NameDecision } from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { useT } from "@/messages";
import { ConfirmStep } from "./confirm-step";
import { FatigueStep } from "./fatigue-step";
import { FileStep } from "./file-step";
import { HealthStep } from "./health-step";
import { MatchStep } from "./match-step";
import { effectiveDecisions, proposeAll } from "./matching";
import { Stepper } from "./parts";
import { ReportView } from "./report-view";
import { TabularStep } from "./tabular-step";
import type { Decisions, ImportContext, ImportKind, ImportRecord, LoadedFile, Prepared } from "./types";

const STEPS = ["file", "map", "match", "confirm", "report"] as const;
type Step = (typeof STEPS)[number];

/**
 * Asistentul de import: fișier → previzualizare și mapare → potrivirea jucătorilor → confirmare → raport.
 * Starea stă aici, în browser; pe server ajung doar datele confirmate, la apăsarea butonului de import.
 */
export function ImportWizard({ kind, context }: { kind: ImportKind; context: ImportContext }) {
  const t = useT().imports;
  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [user, setUser] = useState<Decisions>({});
  const [record, setRecord] = useState<ImportRecord | null>(null);

  const go = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const sheet = file?.sheets[sheetIndex];
  const meta: ImportMeta = useMemo(() => ({
    filename: file && sheet ? (file.sheets.length > 1 ? `${file.filename} · ${sheet.name}` : file.filename) : null,
    file_hash: sheet?.hash ?? null,
  }), [file, sheet]);

  const proposals = useMemo(() => proposeAll(prepared?.names ?? [], context.players, context.remembered), [prepared, context.players, context.remembered]);
  const effective = useMemo(() => effectiveDecisions(prepared?.names ?? [], proposals, user), [prepared, proposals, user]);

  const chooseFile = (next: LoadedFile | null) => {
    setFile(next);
    setSheetIndex(0);
    setPrepared(null);
    setUser({});
  };
  const decide = (key: string, decision: NameDecision | null) => {
    const next = { ...user };
    if (decision) next[key] = decision;
    else delete next[key];
    setUser(next);
  };
  const restart = () => {
    chooseFile(null);
    setRecord(null);
    go("file");
  };

  const mapProps = sheet ? {
    sheet: sheet.data, meta, context,
    onBack: () => go("file"),
    onNext: (p: Prepared) => { setPrepared(p); go("match"); },
  } : null;

  return (
    <div>
      <Stepper steps={STEPS.map((s) => t.steps[s])} current={STEPS.indexOf(step)} label={t.steps.label} />

      <div hidden={step !== "file"}>
        <FileStep
          kind={kind} file={file} sheetIndex={sheetIndex} knownFiles={context.knownFiles} timezone={context.timezone}
          onFile={chooseFile} onSheet={(i) => { setSheetIndex(i); setPrepared(null); setUser({}); }} onNext={() => go("map")}
        />
      </div>

      {/* pasul de mapare rămâne montat, ca alegerile să nu se piardă la „înapoi" */}
      {mapProps && sheet && step !== "report" ? (
        <div hidden={step !== "map"} key={`${sheet.hash}-${sheetIndex}`}>
          {kind === "health_status" ? <HealthStep {...mapProps} />
            : kind === "fatigue_grid" ? <FatigueStep {...mapProps} />
            : <TabularStep kind={kind} {...mapProps} />}
        </div>
      ) : null}

      {step === "match" && prepared ? (
        <MatchStep
          names={prepared.names} proposals={proposals} user={user} effective={effective} context={context}
          onDecide={decide} onDecideMany={(patch) => setUser({ ...user, ...patch })}
          onBack={() => go("map")} onNext={() => go("confirm")}
        />
      ) : null}

      {step === "confirm" && prepared && file ? (
        <ConfirmStep
          kind={kind} filename={meta.filename ?? file.filename} prepared={prepared} decisions={effective}
          known={context.knownFiles.some((k) => k.file_hash === sheet?.hash)}
          onBack={() => go("match")} onDone={(r) => { setRecord(r); go("report"); }}
        />
      ) : null}

      {step === "report" && record ? (
        <div>
          <p className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Check className="size-6 text-st-green" aria-hidden />
            {t.report.doneTitle(IMPORT_KINDS[kind], record.filename ?? "")}
          </p>
          <ReportView record={record} />
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={restart}>{t.report.another}</Button>
            <LinkButton href="/import">{t.report.backToList}</LinkButton>
            <LinkButton href={`/import/${record.id}`} variant="ghost">{t.report.permalink}</LinkButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
