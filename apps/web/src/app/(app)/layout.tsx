import { ROLE_LABELS, can, countUnreadNotifications } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { signedUrl } from "@/lib/storage";
import { clubThemeStyle } from "@/lib/theme";
import { NAV, sectionGroups } from "@/lib/nav";
import { AppShell } from "@/components/shell/app-shell";
import { isDemoClub } from "@/lib/demo";
import { getT } from "@/messages";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

/** Zona autentificată: verifică sesiunea, aplică tema clubului și afișează meniul rolului. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, ctx } = await requireSession();
  const [unread, logoUrl, memberships] = await Promise.all([
    countUnreadNotifications(db),
    signedUrl(db, "branding", ctx.club.logo_path, 60 * 60 * 12),
    db.from("memberships").select("id, club_id, role, clubs(name, short_name)").eq("user_id", ctx.userId).eq("is_active", true),
  ]);
  const options = (memberships.data ?? []).map((m) => {
    const club = m.clubs as { name: string; short_name: string | null } | null;
    return {
      id: m.id,
      label: `${club?.short_name || club?.name || ""} · ${ROLE_LABELS[m.role]}`,
      current: m.club_id === ctx.club.id && m.role === ctx.role,
    };
  });
  return (
    <div style={clubThemeStyle(ctx.club)}>
      <AppShell
        items={NAV[ctx.role]}
        sectionGroups={sectionGroups(ctx.role)}
        clubName={ctx.club.short_name || ctx.club.name}
        logoUrl={logoUrl}
        userName={ctx.profile.full_name}
        roleLabel={ROLE_LABELS[ctx.role]}
        unread={unread}
        memberships={options}
        searchable={can(ctx.role, "viewSquad") || can(ctx.role, "viewSchedule")}
        syncUserId={can(ctx.role, "runEvents") ? ctx.userId : null}
        signOut={signOut}
        notice={isDemoClub(ctx.club) ? <DemoNotice /> : null}
      >
        {children}
      </AppShell>
    </div>
  );
}

function DemoNotice() {
  const t = getT().auth.demo;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-st-blue-soft px-4 py-2.5 text-sm md:px-8">
      <FlaskConical className="size-4 shrink-0 text-st-blue" aria-hidden />
      <span className="min-w-0 flex-1">{t.banner}</span>
      <Link href="/demo" className="font-semibold underline">{t.switchRole}</Link>
    </p>
  );
}
