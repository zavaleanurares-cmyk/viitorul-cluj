import { NavSelect } from "@/components/planning/nav-select";
import { getT } from "@/messages";

/** Alegerea grupei în modulul fizic (Sesiuni / Teste sunt sub-filele spațiului Performanță). */
export function SectionNav({ current, groups, groupId, hrefFor }: {
  current: "sesiuni" | "teste";
  groups: Array<{ id: string; name: string }>;
  groupId: string;
  /** adresa aceleiași secțiuni pentru altă grupă */
  hrefFor: (section: "sesiuni" | "teste", groupId: string) => string;
}) {
  const t = getT().physical.nav;
  if (groups.length < 2) return null;
  return (
    <div className="no-print mb-4 flex">
      <NavSelect
        label={t.group}
        value={groupId}
        className="w-full sm:w-56"
        options={groups.map((g) => ({ value: g.id, label: g.name, href: hrefFor(current, g.id) }))}
      />
    </div>
  );
}
