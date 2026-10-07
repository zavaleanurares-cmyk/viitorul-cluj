import { UserX } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { getT } from "@/messages";

/** Cont de jucător fără fișă legată: preparatorul trebuie să lege contul de jucător. */
export function NoPlayer() {
  const t = getT().player.noPlayer;
  return <EmptyState icon={<UserX className="size-8" aria-hidden />} title={t.title} description={t.description} />;
}
