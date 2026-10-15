import { requireCapability } from "@/lib/auth";
import { SquadTabs } from "@/components/squad/squad-tabs";

/** Spațiul Lot: biroul, directorul, antrenorii (echipele lor) și contabilul. */
export default async function SquadLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("viewSquad");
  return (
    <>
      <SquadTabs />
      {children}
    </>
  );
}
