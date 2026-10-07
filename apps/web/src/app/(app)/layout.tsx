import { ROLE_LABELS, countUnreadNotifications } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { signedUrl } from "@/lib/storage";
import { clubThemeStyle } from "@/lib/theme";
import { NAV } from "@/lib/nav";
import { AppShell } from "@/components/shell/app-shell";

/** Zona autentificată: verifică sesiunea, aplică tema clubului și afișează meniul rolului. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, ctx } = await requireSession();
  const [unread, logoUrl] = await Promise.all([
    countUnreadNotifications(db),
    signedUrl(db, "branding", ctx.club.logo_path, 60 * 60 * 12),
  ]);
  return (
    <div style={clubThemeStyle(ctx.club)}>
      <AppShell
        items={NAV[ctx.role]}
        clubName={ctx.club.short_name || ctx.club.name}
        logoUrl={logoUrl}
        userName={ctx.profile.full_name}
        roleLabel={ROLE_LABELS[ctx.role]}
        unread={unread}
        signOut={signOut}
      >
        {children}
      </AppShell>
    </div>
  );
}
