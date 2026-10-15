"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, CalendarDays, ClipboardCheck, Dumbbell, Ellipsis, FileText, Gauge, HeartPulse, House, LayoutDashboard,
  ListChecks, LogOut, Search, Settings, Stethoscope, Wallet, ReceiptText, Upload, User, Users, X, Megaphone,
} from "lucide-react";
import type { NavItem, VisibleSection } from "@/lib/nav";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { CommandPalette } from "./command-palette";
import { RoleSwitcher, type MembershipOption } from "./role-switcher";
import { AttendanceSync, QueueUserContext } from "@/components/schedule/attendance-sync";

const ICONS: Record<string, typeof House> = {
  home: House, clipboard: ClipboardCheck, calendar: CalendarDays, user: User, pulse: HeartPulse, users: Users,
  gauge: Gauge, dashboard: LayoutDashboard, list: ListChecks, dumbbell: Dumbbell, upload: Upload, file: FileText,
  settings: Settings, stethoscope: Stethoscope, wallet: Wallet, receipt: ReceiptText, megaphone: Megaphone,
};

type Props = {
  items: NavItem[];
  /** secțiunile spațiilor de lucru (Performanță, Bani) vizibile rolului: file deasupra paginii */
  sectionGroups: Array<{ key: string; sections: VisibleSection[] }>;
  clubName: string;
  logoUrl: string | null;
  userName: string;
  roleLabel: string;
  unread: number;
  memberships: MembershipOption[];
  searchable: boolean;
  /** Utilizatorul a cărui coadă offline de prezență o sincronizăm (null: rolul nu face prezență). */
  syncUserId: string | null;
  signOut: () => Promise<void>;
  /** o bandă deasupra conținutului (de exemplu, în clubul demo) */
  notice?: ReactNode;
  children: ReactNode;
};

/** La ieșirea din cont, ștergem paginile păstrate pentru lucrul offline (conțin numele jucătorilor). */
function clearOfflinePages() {
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
}

