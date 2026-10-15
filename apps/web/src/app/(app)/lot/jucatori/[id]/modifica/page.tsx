import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { PlayerForm } from "@/components/squad/player-form";
import { getSquadPlayer } from "@/components/squad/queries";
import { getT } from "@/messages";

export const metadata = { title: "Modifică jucătorul" };

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("manageSquad");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getSquadPlayer(db, id);
  if (!p) notFound();
  const t = getT().squad;
  const teams = ctx.groups.filter((g) => g.is_active || g.id === p.group_id).map((g) => ({ id: g.id, name: g.name }));
  return (
    <>
      <PageHeader title={t.form.editTitle(p.full_name)} />
      <PlayerForm teams={teams} isActive={p.is_active} initial={{
        id: p.id, fullName: p.full_name, displayName: p.display_name, birthDate: p.birth_date ?? "", groupId: p.group_id ?? "",
        position: (p.position as "GK" | "DEF" | "MID" | "FWD" | null) ?? "", positionDetail: p.position_detail ?? "", foot: (p.dominant_foot as "left" | "right" | "both" | null) ?? "",
        shirt: p.shirt_number ?? "", nationality: p.nationality ?? "", registration: p.registration_number ?? "", fifaId: p.fifa_id ?? "",
        enrolledOn: p.enrolled_on ?? "", visa: p.medical_visa_expires_on ?? "", photoConsent: p.photo_consent,
      }} />
    </>
  );
}
