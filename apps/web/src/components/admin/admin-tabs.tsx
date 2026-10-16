"use client";
import { usePathname } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";
import { useT } from "@/messages";

const SECTIONS = ["conturi", "grupe", "stari", "club", "audit", "gdpr"] as const;

/** Navigarea între secțiunile de administrare (pe subpagini; pagina de pornire are carduri). */
export function AdminTabs() {
  const t = useT().admin.nav;
  const pathname = usePathname();
  const current = SECTIONS.find((s) => pathname.startsWith(`/administrare/${s}`));
  if (!current) return null;
  return (
    <TabLinks
      className="mb-6"
      current={current}
      tabs={[{ key: "start", href: "/administrare", label: t.start }, ...SECTIONS.map((s) => ({ key: s, href: `/administrare/${s}`, label: t[s] }))]}
    />
  );
}
