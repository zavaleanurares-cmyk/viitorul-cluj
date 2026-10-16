"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { shareVideo } from "@/app/(app)/performanta/video/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, FormError } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

/** Alegerea echipelor cu care se partajează o înregistrare. */
export function ShareVideoButton({ id, teams, initial }: { id: string; teams: Array<{ id: string; name: string }>; initial: string[] }) {
  const t = useT().performance.video.share;
  const c = useT().common;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(initial);
  const save = useAction(shareVideo, { successMessage: false, onSuccess: (n) => { toast(t.saved(n)); setOpen(false); } });
  return (
    <>
      <Button variant="secondary" icon={<Share2 className="size-5" aria-hidden />} onClick={() => { setChosen(initial); setOpen(true); }}>{t.open}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.title}
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button pending={save.pending} onClick={() => save.run({ id, groupIds: chosen })}>{t.save}</Button>
        </>}>
        <div className="space-y-3">
          <p className="text-ink-2">{t.hint}</p>
          {teams.length ? (
            <ul className="grid gap-x-4 sm:grid-cols-2">
              {teams.map((g) => (
                <li key={g.id}>
                  <Checkbox label={g.name} checked={chosen.includes(g.id)}
                    onChange={(e) => setChosen((x) => (e.target.checked ? [...x, g.id] : x.filter((y) => y !== g.id)))} />
                </li>
              ))}
            </ul>
          ) : <p className="text-ink-3">{t.none}</p>}
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
