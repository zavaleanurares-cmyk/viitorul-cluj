"use client";
import { useMemo } from "react";
import { IMPORT_KINDS } from "@club/shared";
import { Notice } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { runImport } from "@/app/(app)/import/actions";
import { Section, StatRow, StepNav } from "./parts";
import type { Decisions, ImportKind, ImportRecord, Prepared } from "./types";

/** Server Actions acceptă implicit cereri de cel mult 1 MB. */
const MAX_PAYLOAD_CHARS = 3_500_000; // limita acțiunilor de server este 4 MB (next.config.ts)

/** Pasul 4: rezumatul a ceea ce urmează să se scrie și butonul de import. */
export function ConfirmStep({ kind, filename, prepared, decisions, known, onBack, onDone }: {
  kind: ImportKind; filename: string; prepared: Prepared; decisions: Decisions; known: boolean;
  onBack: () => void; onDone: (record: ImportRecord) => void;
}) {
  const t = useT().imports;
  const c = t.confirm;
  const built = useMemo(() => prepared.build(decisions), [prepared, decisions]);
  const tooBig = useMemo(() => JSON.stringify(built.payload).length > MAX_PAYLOAD_CHARS, [built]);
  const action = useAction(runImport, { onSuccess: onDone, successMessage: c.done });

  return (
    <div>
      <p className="mb-3 text-ink-2">{c.intro(IMPORT_KINDS[kind], filename)}</p>
      <StatRow stats={built.stats} />

      {known ? <Notice tone="yellow" title={c.knownTitle} className="mt-4">{c.knownBody[kind]}</Notice> : null}
      {built.importable === 0 ? <Notice tone="red" title={c.nothingTitle} className="mt-4">{c.nothingBody}</Notice> : null}
      {tooBig ? <Notice tone="red" title={c.tooBigTitle} className="mt-4">{c.tooBigBody}</Notice> : null}

      {built.flagged.length ? (
        <Section title={c.flaggedTitle(built.flagged.length)} description={c.flaggedDescription}>
          <TableWrap className="max-h-[50vh] overflow-y-auto">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="w-12">{t.common.row}</th>
                <th scope="col">{c.name}</th>
                <th scope="col">{c.reason}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {built.flagged.map((f, i) => (
                <tr key={`${f.row}-${i}`}>
                  <td className="text-ink-3">{f.row}</td>
                  <td className="font-semibold whitespace-nowrap">{f.name}</td>
                  <td>{f.note}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <div className="mt-4"><FormError>{action.error}</FormError></div>
      <StepNav
        back={t.nav.back} onBack={onBack} final pending={action.pending}
        next={c.run} onNext={() => action.run({ kind, payload: built.payload, annotations: built.annotations })}
        disabled={built.importable === 0 || tooBig}
      />
    </div>
  );
}
