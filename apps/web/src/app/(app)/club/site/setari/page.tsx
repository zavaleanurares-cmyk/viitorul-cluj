import { formatDateTime } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { SiteHeader } from "@/components/club/site-tabs";
import { SiteSettingsForm } from "@/components/club/site-settings";
import { getT } from "@/messages";

export const metadata = { title: "Setările site-ului" };

export default async function SiteSettingsPage() {
  const { db, ctx } = await requireCapability("manageWebsite");
  const t = getT().club.website.settings;
  const s = ((ctx.club.settings as Record<string, unknown> | null)?.site ?? {}) as Record<string, unknown>;
  const b = (k: string, f = true) => (typeof s[k] === "boolean" ? (s[k] as boolean) : f);
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  const { data: log } = await db.from("site_changes").select("id, at, field, old_value, new_value, profiles(full_name)").order("at", { ascending: false }).limit(50);
  const show = (v: unknown) => (v === true ? t.on : v === false ? t.off : v === null || v === undefined || v === "" ? t.emptyValue
    : Array.isArray(v) ? v.map((x) => ctx.groups.find((g) => g.id === x)?.name ?? x).join(", ") || t.emptyValue : String(v).slice(0, 60));
  return (
    <>
      <SiteHeader slug={ctx.club.slug} current="settings" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SiteSettingsForm groups={ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }))} initial={{
          news: b("news"), teams: b("teams"), camps: b("camps"), gallery: b("gallery"), enrolment: b("enrolment"), support: b("support"), contact: b("contact"),
          indexable: b("indexable"), show_staff: b("show_staff", false), roster_groups: Array.isArray(s.roster_groups) ? (s.roster_groups as string[]) : [],
          tagline: str("tagline"), about: str("about"), address: str("address"), email: str("email"), phone: str("phone"), map_url: str("map_url"),
          facebook: str("facebook"), instagram: str("instagram"), youtube: str("youtube"), tiktok: str("tiktok"),
        }} />
        <aside>
          <h2 className="mb-2 text-lg">{t.log}</h2>
          {!log?.length ? <p className="text-ink-3">{t.logEmpty}</p> : (
            <ol className="divide-y divide-line rounded-[var(--radius-card)] border border-line/70 bg-surface text-sm shadow-[var(--shadow-card)]">
              {log.map((e) => (
                <li key={e.id} className="space-y-0.5 px-3 py-2">
                  <p className="font-semibold">{t.fieldNames[e.field] ?? e.field}: <span className="font-normal text-ink-2">{e.field === "policy" ? `v${e.new_value}` : `${show(e.old_value)} → ${show(e.new_value)}`}</span></p>
                  <p className="text-ink-3">{formatDateTime(e.at, ctx.settings.timezone)} · {(e.profiles as { full_name: string } | null)?.full_name ?? ""}</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </>
  );
}
