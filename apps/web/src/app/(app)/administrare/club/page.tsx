import { requireRole } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { Notice, PageHeader } from "@/components/ui/card";
import { ClubIdentityForm, ClubSettingsForm } from "@/components/admin/club-form";
import { getT } from "@/messages";

export const metadata = { title: "Club" };

export default async function Page() {
  const { ctx } = await requireRole("physio");
  const t = getT().admin.club;
  const { club } = ctx;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <ClubIdentityForm
          key={`${club.name}|${club.short_name}|${club.primary_color}|${club.accent_color}`}
          club={{
            id: club.id, name: club.name, shortName: club.short_name ?? "", primaryColor: club.primary_color,
            accentColor: club.accent_color, hasLogo: !!club.logo_path,
          }}
          logoUrl={fileUrl("branding", club.logo_path)}
        />
        <div className="space-y-4">
          <ClubSettingsForm key={JSON.stringify(ctx.settings)} settings={ctx.settings} />
          <Notice tone="gray">{t.testsElsewhere}</Notice>
        </div>
      </div>
    </>
  );
}
