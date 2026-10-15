import { TabLinks } from "@/components/ui/misc";
import { getT } from "@/messages";

/** File comune paginilor Club ale familiei: mesaje, documente, tabere, magazin. */
export function FamilyClubTabs({ current }: { current: "messages" | "documents" | "camps" | "shop" }) {
  const t = getT().common.familyClub;
  return (
    <TabLinks className="mb-4" current={current} tabs={[
      { key: "messages", href: "/mesaje", label: t.messages },
      { key: "documents", href: "/contracte", label: t.documents },
      { key: "camps", href: "/tabere", label: t.camps },
      { key: "shop", href: "/magazin", label: t.shop },
    ]} />
  );
}
