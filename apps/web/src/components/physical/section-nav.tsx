import Link from "next/link";
import { NavSelect } from "@/components/planning/nav-select";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

/** Navigarea modulului: Sesiuni / Teste fizice + alegerea grupei (ambele prin URL). */
export function SectionNav({ current, groups, groupId, hrefFor }: {
  current: "sesiuni" | "teste";
  groups: Array<{ id: string; name: string }>;
  groupId: string;
  /** adresa aceleiași secțiuni pentru altă grupă */
  hrefFor: (section: "sesiuni" | "teste", groupId: string) => string;
}) {
  const t = getT().physical.nav;
  const pill = (active: boolean) =>
    cn(
      "inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-control)] border px-4 font-semibold whitespace-nowrap sm:flex-none",
      active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
    );
  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2">
      <nav aria-label={t.label} className="flex flex-1 gap-2 sm:flex-none">
        <Link href={hrefFor("sesiuni", groupId)} aria-current={current === "sesiuni" ? "page" : undefined} className={pill(current === "sesiuni")}>{t.sessions}</Link>
        <Link href={hrefFor("teste", groupId)} aria-current={current === "teste" ? "page" : undefined} className={pill(current === "teste")}>{t.tests}</Link>
      </nav>
      {groups.length > 1 ? (
        <NavSelect
          label={t.group}
          value={groupId}
          className="w-full sm:ml-auto sm:w-56"
          options={groups.map((g) => ({ value: g.id, label: g.name, href: hrefFor(current, g.id) }))}
        />
      ) : null}
    </div>
  );
}
