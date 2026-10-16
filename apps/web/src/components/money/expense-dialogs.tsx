"use client";
import { useState } from "react";
import { FileText, FolderTree, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Segmented, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { deleteDepartment, deleteExpense, saveDepartment, saveExpense } from "@/app/(app)/bani/cheltuieli/actions";
import { MoneyInput } from "./money-input";
import { deptOptions, type Dept, type Opt } from "./departments";

export type { Dept, Opt } from "./departments";
export type ExpenseValue = {
  id: string; description: string; department_id: string | null; supplier: string | null; invoice_no: string | null; amount: number;
  spent_on: string; method: "cash" | "bank" | "card"; group_id: string | null; player_id: string | null; document_path: string | null;
  documents?: ExpenseDoc[];
};
export type ExpenseDoc = { kind: "contract" | "receipt" | "payment_order" | "handover" | "nir" | "other"; path: string; file_name: string };
const fileHref = (path: string) => `/api/files/finance/${path.split("/").map(encodeURIComponent).join("/")}`;

const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(-80) || "document";

export function ExpenseButton({ clubId, today, depts, teams, players, expense }: { clubId: string; today: string; depts: Dept[]; teams: Opt[]; players: Opt[]; expense?: ExpenseValue }) {
  const m = useT().money;
  const t = m.expenses;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Omit<ExpenseValue, "id">>(() => expense ?? { description: "", department_id: null, supplier: "", invoice_no: "", amount: 0, spent_on: today, method: "bank", group_id: null, player_id: null, document_path: null });
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? null);
  const [tag, setTag] = useState<"none" | "team" | "player">(expense?.player_id ? "player" : expense?.group_id ? "team" : "none");
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState<ExpenseDoc[]>(expense?.documents ?? []);
  const [docKind, setDocKind] = useState<ExpenseDoc["kind"]>("receipt");
  const save = useAction(saveExpense, { onSuccess: () => setOpen(false) });
  const del = useAction(deleteExpense, { onSuccess: () => setOpen(false) });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });
  return (
    <>
      {expense ? <IconButton label={t.edit} onClick={() => { setDocs(expense.documents ?? []); setOpen(true); }}><Pencil className="size-5" aria-hidden /></IconButton>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.add}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={expense ? t.edit : t.add} wide
        footer={<>
          {expense ? <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} pending={del.pending} onClick={() => del.run({ id: expense.id })}>{m.common.delete}</Button> : null}
          <Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={!v.description.trim() || !amount || uploading} onClick={() => amount && save.run({
            id: expense?.id ?? null, description: v.description, department_id: v.department_id, supplier: v.supplier ?? undefined, invoice_no: v.invoice_no ?? undefined,
            amount, spent_on: v.spent_on, method: v.method, group_id: tag === "team" ? v.group_id : null, player_id: tag === "player" ? v.player_id : null, document_path: v.document_path, documents: docs,
          })}>{m.common.save}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.fields.description}><Input value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={300} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.department}>
              <Select value={v.department_id ?? ""} onChange={(e) => set("department_id", e.target.value || null)}>
                <option value="">{t.fields.noDepartment}</option>
                {deptOptions(depts).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label={t.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
            <Field label={t.fields.supplier} optional><Input value={v.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} maxLength={200} /></Field>
            <Field label={t.fields.invoice} optional><Input value={v.invoice_no ?? ""} onChange={(e) => set("invoice_no", e.target.value)} maxLength={60} /></Field>
            <Field label={t.fields.date}><Input type="date" value={v.spent_on} onChange={(e) => set("spent_on", e.target.value)} /></Field>
            <Field label={t.fields.method}>
              <Select value={v.method} onChange={(e) => set("method", e.target.value as "bank")}>
                {(["bank", "card", "cash"] as const).map((k) => <option key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</option>)}
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.fields.tag}</p>
            <Segmented label={t.fields.tag} value={tag} onChange={setTag} options={[{ value: "none", label: t.fields.tagNone }, { value: "team", label: t.fields.team }, { value: "player", label: t.fields.player }]} />
          </div>
          {tag === "team" ? (
            <Select aria-label={t.fields.team} value={v.group_id ?? ""} onChange={(e) => set("group_id", e.target.value || null)}>
              <option value="" />{teams.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </Select>
          ) : null}
          {tag === "player" ? (
            <Select aria-label={t.fields.player} value={v.player_id ?? ""} onChange={(e) => set("player_id", e.target.value || null)}>
              <option value="" />{players.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </Select>
          ) : null}
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.fields.document}</p>
            {v.document_path ? <p className="mb-2 flex items-center gap-2"><FileText className="size-5" aria-hidden /><a className="font-semibold underline" href={`/api/files/finance/${v.document_path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noreferrer">{v.document_path.split("/").pop()}</a></p> : null}
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">
              <Upload className="size-5" aria-hidden /> {v.document_path ? t.fields.replaceDocument : t.fields.document}
              <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                const path = `${clubId}/cheltuieli/${crypto.randomUUID()}-${safeName(f.name)}`;
                const res = await uploadFile("finance", path, f);
                setUploading(false);
                if (!res.ok) { toast(res.error, "error"); return; }
                set("document_path", path);
              }} />
            </label>
            <p className="mt-1 text-sm text-ink-3">{t.fields.documentHint}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-2">{t.docs.title}</p>
            <p className="mb-2 text-sm text-ink-3">{t.docs.hint}</p>
            {docs.length ? (
              <ul className="mb-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {docs.map((d) => (
                  <li key={d.path} className="flex items-center gap-2 py-1 pl-3 pr-1">
                    <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <a className="block truncate font-semibold underline" href={fileHref(d.path)} target="_blank" rel="noreferrer">{d.file_name}</a>
                      <span className="block text-sm text-ink-3">{t.docs.kinds[d.kind]}</span>
                    </span>
                    <IconButton label={t.docs.remove(d.file_name)} onClick={() => setDocs(docs.filter((x) => x.path !== d.path))}><X className="size-4" aria-hidden /></IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label={t.docs.kind} value={docKind} onChange={(e) => setDocKind(e.target.value as ExpenseDoc["kind"])} className="w-auto">
                {(["contract", "receipt", "payment_order", "handover", "nir", "other"] as const).map((k) => <option key={k} value={k}>{t.docs.kinds[k]}</option>)}
              </Select>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-sunken px-4 font-medium transition-colors hover:bg-line">
                <Plus className="size-5" aria-hidden /> {t.docs.add}
                <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={uploading || docs.length >= 20} onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setUploading(true);
                  const path = `${clubId}/cheltuieli/${crypto.randomUUID()}-${safeName(f.name)}`;
                  const res = await uploadFile("finance", path, f);
                  setUploading(false);
                  if (!res.ok) { toast(res.error, "error"); return; }
                  setDocs((x) => [...x, { kind: docKind, path, file_name: f.name.slice(0, 200) }]);
                }} />
              </label>
            </div>
          </div>
          <FormError>{save.error ?? del.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

/** Departamentele și subdepartamentele (folosite la cheltuieli, referate, buget). */
export function DepartmentsButton({ depts }: { depts: Dept[] }) {
  const m = useT().money;
  const t = m.expenses;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const save = useAction(saveDepartment, { successMessage: false, onSuccess: () => { setName(""); setEdit(null); } });
  const del = useAction(deleteDepartment, { successMessage: false });
  return (
    <>
      <Button variant="secondary" icon={<FolderTree className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.departments}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.departmentsTitle} wide>
        <div className="space-y-4">
          <p className="text-ink-3">{t.departmentsHint}</p>
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {deptOptions(depts).map((d) => {
              const row = depts.find((x) => x.id === d.id)!;
              return (
                <li key={d.id} className="flex items-center gap-2 px-3 py-1.5">
                  {edit?.id === d.id ? (
                    <>
                      <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="flex-1" aria-label={t.departmentName} />
                      <Button size="sm" pending={save.pending} onClick={() => save.run({ id: d.id, name: edit.name, parentId: row.parentId })}>{m.common.save}</Button>
                    </>
                  ) : (
                    <>
                      <span className={row.parentId ? "flex-1 pl-6" : "flex-1 font-semibold"}>{row.name}</span>
                      <IconButton label={m.common.edit} onClick={() => setEdit({ id: d.id, name: row.name })}><Pencil className="size-4" aria-hidden /></IconButton>
                      <IconButton label={m.common.delete} onClick={() => del.run({ id: d.id })}><Trash2 className="size-4" aria-hidden /></IconButton>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label={t.departmentName}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
            <Field label={t.addSub} optional>
              <Select value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">—</option>
                {depts.filter((d) => !d.parentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Button icon={<Plus className="size-5" aria-hidden />} disabled={!name.trim()} pending={save.pending && !edit} onClick={() => save.run({ id: null, name, parentId: parent || null })}>{t.addDepartment}</Button>
          </div>
          <FormError>{save.error ?? del.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
