"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { createPlayerAccounts, type BulkResult } from "@/app/(app)/administrare/conturi/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { FormError, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { CopyButton } from "./invite-link";
import type { PlayerOption } from "./queries";

function csvCell(v: string) {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Conturi pentru jucătorii unei grupe: câte un e-mail pe rând; la sfârșit, lista linkurilor de invitație. */
export function BulkAccounts({ players, groupName }: { players: PlayerOption[]; groupName: string }) {
  const t = useT().admin.bulk;
  const [emails, setEmails] = useState<Record<string, string>>(() => Object.fromEntries(players.map((p) => [p.id, p.suggestedEmail])));
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const create = useAction(createPlayerAccounts, { onSuccess: setResults, successMessage: false });
  const rows = players.filter((p) => (emails[p.id] ?? "").trim()).map((p) => ({ playerId: p.id, email: emails[p.id].trim() }));

  if (results) {
    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const text = ok.map((r) => `${r.name} (${r.email}): ${r.ok ? r.link : ""}`).join("\n");
    const download = () => {
      const lines = [[t.csvPlayer, t.csvEmail, t.csvLink], ...ok.map((r) => [r.name, r.email, r.ok ? r.link : ""])];
      const blob = new Blob(["﻿" + lines.map((l) => l.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `invitatii-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <Card>
        <CardHeader title={t.resultTitle(ok.length)} description={t.resultHint} />
        <CardBody className="space-y-4">
          {ok.length ? (
            <>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={text} label={t.copyAll} />
                <Button variant="secondary" icon={<Download className="size-5" aria-hidden />} onClick={download}>{t.downloadCsv}</Button>
              </div>
              <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {ok.map((r) => (
                  <li key={r.playerId} className="space-y-1 p-3">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {r.name}
                      <span className="text-sm font-normal text-ink-3">{r.email}</span>
                      {r.ok && r.emailed ? <Badge tone="green">{t.emailed}</Badge> : null}
                    </p>
                    <div className="flex gap-2">
                      <Input readOnly value={r.ok ? r.link : ""} aria-label={t.linkFor(r.name)} onFocus={(e) => e.currentTarget.select()} className="min-w-0 font-mono text-sm" />
                      <CopyButton text={r.ok ? r.link : ""} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {failed.length ? (
            <Notice tone="red" title={t.failedTitle(failed.length)}>
              <ul className="list-disc pl-5">
                {failed.map((r) => <li key={r.playerId}>{r.name || r.email}: {!r.ok ? r.error : ""}</li>)}
              </ul>
            </Notice>
          ) : null}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={t.tableTitle(groupName)} description={t.tableHint} />
      <CardBody className="space-y-4">
        <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
          {players.map((p) => (
            <li key={p.id} className="grid items-center gap-x-3 gap-y-1 p-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <label htmlFor={`email-${p.id}`} className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-bold">{p.displayName}</span>
                {p.minor ? <Badge tone="yellow">{t.minor}</Badge> : null}
              </label>
              <Input
                id={`email-${p.id}`} type="email" inputMode="email" autoComplete="off" autoCapitalize="off"
                placeholder={p.minor ? t.placeholderMinor : t.placeholder}
                value={emails[p.id] ?? ""} onChange={(e) => setEmails((m) => ({ ...m, [p.id]: e.target.value }))}
              />
            </li>
          ))}
        </ul>
        <FormError>{create.error}</FormError>
        <Button pending={create.pending} disabled={!rows.length} onClick={() => create.run({ rows })} className="w-full sm:w-auto">
          {t.create(rows.length)}
        </Button>
      </CardBody>
    </Card>
  );
}
