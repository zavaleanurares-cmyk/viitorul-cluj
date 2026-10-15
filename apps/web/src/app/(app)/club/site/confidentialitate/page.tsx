import { PRIVACY_POLICY_STARTER, formatDateTime } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { SiteHeader } from "@/components/club/site-tabs";
import { PolicyEditor } from "@/components/club/site-settings";
import { getT } from "@/messages";

export const metadata = { title: "Confidențialitate" };

export default async function SitePrivacyPage() {
  const { db, ctx } = await requireCapability("manageWebsite");
  const t = getT().club.website.privacy;
  const { data: versions } = await db.from("site_policies").select("id, version, published_at, profiles(full_name), body").order("version", { ascending: false });
  const latest = versions?.[0]?.body ?? "";
  return (
    <>
      <SiteHeader slug={ctx.club.slug} current="privacy" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-2">
          <h2 className="text-lg">{t.title}</h2>
          <p className="text-sm text-ink-3">{t.hint}</p>
          <PolicyEditor initial={latest} starter={PRIVACY_POLICY_STARTER.replaceAll("{{club}}", ctx.club.name)} />
        </div>
        <aside>
          <h2 className="mb-2 text-lg">{t.versions}</h2>
          {!versions?.length ? <p className="text-sm text-ink-3">{t.none}</p> : (
            <ol className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface text-sm">
              {versions.map((v) => (
                <li key={v.id} className="px-3 py-2"><p className="font-semibold">{t.version(v.version)}</p>
                  <p className="text-ink-3">{formatDateTime(v.published_at, ctx.settings.timezone)} · {(v.profiles as { full_name: string } | null)?.full_name ?? ""}</p></li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}
