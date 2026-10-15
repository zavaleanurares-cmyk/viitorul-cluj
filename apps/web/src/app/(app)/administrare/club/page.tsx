import { requireRole } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { Download, Upload } from "lucide-react";
import { Card, CardBody, CardHeader, Notice, PageHeader } from "@/components/ui/card";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { ClubIdentityForm, ClubSettingsForm } from "@/components/admin/club-form";
import { getT } from "@/messages";

export const metadata = { title: "Club" };

export default async function Page() {
  const { ctx } = await requireRole("physio", "admin");
  const t = getT().admin.club;
  const tfb = getT().tfb;
  const { club } = ctx;
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="space-y-4">
          <ClubIdentityForm
            key={`${club.name}|${club.short_name}|${club.primary_color}|${club.accent_color}`}
            club={{
              id: club.id, name: club.name, shortName: club.short_name ?? "", primaryColor: club.primary_color,
              accentColor: club.accent_color, hasLogo: !!club.logo_path,
            }}
            logoUrl={fileUrl("branding", club.logo_path)}
          />
          <Card>
            <CardHeader title={t.exportTitle} description={t.exportText} />
            <CardBody>
              {/* descărcare obișnuită: arhiva poate veni direct sau printr-o adresă semnată */}
              <a href="/api/club/export" className={buttonClass("secondary", "md")} download>
                <Download className="size-5" aria-hidden />{t.exportButton}
              </a>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tfb.cardTitle} description={tfb.cardText} />
            <CardBody>
              <LinkButton href="/import/tfb" icon={<Upload className="size-5" aria-hidden />}>{tfb.title}</LinkButton>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <ClubSettingsForm key={JSON.stringify(ctx.settings)} settings={ctx.settings} />
          <Notice tone="gray">{t.testsElsewhere}</Notice>
        </div>
      </div>
    </>
  );
}
