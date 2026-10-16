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
        <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-[0.5rem] bg-white object-contain p-0.5 ring-1 ring-line" />
      ) : (
        <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-brand text-[0.9375rem] font-semibold text-brand-ink">
          {clubName.slice(0, 1)}
        </span>
      )}
      <span className="truncate text-[1.0625rem] font-semibold tracking-tight">{clubName}</span>
    </span>
  );

  const BellLink = (
    <Link href="/notificari" aria-label={unread ? `${t.nav.notifications}: ${unread} necitite` : t.nav.notifications}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
      <Bell className="size-5" aria-hidden />
      {unread > 0 ? (
        <span className="absolute right-0.5 top-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-st-red px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-surface">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );

  const SearchButton = searchable ? (
    <button type="button" onClick={() => setSearchOpen(true)} aria-label={t.search.open} title={t.search.open}
      className="inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink md:hidden">
      <Search className="size-5" aria-hidden />
    </button>
  ) : null;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr] print:block">
      {/* Ecrane mari: meniu lateral luminos, ca bara laterală din aplicațiile Apple */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line/70 bg-surface/80 backdrop-blur-xl md:flex">
        <div className="flex h-16 items-center justify-between gap-2 pl-5 pr-3">
          {Brand}
          {BellLink}
        </div>
        {searchable ? (
          <div className="px-3 pb-3">
            <button type="button" onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] bg-sunken px-3 text-left text-[0.9375rem] text-ink-3 transition-colors hover:bg-line">
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{t.search.open}</span>
              <kbd className="font-sans text-xs text-ink-3">⌘K</kbd>
            </button>
          </div>
        ) : null}
        <nav aria-label="Meniu principal" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
          {items.map((it) => {
            const Icon = ICONS[it.icon] ?? House;
            return (
              <Link key={it.href + it.key} href={it.href} aria-current={isActive(it) ? "page" : undefined}
                className={cn("flex h-9 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[0.9375rem] transition-colors",
                  isActive(it) ? "bg-brand/10 font-semibold text-brand" : "font-medium text-ink-2 hover:bg-sunken hover:text-ink")}>
                <Icon className={cn("size-[1.125rem] shrink-0", isActive(it) ? "text-brand" : "text-ink-3")} aria-hidden />
                {label(it.key)}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-[0.75rem] bg-canvas p-3">
          <p className="truncate text-[0.9375rem] font-semibold">{userName}</p>
          <p className="truncate text-[0.8125rem] text-ink-3">{roleLabel}</p>
          {memberships.length > 1 ? <RoleSwitcher memberships={memberships} tone="plain" /> : null}
          <form action={signOut} onSubmit={clearOfflinePages}>
            <button type="submit" className="-mx-1 mt-2 flex h-8 w-[calc(100%+0.5rem)] items-center gap-2 rounded-[0.5rem] px-1 text-[0.875rem] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
              <LogOut className="size-4" aria-hidden /> {t.actions.signOut}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Telefon: bară de sus */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line/70 bg-surface/80 pl-4 pr-2 backdrop-blur-xl pt-safe md:hidden">
          <div className="flex h-14 min-w-0 items-center">{Brand}</div>
          <div className="flex items-center">
            {SearchButton}
            {BellLink}
          </div>
        </header>

        {notice ? <div className="no-print">{notice}</div> : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-8">
          {showSections ? (
            <nav aria-label={label(sectionMatch?.group.key ?? "performance")} className="no-print -mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
              {/* secțiunile: control segmentat; sub-filele: capsule sub el */}
              <ul className="inline-flex gap-1 rounded-[0.75rem] bg-sunken p-1">
                {sections.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} aria-current={currentSection === s.key ? "page" : undefined}
                      className={cn("flex h-8 items-center whitespace-nowrap rounded-[0.5rem] px-3.5 text-[0.875rem] transition-colors",
                        currentSection === s.key ? "bg-surface font-medium text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "font-medium text-ink-2 hover:text-ink")}>
                      {label(s.key)}
                    </Link>
                  </li>
                ))}
              </ul>
              {subTabs.length ? (
                <ul className="mt-3 flex gap-1" aria-label={label(currentSection ?? "")}>
                  {subTabs.map((x) => (
                    <li key={x.href}>
                      <Link href={x.href} aria-current={currentSub === x.key ? "page" : undefined}
                        className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[0.875rem] transition-colors",
                          currentSub === x.key ? "bg-brand/10 font-semibold text-brand" : "font-medium text-ink-2 hover:bg-sunken hover:text-ink")}>
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
        <nav aria-label="Meniu principal" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/85 pb-safe backdrop-blur-xl md:hidden">
          <ul className="mx-auto flex max-w-lg">
            {primary.map((it) => {
              const Icon = ICONS[it.icon] ?? House;
              const on = isActive(it);
              return (
                <li key={it.href + it.key} className="flex-1">
                  <Link href={it.href} aria-current={on ? "page" : undefined}
                    className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium", on ? "text-brand" : "text-ink-3")}>
                    <Icon className="size-6" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                    {label(it.key)}
                  </Link>
                </li>
              );
            })}
            {overflow.length ? (
              <li className="flex-1">
                <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}
                  className={cn("flex h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
                    overflow.some(isActive) ? "text-brand" : "text-ink-3")}>
                  <Ellipsis className="size-6" strokeWidth={overflow.some(isActive) ? 2.25 : 1.75} aria-hidden />
                  {t.nav.more}
                </button>
              </li>
            ) : null}
          </ul>
        </nav>

        {moreOpen ? (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label={t.nav.more}>
            <button type="button" aria-label={t.actions.close} className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-float)]">
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line-strong" aria-hidden />
              <div className="flex items-center justify-between pb-2 pl-1">
                <div>
                  <p className="font-semibold">{userName}</p>
                  <p className="text-sm text-ink-3">{roleLabel}</p>
                </div>
                <button type="button" onClick={() => setMoreOpen(false)} aria-label={t.actions.close} className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-ink-2 hover:bg-line">
                  <X className="size-4" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
              {memberships.length > 1 ? <div className="px-2 pb-2"><RoleSwitcher memberships={memberships} tone="plain" /></div> : null}
              <ul className="my-2 divide-y divide-line overflow-hidden rounded-[0.75rem] bg-surface">
                {overflow.map((it) => {
                  const Icon = ICONS[it.icon] ?? House;
                  return (
                    <li key={it.href + it.key}>
                      <Link href={it.href} onClick={() => setMoreOpen(false)} aria-current={isActive(it) ? "page" : undefined}
                        className={cn("flex h-12 items-center gap-3 px-4 text-[0.9375rem] font-medium active:bg-sunken",
                          isActive(it) ? "text-brand" : "text-ink")}>
                        <Icon className={cn("size-5 shrink-0", isActive(it) ? "text-brand" : "text-ink-3")} aria-hidden />
                        {label(it.key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <form action={signOut} onSubmit={clearOfflinePages}>
                <button type="submit" className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-[0.75rem] bg-surface font-medium text-st-red">
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
