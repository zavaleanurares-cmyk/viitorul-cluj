"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import { TabLinks } from "@/components/ui/misc";

export function PlayerTabs({ tabs }: { tabs: Array<{ key: string; href: string; label: string }> }) {
  const segment = useSelectedLayoutSegment();
  return <TabLinks tabs={tabs} current={segment ?? "sumar"} />;
}
