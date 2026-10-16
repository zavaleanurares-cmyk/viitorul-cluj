"use client";
import { usePathname } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";
import { useT } from "@/messages";

/** Filele spațiului Program; ascunse în paginile unui eveniment (prezență, meci) ca ecranul să fie liber. */
export function ScheduleTabs({ coaching }: { coaching: boolean }) {
  const t = useT().schedule.tabs;
  const pathname = usePathname();
  const inside = /^\/program\/(?!terenuri|competitii|sectiuni|activitate)[^/]+/.test(pathname);
  if (inside) return null;
  const current = pathname.startsWith("/program/terenuri") ? "venues" : pathname.startsWith("/program/competitii") ? "competitions"
    : pathname.startsWith("/program/sectiuni") ? "drills" : pathname.startsWith("/program/activitate") ? "activity" : "calendar";
  return (
    <TabLinks
      className="mb-6"
      current={current}
      tabs={[
        { key: "calendar", href: "/program", label: t.calendar },
        { key: "venues", href: "/program/terenuri", label: t.venues },
        { key: "competitions", href: "/program/competitii", label: t.competitions },
        { key: "drills", href: "/program/sectiuni", label: t.drills },
        ...(coaching ? [{ key: "activity", href: "/program/activitate", label: t.activity }] : []),
      ]}
    />
  );
}
