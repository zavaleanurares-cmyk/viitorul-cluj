import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { STANDARD_MESSAGE_TEMPLATES } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { MessageComposer } from "@/components/club/message-composer";
import { getT } from "@/messages";

export const metadata = { title: "Mesaj nou" };

export default async function NewMessagePage() {
  const { db, ctx } = await requireCapability("clubMessages");
  const t = getT().club.messages;
  const coach = ctx.role === "coach";
  const teams = coach ? visibleGroups(ctx) : ctx.groups.filter((g) => g.is_active);
  const { data: own } = await db.from("message_templates").select("id, name, title, body").order("name");
  const templates = [...(own ?? []).map((x) => ({ key: x.id, name: x.name, title: x.title, body: x.body })), ...STANDARD_MESSAGE_TEMPLATES];
  return (
    <>
      <PageHeader back={<Link href="/club/mesaje" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>} title={t.composeTitle} />
      <MessageComposer teams={teams.map((g) => ({ id: g.id, name: g.name }))} templates={templates} coach={coach || ctx.role === "physio"}
        staffAllowed={!["coach", "physio"].includes(ctx.role)} canSaveTemplates={["admin", "secretary", "sporting_director"].includes(ctx.role)} />
    </>
  );
}
