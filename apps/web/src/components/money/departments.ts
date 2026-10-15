export type Dept = { id: string; name: string; parentId: string | null };
export type Opt = { id: string; label: string };

/** Departamentele ca listă indentată (părinte › copil), pentru select-uri. */
export function deptOptions(depts: Dept[]): Opt[] {
  const out: Opt[] = [];
  for (const d of depts.filter((x) => !x.parentId)) {
    out.push({ id: d.id, label: d.name });
    for (const c of depts.filter((x) => x.parentId === d.id)) out.push({ id: c.id, label: `${d.name} › ${c.name}` });
  }
  return out;
}
