"use client";
import { usePathname } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";
import { useT } from "@/messages";

/** Filele spațiului Program; ascunse în paginile unui eveniment (prezență, meci) ca ecranul să fie liber. */
export function ScheduleTabs() {
  const t = useT().schedule.tabs;
  const pathname = usePathname();
  const inside = /^\/program\/(?!terenuri|competitii|sectiuni)[^/]+/.test(pathname);
  if (inside) return null;
  const current = pathname.startsWith("/program/terenuri") ? "venues" : pathname.startsWith("/program/competitii") ? "competitions"
    : pathname.startsWith("/program/sectiuni") ? "drills" : "calendar";
  return (
    <TabLinks
      className="mb-6"
      current={current}
      tabs={[
        { key: "calendar", href: "/program", label: t.calendar },
        { key: "venues", href: "/program/terenuri", label: t.venues },
        { key: "competitions", href: "/program/competitii", label: t.competitions },
        { key: "drills", href: "/program/sectiuni", label: t.drills },
      ]}
    />
  );
}
