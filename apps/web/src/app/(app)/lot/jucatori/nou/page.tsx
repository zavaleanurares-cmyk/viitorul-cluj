import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { PlayerForm } from "@/components/squad/player-form";
import { getT } from "@/messages";

export const metadata = { title: "Jucător nou" };

export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ echipa?: string }> }) {
  const { ctx } = await requireCapability("manageSquad");
  const sp = await searchParams;
  const t = getT().squad;
  const teams = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }));
  const team = typeof sp.echipa === "string" && teams.some((g) => g.id === sp.echipa) ? sp.echipa : "";
  return (
    <>
      <PageHeader title={t.form.newTitle} />
      <PlayerForm teams={teams} initial={{
        fullName: "", displayName: "", birthDate: "", groupId: team, position: "", positionDetail: "", foot: "", shirt: "",
        nationality: "", registration: "", fifaId: "", enrolledOn: ctx.today, visa: "", photoConsent: false,
      }} />
    </>
  );
}
