"use client";
import { KIT_SIZES, kitSizeLabel } from "@club/shared";
import { Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { setKitSize } from "@/app/(app)/club/inscrieri/family-actions";

/** Mărimea echipamentului, aleasă de părinte (sau de jucător). Se salvează la alegere. */
export function KitSizeSelect({ playerId, value }: { playerId: string; value: string | null }) {
  const t = useT().club.onboarding;
  const save = useAction(setKitSize);
  return (
    <Select aria-label={t.size} className="max-w-64" value={value ?? ""} disabled={save.pending} onChange={(e) => save.run({ playerId, size: e.target.value })}>
      <option value="">{t.pickSize}</option>
      {KIT_SIZES.map((s) => <option key={s} value={s}>{kitSizeLabel(s)}</option>)}
    </Select>
  );
}
