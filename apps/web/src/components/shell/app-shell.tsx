"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Bell, CalendarDays, ClipboardCheck, Dumbbell, Ellipsis, FileText, Gauge, HeartPulse, House, LayoutDashboard,
  ListChecks, LogOut, Settings, Stethoscope, Upload, User, Users, X,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";

const ICONS: Record<string, typeof House> = {
  home: House, clipboard: ClipboardCheck, calendar: CalendarDays, user: User, pulse: HeartPulse, users: Users,
  gauge: Gauge, dashboard: LayoutDashboard, list: ListChecks, dumbbell: Dumbbell, upload: Upload, file: FileText,
  settings: Settings, stethoscope: Stethoscope,
};

type Props = {
  items: NavItem[];
  clubName: string;
  logoUrl: string | null;
  userName: string;
  roleLabel: string;
  unread: number;
  signOut: () => Promise<void>;
  children: ReactNode;
};

export function AppShell({ items, clubName, logoUrl, userName, roleLabel, unread, signOut, children }: Props) {
  const t = useT().common;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const label = (key: string) => t.nav[key as keyof typeof t.nav] ?? key;

  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const overflow = items.length > 5 ? items.slice(4) : [];

  const Brand = (
    <span className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-md bg-white object-contain p-0.5" />
      ) : (
        <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-ink/15 text-lg font-bold">
          {clubName.slice(0, 1)}
        </span>
      )}
      <span className="truncate text-lg font-bold">{clubName}</span>
    </span>
  );

  const BellLink = (
    <Link href="/notificari" aria-label={unread ? `${t.nav.notifications}: ${unread} necitite` : t.nav.notifications}
      className="relative inline-flex size-12 items-center justify-center rounded-lg hover:bg-brand-ink/10">
      <Bell className="size-6" aria-hidden />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-st-red px-1 text-xs font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      {/* Ecrane mari: meniu lateral */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col bg-brand text-brand-ink md:flex">
        <div className="flex items-center justify-between gap-2 p-3">
          {Brand}
          {BellLink}
        </div>
        <nav aria-label="Meniu principal" className="flex-1 overflow-y-auto px-2 py-1">
          {items.map((it) => {
            const Icon = ICONS[it.icon] ?? House;
            return (
              <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
                className={cn("mb-0.5 flex h-11 items-center gap-3 rounded-lg px-3 font-semibold",
                  isActive(it.href) ? "bg-brand-ink text-brand" : "hover:bg-brand-ink/10")}>
                <Icon className="size-5 shrink-0" aria-hidden />
                {label(it.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-brand-ink/20 p-3">
          <p className="truncate font-semibold">{userName}</p>
          <p className="truncate text-sm opacity-80">{roleLabel}</p>
          <form action={signOut}>
            <button type="submit" className="mt-2 flex h-10 w-full items-center gap-2 rounded-lg px-2 font-semibold hover:bg-brand-ink/10">
              <LogOut className="size-5" aria-hidden /> {t.actions.signOut}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Telefon: bară de sus */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 bg-brand pl-3 pr-1 text-brand-ink pt-safe md:hidden">
          <div className="flex h-14 min-w-0 items-center">{Brand}</div>
          {BellLink}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">{children}</main>

        {/* Telefon: bară de jos */}
        <nav aria-label="Meniu principal" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:hidden">
          <ul className="mx-auto flex max-w-lg">
            {primary.map((it) => {
              const Icon = ICONS[it.icon] ?? House;
              const active = isActive(it.href);
              return (
                <li key={it.href} className="flex-1">
                  <Link href={it.href} aria-current={active ? "page" : undefined}
                    className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold", active ? "text-brand" : "text-ink-3")}>
                    <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", active && "bg-brand text-brand-ink")}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {label(it.key)}
                  </Link>
                </li>
              );
            })}
            {overflow.length ? (
              <li className="flex-1">
                <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}
                  className={cn("flex h-16 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                    overflow.some((o) => isActive(o.href)) ? "text-brand" : "text-ink-3")}>
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", overflow.some((o) => isActive(o.href)) && "bg-brand text-brand-ink")}>
                    <Ellipsis className="size-5" aria-hidden />
                  </span>
                  {t.nav.more}
                </button>
              </li>
            ) : null}
          </ul>
        </nav>

        {moreOpen ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label={t.nav.more}>
            <button type="button" aria-label={t.actions.close} className="absolute inset-0 bg-ink/50" onClick={() => setMoreOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-surface p-3 pb-safe">
              <div className="flex items-center justify-between pb-1 pl-2">
                <div>
                  <p className="font-bold">{userName}</p>
                  <p className="text-sm text-ink-3">{roleLabel}</p>
                </div>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label={t.actions.close} className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-sunken">
                  <X className="size-6" aria-hidden />
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2 py-2">
                {overflow.map((it) => {
                  const Icon = ICONS[it.icon] ?? House;
                  return (
                    <li key={it.href}>
                      <Link href={it.href} onClick={() => setMoreOpen(false)} aria-current={isActive(it.href) ? "page" : undefined}
                        className={cn("flex h-14 items-center gap-3 rounded-lg border px-3 font-semibold",
                          isActive(it.href) ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}>
                        <Icon className="size-5 shrink-0" aria-hidden />
                        {label(it.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action={signOut}>
                <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-line-strong font-semibold">
                  <LogOut className="size-5" aria-hidden /> {t.actions.signOut}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