export function AppShell({ items, sectionGroups, clubName, logoUrl, userName, roleLabel, unread, memberships, searchable, syncUserId, signOut, notice, children }: Props) {
  const t = useT().common;
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const starts = (href: string) => pathname === href || pathname.startsWith(href + "/");
  // un singur element activ: întâi potrivirea directă, apoi rutele asociate spațiului de lucru
  const active = items.find((it) => starts(it.href)) ?? items.find((it) => it.match?.some(starts));
  const isActive = (it: NavItem) => it === active;
  const label = (key: string) => t.nav[key as keyof typeof t.nav] ?? key;

  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const overflow = items.length > 5 ? items.slice(4) : [];
  // fila curentă = cea mai lungă potrivire („/bani/taxe" bate „/bani"), în grupul care o conține;
  // o filă de grup se potrivește și pe rutele sub-filelor ei (`match`)
  const longest = (hrefs: string[]) => Math.max(-1, ...hrefs.filter(starts).map((h) => h.length));
  const sectionMatch = sectionGroups
    .flatMap((g) => g.sections.map((s) => ({ group: g, section: s, len: longest([s.href, ...(s.match ?? [])]) })))
    .filter((x) => x.len >= 0)
    .sort((a, b) => b.len - a.len)[0];
  const sections = sectionMatch?.group.sections ?? [];
  const showSections = sections.length > 1;
  const currentSection = sectionMatch?.section.key;
  const subTabs = sectionMatch?.section.tabs ?? [];
  const currentSub = subTabs.map((x) => ({ key: x.key, len: longest([x.href]) })).filter((x) => x.len >= 0).sort((a, b) => b.len - a.len)[0]?.key;

  // ⌘K / Ctrl+K deschide căutarea
  useEffect(() => {
    if (!searchable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchable]);

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

  const SearchButton = searchable ? (
    <button type="button" onClick={() => setSearchOpen(true)} aria-label={t.search.open} title={t.search.open}
      className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-brand-ink/10 md:hidden">
      <Search className="size-6" aria-hidden />
    </button>
  ) : null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      {/* Ecrane mari: meniu lateral */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col bg-brand text-brand-ink md:flex">
        <div className="flex items-center justify-between gap-2 p-3">
          {Brand}
          {BellLink}
        </div>
        {searchable ? (
          <div className="px-3 pb-2">
            <button type="button" onClick={() => setSearchOpen(true)}
              className="flex h-11 w-full items-center gap-2 rounded-lg bg-brand-ink/10 px-3 text-left font-semibold hover:bg-brand-ink/15">
              <Search className="size-5 shrink-0" aria-hidden />
              <span className="flex-1">{t.search.open}</span>
              <kbd className="rounded border border-brand-ink/30 px-1.5 text-xs font-semibold">⌘K</kbd>
            </button>
          </div>
        ) : null}
        <nav aria-label="Meniu principal" className="flex-1 overflow-y-auto px-2 py-1">
          {items.map((it) => {
            const Icon = ICONS[it.icon] ?? House;
            return (
              <Link key={it.href + it.key} href={it.href} aria-current={isActive(it) ? "page" : undefined}
                className={cn("mb-0.5 flex h-11 items-center gap-3 rounded-lg px-3 font-semibold",
                  isActive(it) ? "bg-brand-ink text-brand" : "hover:bg-brand-ink/10")}>
                <Icon className="size-5 shrink-0" aria-hidden />
                {label(it.key)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-brand-ink/20 p-3">
          <p className="truncate font-semibold">{userName}</p>
          <p className="truncate text-sm opacity-80">{roleLabel}</p>
          {memberships.length > 1 ? <RoleSwitcher memberships={memberships} tone="brand" /> : null}
          <form action={signOut} onSubmit={clearOfflinePages}>
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
          <div className="flex items-center">
            {SearchButton}
            {BellLink}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">
          {notice ? <div className="no-print -mx-4 -mt-4 mb-4 md:-mx-8 md:-mt-8">{notice}</div> : null}
          {showSections ? (
            <nav aria-label={label(sectionMatch?.group.key ?? "performance")} className="no-print -mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <ul className="flex gap-1 border-b border-line">
                {sections.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} aria-current={currentSection === s.key ? "page" : undefined}
                      className={cn("flex h-11 items-center whitespace-nowrap border-b-[3px] px-3 font-semibold",
                        currentSection === s.key ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                      {label(s.key)}
                    </Link>
                  </li>
                ))}
              </ul>
              {subTabs.length ? (
                <ul className="mt-2 flex gap-1" aria-label={label(currentSection ?? "")}>
                  {subTabs.map((x) => (
                    <li key={x.href}>
                      <Link href={x.href} aria-current={currentSub === x.key ? "page" : undefined}
                        className={cn("inline-flex h-10 items-center whitespace-nowrap rounded-full px-3.5 text-[0.9375rem] font-semibold",
                          currentSub === x.key ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken")}>
                        {label(x.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </nav>
          ) : null}
          <QueueUserContext.Provider value={syncUserId}>{children}</QueueUserContext.Provider>
        </main>

        {/* Telefon: bară de jos */}
        <nav aria-label="Meniu principal" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe md:hidden">
          <ul className="mx-auto flex max-w-lg">
            {primary.map((it) => {
              const Icon = ICONS[it.icon] ?? House;
              const on = isActive(it);
              return (
                <li key={it.href + it.key} className="flex-1">
                  <Link href={it.href} aria-current={on ? "page" : undefined}
                    className={cn("flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold", on ? "text-brand" : "text-ink-3")}>
                    <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", on && "bg-brand text-brand-ink")}>
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
                    overflow.some(isActive) ? "text-brand" : "text-ink-3")}>
                  <span className={cn("flex h-8 w-14 items-center justify-center rounded-full", overflow.some(isActive) && "bg-brand text-brand-ink")}>
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
              {memberships.length > 1 ? <div className="px-2 pb-2"><RoleSwitcher memberships={memberships} tone="plain" /></div> : null}
              <ul className="grid grid-cols-2 gap-2 py-2">
                {overflow.map((it) => {
                  const Icon = ICONS[it.icon] ?? House;
                  return (
                    <li key={it.href + it.key}>
                      <Link href={it.href} onClick={() => setMoreOpen(false)} aria-current={isActive(it) ? "page" : undefined}
                        className={cn("flex h-14 items-center gap-3 rounded-lg border px-3 font-semibold",
                          isActive(it) ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}>
                        <Icon className="size-5 shrink-0" aria-hidden />
                        {label(it.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action={signOut} onSubmit={clearOfflinePages}>
                <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border-control font-semibold">
                  <LogOut className="size-5" aria-hidden /> {t.actions.signOut}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
      {searchable && searchOpen ? <CommandPalette onClose={() => setSearchOpen(false)} /> : null}
      {syncUserId ? <AttendanceSync userId={syncUserId} /> : null}
    </div>
  );
}
