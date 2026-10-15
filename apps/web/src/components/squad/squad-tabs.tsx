"use client";
import { usePathname } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";
import { useT } from "@/messages";

/** Filele spațiului Lot (ascunse pe fișa unui jucător, unde există „Înapoi"). */
export function SquadTabs({ visas }: { visas: boolean }) {
  const t = useT().squad.tabs;
  const pathname = usePathname();
  if (pathname.startsWith("/lot/jucatori/")) return null;
  const current = pathname.startsWith("/lot/echipe") ? "teams" : pathname.startsWith("/lot/parinti") ? "guardians" : pathname.startsWith("/lot/vize") ? "visas" : "players";
  return (
    <TabLinks
      className="mb-6"
      current={current}
      tabs={[
        { key: "players", href: "/lot", label: t.players },
        { key: "teams", href: "/lot/echipe", label: t.teams },
        { key: "guardians", href: "/lot/parinti", label: t.guardians },
        ...(visas ? [{ key: "visas", href: "/lot/vize", label: t.visas }] : []),
      ]}
    />
  );
}
