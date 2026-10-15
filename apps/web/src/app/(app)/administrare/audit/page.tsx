import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { ROLE_LABELS, formatDateTime, label } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import {
  AUDIT_PAGE_SIZE, auditActions, auditEntities, auditQueryString, describeDetails, fetchAudit, loadAuditLookups, parseAuditFilters,
} from "@/components/admin/audit";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Jurnal de audit" };

const GRID = "lg:grid-cols-[9.5rem_minmax(0,1fr)_8rem_minmax(0,9rem)_minmax(0,9rem)_minmax(0,1.6fr)]";
const ACTION_TONE: Record<string, "gray" | "blue" | "red" | "yellow" | "green"> = {
  READ: "blue", EXPORT: "blue", DOWNLOAD: "blue", DELETE: "red", ERASE: "red", ANONYMIZE: "red", UPDATE: "yellow", INSERT: "green",
};

/** Jurnalul de audit: cine, ce, când. Doar de citit — baza de date nu permite nimănui să-l modifice. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, ctx } = await requireRole("physio", "admin");
  const sp = await searchParams;
  const t = getT().admin.audit;
  const c = getT().common;
  const f = parseAuditFilters(sp);
  const page = Math.max(1, Number.parseInt(typeof sp.pagina === "string" ? sp.pagina : "1", 10) || 1);
  const from = (page - 1) * AUDIT_PAGE_SIZE;

  const [{ rows, total }, lookups] = await Promise.all([
    fetchAudit(db, f, ctx.settings.timezone, from, from + AUDIT_PAGE_SIZE - 1),
    loadAuditLookups(db, ctx),
  ]);
  const actions = auditActions();
  const entities = auditEntities();
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const filtered = Object.keys(f).length > 0;
  const users = [...lookups.profiles.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "ro"));
  const players = [...lookups.players.entries()].sort((a, b) => a[1].localeCompare(b[1], "ro"));

  return (
    <>
      <PageHeader
        title={t.title} description={t.description}
        action={
          <a href={`/administrare/audit/export${auditQueryString(f)}`} className={buttonClass("secondary")} download>
            <Download className="size-5" aria-hidden />
            {t.exportCsv}
          </a>
        }
      />

      <form method="get" className="mb-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={c.fields.from}><Input type="date" name="de" defaultValue={f.de ?? ""} max={ctx.today} /></Field>
            <Field label={c.fields.to}><Input type="date" name="pana" defaultValue={f.pana ?? ""} max={ctx.today} /></Field>
          </div>
          <Field label={t.action}>
            <Select name="actiune" defaultValue={f.actiune ?? ""}>
              <option value="">{t.allActions}</option>
              {Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label={t.entity}>
            <Select name="entitate" defaultValue={f.entitate ?? ""}>
              <option value="">{t.allEntities}</option>
              {Object.entries(entities).sort((a, b) => a[1].localeCompare(b[1], "ro")).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label={t.user}>
            <Select name="utilizator" defaultValue={f.utilizator ?? ""}>
              <option value="">{t.allUsers}</option>
              {users.map(([id, p]) => <option key={id} value={id}>{p.name} — {label(ROLE_LABELS, p.role)}</option>)}
              <option value="sistem">{t.system}</option>
            </Select>
          </Field>
          <Field label={t.player}>
            <Select name="jucator" defaultValue={f.jucator ?? ""}>
              <option value="">{t.allPlayers}</option>
              {players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonClass("primary", "md", "flex-1")}>{t.apply}</button>
            {filtered ? <LinkButton href="/administrare/audit">{t.reset}</LinkButton> : null}
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-ink-3">{t.shortcuts}</span>
          <Link href="/administrare/audit?actiune=READ" className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
            <Eye className="size-4" aria-hidden />{t.shortcutReads}
          </Link>
          <Link href={`/administrare/audit?de=${ctx.today}&pana=${ctx.today}`} className="font-semibold underline underline-offset-4">{t.shortcutToday}</Link>
          <Link href="/administrare/audit?entitate=profiles" className="font-semibold underline underline-offset-4">{t.shortcutAccounts}</Link>
        </p>
      </form>

      <p className="mb-2 text-sm text-ink-3" aria-live="polite">{t.count(total, page, pages)}</p>

      {!rows.length ? (
        <EmptyState title={t.emptyTitle} description={filtered ? t.emptyFiltered : t.empty} action={filtered ? <LinkButton href="/administrare/audit">{t.reset}</LinkButton> : undefined} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <div className={cn("hidden gap-x-3 border-b border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink-3 lg:grid", GRID)}>
            <span>{t.colWhen}</span>
            <span>{t.colWho}</span>
            <span>{t.action}</span>
            <span>{t.entity}</span>
            <span>{t.player}</span>
            <span>{t.colDetails}</span>
          </div>
          <ul>
            {rows.map((r) => {
              const actor = r.actor_id ? lookups.profiles.get(r.actor_id) : null;
              const role = actor?.role ?? r.actor_role;
              const playerName = r.player_id ? lookups.players.get(r.player_id) : null;
              const lines = describeDetails(r, lookups);
              return (
                <li key={r.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-line px-3 py-2.5 last:border-b-0", GRID)}>
                  <span className="order-2 justify-self-end text-sm text-ink-3 lg:order-none lg:justify-self-start lg:text-base lg:text-ink">{formatDateTime(r.created_at, ctx.settings.timezone)}</span>
                  <span className="order-1 min-w-0 lg:order-none">
                    <span className="block truncate font-semibold">{actor?.name ?? (r.actor_id ? t.deletedAccount : t.system)}</span>
                    {role && role !== "system" ? <span className="block truncate text-sm text-ink-3">{label(ROLE_LABELS, role)}</span> : null}
                  </span>
                  <span className="order-3 lg:order-none"><Badge tone={ACTION_TONE[r.action] ?? "gray"}>{actions[r.action] ?? r.action}</Badge></span>
                  <span className="order-4 justify-self-end text-sm lg:order-none lg:justify-self-start lg:text-base">{entities[r.entity] ?? r.entity}</span>
                  <span className="order-5 col-span-2 min-w-0 lg:order-none lg:col-span-1">
                    {r.player_id ? (
                      playerName ? (
                        <Link href={`/lot/jucatori/${r.player_id}`} className="font-semibold underline underline-offset-4">{playerName}</Link>
                      ) : <span className="text-ink-3">{t.deletedPlayer}</span>
                    ) : <span className="hidden text-ink-3 lg:inline">—</span>}
                  </span>
                  <span className="order-6 col-span-2 min-w-0 text-sm lg:order-none lg:col-span-1">
                    {lines.length ? (
                      <ul className="space-y-0.5">
                        {lines.map((line, i) => (
                          <li key={i} className="break-words">
                            <span className="text-ink-3">{line.label}{line.from !== undefined || line.value ? ": " : ""}</span>
                            {line.from !== undefined ? (
                              <>
                                <span className="line-through decoration-ink-3">{line.from}</span>
                                <span aria-label={t.becomes}> → </span>
                                <span className="font-semibold">{line.to}</span>
                              </>
                            ) : line.value ? <span className="font-semibold">{line.value}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <span className="hidden text-ink-3 lg:inline">—</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label={t.pagination} className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? <LinkButton href={`/administrare/audit${auditQueryString(f, { pagina: page - 1 })}`}>{t.newer}</LinkButton> : <span />}
          <span className="text-sm text-ink-3">{t.pageOf(page, pages)}</span>
          {page < pages ? <LinkButton href={`/administrare/audit${auditQueryString(f, { pagina: page + 1 })}`}>{t.older}</LinkButton> : <span />}
        </nav>
      ) : null}
      <p className="mt-4 text-sm text-ink-3">{t.readOnlyNote}</p>
    </>
  );
}
