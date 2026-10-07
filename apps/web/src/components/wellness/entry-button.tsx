"use client";
import { useState, type ReactNode } from "react";
import type { WellnessEntry } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { EntryDialog } from "./entry-dialog";

/** Buton care deschide fereastra de corectare / introducere a unui chestionar (doar pentru preparator). */
export function EntryButton({ player, date, entry, today, label, icon, iconOnly, variant = "secondary", pickDate, entries, className }: {
  player: { id: string; name: string }; date: string; entry: WellnessEntry | null; today: string;
  label: string; icon?: ReactNode; iconOnly?: boolean; variant?: "primary" | "secondary" | "ghost";
  pickDate?: boolean; entries?: WellnessEntry[]; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {iconOnly ? (
        <IconButton label={label} className={className} onClick={() => setOpen(true)}>{icon}</IconButton>
      ) : (
        <Button variant={variant} icon={icon} className={className} onClick={() => setOpen(true)}>{label}</Button>
      )}
      {open ? (
        <EntryDialog open onClose={() => setOpen(false)} player={player} date={date} entry={entry} today={today} pickDate={pickDate} entries={entries} />
      ) : null}
    </>
  );
}
