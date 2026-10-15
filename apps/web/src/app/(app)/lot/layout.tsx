import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { SquadTabs } from "@/components/squad/squad-tabs";

/** Spațiul Lot: biroul, directorul, antrenorii (echipele lor) și contabilul. */
export default async function SquadLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireCapability("viewSquad");
  return (
    <>
      <SquadTabs visas={can(ctx.role, "viewVisas")} />
      {children}
    </>
  );
}
