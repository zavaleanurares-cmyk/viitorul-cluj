"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useT } from "@/messages";
import { Button } from "@/components/ui/button";
import { AssignDialog, type ProgramChoice } from "./assign-dialog";
import type { GroupOption, PlayerOption } from "./types";

/** „Alocă un program" din fișa jucătorului: jucătorul este fix, se alege programul. */
export function AssignProgramButton({ player, programs, groups, today }: {
  player: PlayerOption;
  programs: ProgramChoice[];
  groups: GroupOption[];
  today: string;
}) {
  const t = useT().planning.assign;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.openForPlayer}</Button>
      <AssignDialog open={open} onClose={() => setOpen(false)} programs={programs} players={[player]} groups={groups} today={today} fixedPlayer={player} />
    </>
  );
}
