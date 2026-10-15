"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";

/** Filele fișei jucătorului. Pe ecranul de modificare nu apar (acolo e un formular cu „Înapoi"). */
export function PlayerFileTabs({ tabs }: { tabs: Array<{ key: string; href: string; label: string }> }) {
  const segment = useSelectedLayoutSegment();
  if (segment === "modifica" || tabs.length < 2) return <div className="border-b border-line" />;
  return <TabLinks tabs={tabs} current={segment ?? "fisa"} className="no-print" />;
}
