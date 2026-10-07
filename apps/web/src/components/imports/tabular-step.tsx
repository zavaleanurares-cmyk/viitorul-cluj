"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  PHYSICAL_FIELDS, POSITIONS, ROSTER_FIELDS, SESSION_TYPES, formatDateShort, isSummaryRow, label, normalizePosition,
  readTable, suggestMapping, type ColumnMapping, type ImportField, type ImportMeta, type PhysicalDefaults, type Sheet,
} from "@club/shared";
import { Notice } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { FlagNote, Problems, Section, StepNav } from "./parts";
import { preparePhysical, prepareRoster, prepareTests, testFields } from "./prepare";
import { columnLetter, sampleValues } from "./read-file";
import { TemplatesPanel } from "./templates-panel";
import type { ImportContext, Prepared } from "./types";

const PREVIEW_LIMIT = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
type TabularKind = "physical" | "roster" | "tests";

function fmt(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return typeof value === "number" ? String(value).replace(".", ",") : value;
}

/**
 * Pasul 2 pentru importurile pe mapare de coloane: date fizice (K-Sport sau alt export),
 * listă nominală, teste fizice. Fiecare coloană primește un câmp, iar previzualizarea arată
 * valorile deja convertite, cu erorile pe rând.
 */
export function TabularStep({ kind, sheet, meta, context, onBack, onNext }: {
  kind: TabularKind; sheet: Sheet; meta: ImportMeta; context: ImportContext; onBack: () => void; onNext: (prepared: Prepared) => void;
}) {
  const t = useT().imports;
  const m = t.mapping;
  const [headerRowInput, setHeaderRowInput] = useState("");
  const [overrides, setOverrides] = useState<ColumnMapping>({});
  // date fizice
  const [sessionDate, setSessionDate] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionType, setSessionType] = useState<PhysicalDefaults["session_type"]>("training");
  const [source, setSource] = useState<PhysicalDefaults["source"]>("ksport");
  // comune
  const [groupId, setGroupId] = useState("");
  const [testDate, setTestDate] = useState(context.today);

  const headerRow = /^\d+$/.test(headerRowInput) && +headerRowInput >= 1 && +headerRowInput <= sheet.length ? +headerRowInput : undefined;
  const table = useMemo(() => readTable(sheet, headerRow), [sheet, headerRow]);
  const fields: ImportField[] = useMemo(
    () => (kind === "physical" ? PHYSICAL_FIELDS : kind === "roster" ? ROSTER_FIELDS : testFields(context.tests)),
    [kind, context.tests],
  );
  const suggested = useMemo(() => suggestMapping(table.headers, fields, kind === "physical"), [table, fields, kind]);
  const mapping = useMemo(() => ({ ...suggested, ...overrides }), [suggested, overrides]);
  const mapped = (key: string) => Object.values(mapping).includes(key);
  const columns = table.headers.map((header, index) => ({ header, index, samples: sampleValues(table.rows, index) }))
    .filter((c) => c.header || c.samples.length);

  const choose = (col: number, target: string) => {
    const next = { ...overrides, [col]: target };
    // un câmp se folosește o singură dată: coloana care îl avea este eliberată
    if (target && !target.startsWith("extra:")) {
      for (const [c, v] of Object.entries(mapping)) {
        if (+c !== col && v === target) next[+c] = kind === "physical" && table.headers[+c] ? `extra:${table.headers[+c]}` : "";
      }
    }
    setOverrides(next);
  };

  const defaults: PhysicalDefaults = useMemo(() => ({
    session_date: ISO_DATE.test(sessionDate) ? sessionDate : null,
    session_name: sessionName.trim(), session_type: sessionType, group_id: groupId || null, source,
  }), [sessionDate, sessionName, sessionType, groupId, source]);

  const physical = useMemo(() => (kind === "physical" ? preparePhysical({ table, mapping, defaults, meta }) : null), [kind, table, mapping, defaults, meta]);
  const roster = useMemo(
    () => (kind === "roster" ? prepareRoster({ table, mapping, defaultGroupId: groupId || null, groups: context.groups, meta }) : null),
    [kind, table, mapping, groupId, context.groups, meta],
  );
  const tests = useMemo(
    () => (kind === "tests"
      ? prepareTests({ table, mapping, tests: context.tests, defaultDate: ISO_DATE.test(testDate) ? testDate : null, hintGroupId: groupId || null, meta })
      : null),
    [kind, table, mapping, context.tests, testDate, groupId, meta],
  );
  const prepared: Prepared | null = physical ?? roster ?? tests;

  // --- validare -------------------------------------------------------------
  const problems: string[] = [];
  const nameField = kind === "roster" ? "full_name" : "player";
  if (!table.rows.length) problems.push(m.noRows);
  else if (!mapped(nameField)) problems.push(m.noNameColumn);
  else if (!prepared?.names.length) problems.push(m.noValidRows);
  if (kind === "physical" && table.rows.length) {
    const hasValues = Object.values(mapping).some((v) => v.startsWith("extra:") || (!!v && !["player", "session_date", "session_name", "session_type"].includes(v)));
    if (!hasValues) problems.push(m.noValueColumn);
    const missingDate = physical?.records.some((r) => r.values.player && !isSummaryRow(String(r.values.player)) && !r.values.session_date);
    if (missingDate && !defaults.session_date) problems.push(mapped("session_date") ? m.someRowsNoDate : m.noDate);
  }
  if (kind === "roster" && roster?.rows.some((r) => r.fullName && !r.groupId)) {
    problems.push(m.noGroup(roster.rows.filter((r) => r.fullName && !r.groupId).length));
  }
  if (kind === "tests" && table.rows.length) {
    if (!context.tests.length) problems.push(m.noTestsDefined);
    else if (!Object.values(mapping).some((v) => v.startsWith("test:"))) problems.push(m.noTestColumn);
    if (tests?.rows.some((r) => r.name && !r.summary && !r.tested_on)) problems.push(m.noTestDate);
  }
  const recognized = Object.values(suggested).some((v) => v && !v.startsWith("extra:"));

  // --- coloanele previzualizării -----------------------------------------------
  const previewFields = fields.filter((f) => mapped(f.key));
  const extras = Object.values(mapping).filter((v) => v.startsWith("extra:")).length;
  const groupName = (id: string | null) => context.groups.find((g) => g.id === id)?.name ?? "—";

  return (
    <div>
      {table.rows.length > 0 && !recognized ? <Notice tone="yellow" title={m.noHeaderTitle} className="mb-4">{m.noHeaderBody}</Notice> : null}

      {kind === "physical" ? (
        <TemplatesPanel
          templates={context.templates} headers={table.headers} mapping={mapping} suggested={suggested} defaults={defaults}
          onApply={(next, d) => { setOverrides(next); setSessionType(d.session_type); setSource(d.source); }}
        />
      ) : null}

      <Section
        title={m.title}
        description={m.description[kind]}
        action={(
          <Field label={m.headerRow} className="w-40">
            <Input
              type="number" inputMode="numeric" min={1} max={sheet.length} className="!h-10"
              value={headerRowInput} placeholder={String(table.headerRow)}
              onChange={(e) => { setHeaderRowInput(e.target.value); setOverrides({}); }}
            />
          </Field>
        )}
      >
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <div className="hidden grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.3fr)_20rem] gap-3 border-b border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink-3 md:grid">
            <span>{t.common.column}</span><span>{t.common.header}</span><span>{t.common.samples}</span><span>{m.target}</span>
          </div>
          <ul>
            {columns.map((c) => {
              const value = mapping[c.index] ?? "";
              const extraValue = `extra:${c.header}`;
              return (
                <li key={c.index} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 first:border-t-0 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.3fr)_20rem]">
                  <span className="font-semibold text-ink-3">{columnLetter(c.index)}</span>
                  <span className={cn("min-w-0 truncate font-semibold", !value && "text-ink-3")}>{c.header || <span className="font-normal text-ink-3">{t.common.noHeader}</span>}</span>
                  <span className="col-start-2 min-w-0 truncate text-sm text-ink-2 md:col-start-auto">{c.samples.join(" · ") || "—"}</span>
                  <Select
                    className="col-span-2 !h-10 md:col-span-1" aria-label={m.targetFor(c.header || columnLetter(c.index))}
                    value={value} onChange={(e) => choose(c.index, e.target.value)}
                  >
                    <option value="">{t.common.ignore}</option>
                    {kind === "physical" && c.header ? <option value={extraValue}>{m.keepExtra}</option> : null}
                    {kind === "tests" ? (
                      <>
                        {fields.filter((f) => !f.key.startsWith("test:")).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        <optgroup label={m.testsGroup}>
                          {fields.filter((f) => f.key.startsWith("test:")).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </optgroup>
                      </>
                    ) : (
                      <optgroup label={m.fieldsGroup}>
                        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </optgroup>
                    )}
                  </Select>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {kind === "physical" ? (
        <Section title={m.defaultsTitle} description={m.defaultsDescription}>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label={m.sessionDate} hint={mapped("session_date") ? m.sessionDateHint : undefined} optional={mapped("session_date")}>
              <Input type="date" value={sessionDate} max={context.today} onChange={(e) => setSessionDate(e.target.value)} />
            </Field>
            <Field label={m.sessionName} optional={mapped("session_name")}>
              <Input value={sessionName} maxLength={120} placeholder={m.sessionNamePlaceholder} onChange={(e) => setSessionName(e.target.value)} />
            </Field>
            <Field label={m.sessionType}>
              <Select value={sessionType} onChange={(e) => setSessionType(e.target.value as PhysicalDefaults["session_type"])}>
                {Object.entries(SESSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label={m.group} hint={m.groupHintPhysical}>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{m.allGroups}</option>
                {context.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
            <Field label={m.source}>
              <Select value={source} onChange={(e) => setSource(e.target.value as PhysicalDefaults["source"])}>
                <option value="ksport">{m.sourceKsport}</option>
                <option value="import">{m.sourceOther}</option>
              </Select>
            </Field>
          </div>
        </Section>
      ) : null}

      {kind === "roster" ? (
        <Section title={m.defaultsTitle}>
          <Field label={m.defaultGroup} hint={mapped("group") ? m.defaultGroupHintWithColumn : m.defaultGroupHint} className="max-w-sm">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">{m.chooseGroup}</option>
              {context.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
        </Section>
      ) : null}

      {kind === "tests" ? (
        <Section title={m.defaultsTitle}>
          {!context.tests.length ? (
            <Notice tone="yellow" title={m.noTestsDefined} className="mb-3">
              <Link href="/fizic" className="font-semibold underline">{m.noTestsDefinedLink}</Link>
            </Notice>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[14rem_16rem]">
            <Field label={m.testDate} hint={mapped("tested_on") ? m.testDateHint : undefined}>
              <Input type="date" value={testDate} max={context.today} onChange={(e) => setTestDate(e.target.value)} />
            </Field>
            <Field label={m.group} hint={m.groupHintTests}>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{m.allGroups}</option>
                {context.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>
          </div>
        </Section>
      ) : null}

      {table.rows.length && mapped(nameField) ? (
        <Section title={m.previewTitle(table.rows.length)} description={table.rows.length > PREVIEW_LIMIT ? m.previewLimited(PREVIEW_LIMIT) : m.previewDescription}>
          <TableWrap className="max-h-[70vh] overflow-y-auto">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="w-10">{t.common.row}</th>
                {kind === "roster" ? (
                  <>
                    <th scope="col">{m.rosterName}</th>
                    <th scope="col">{m.rosterBirth}</th>
                    <th scope="col">{m.group}</th>
                    <th scope="col">{m.rosterPosition}</th>
                    <th scope="col" className="text-right">{m.rosterNumber}</th>
                  </>
                ) : previewFields.map((f) => (
                  <th key={f.key} scope="col" title={f.label} className={cn("whitespace-nowrap", f.type !== "text" && f.type !== "date" && "text-right")}>{m.short[f.key] ?? f.label}</th>
                ))}
                {kind === "physical" && extras ? <th scope="col" className="text-right">{m.extrasColumn}</th> : null}
                <th scope="col">{m.problemsColumn}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {kind === "physical" ? physical?.records.slice(0, PREVIEW_LIMIT).map((r) => {
                const name = String(r.values.player ?? "");
                const summary = !!name && isSummaryRow(name);
                return (
                  <tr key={r.row} className={summary || !name ? "text-ink-3" : undefined}>
                    <td className="text-ink-3">{r.row}</td>
                    {previewFields.map((f) => (
                      <td key={f.key} className={cn("whitespace-nowrap", f.key === "player" && "font-semibold", f.type !== "text" && f.type !== "date" && "text-right tabular-nums")}>
                        {f.type === "date" ? (r.values[f.key] ? formatDateShort(String(r.values[f.key])) : "") : fmt(r.values[f.key])}
                      </td>
                    ))}
                    {extras ? <td className="text-right text-ink-3">{Object.keys(r.extra).length || ""}</td> : null}
                    <td className="min-w-44">
                      {summary ? <Badge>{m.summaryRow}</Badge> : r.errors.length ? r.errors.map((e) => <div key={e}><FlagNote>{e}</FlagNote></div>) : null}
                    </td>
                  </tr>
                );
              }) : null}
              {kind === "roster" ? roster?.rows.slice(0, PREVIEW_LIMIT).map((r) => {
                const pos = normalizePosition(r.rec.values.position);
                const problemsOfRow = [...r.rec.errors, ...(r.groupKnown ? [] : [t.notes.unknownGroup(r.groupText)])];
                return (
                  <tr key={r.rec.row} className={r.fullName ? undefined : "text-ink-3"}>
                    <td className="text-ink-3">{r.rec.row}</td>
                    <td className="font-semibold">{r.fullName || "—"}</td>
                    <td className="whitespace-nowrap">{r.rec.values.birth_date ? formatDateShort(String(r.rec.values.birth_date)) : ""}</td>
                    <td className="whitespace-nowrap">{groupName(r.groupId)}</td>
                    <td>{pos.code ? label(POSITIONS, pos.code) : ""}</td>
                    <td className="text-right tabular-nums">{fmt(r.rec.values.shirt_number)}</td>
                    <td className="min-w-44">{problemsOfRow.map((e) => <div key={e}><FlagNote>{e}</FlagNote></div>)}</td>
                  </tr>
                );
              }) : null}
              {kind === "tests" ? tests?.rows.slice(0, PREVIEW_LIMIT).map((r) => (
                <tr key={r.row} className={r.summary || !r.name ? "text-ink-3" : undefined}>
                  <td className="text-ink-3">{r.row}</td>
                  {previewFields.map((f) => (
                    <td key={f.key} className={cn("whitespace-nowrap", f.key === "player" ? "font-semibold" : f.type === "number" && "text-right tabular-nums")}>
                      {f.key === "player" ? r.name || "—"
                        : f.key === "tested_on" ? (r.tested_on ? formatDateShort(r.tested_on) : "")
                        : fmt(r.results.find((x) => `test:${x.test_id}` === f.key)?.value)}
                    </td>
                  ))}
                  <td className="min-w-44">
                    {r.summary ? <Badge>{m.summaryRow}</Badge> : r.errors.map((e) => <div key={e}><FlagNote>{e}</FlagNote></div>)}
                  </td>
                </tr>
              )) : null}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <Problems items={problems} />
      <StepNav back={t.nav.back} onBack={onBack} next={t.nav.toMatching} onNext={() => prepared && onNext(prepared)} disabled={problems.length > 0 || !prepared} />
    </div>
  );
}
