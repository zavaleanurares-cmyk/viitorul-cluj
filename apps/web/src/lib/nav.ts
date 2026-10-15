import { can, type AppRole, type Capability } from "@club/shared";

/**
 * Locker Room are șase spații de lucru: Azi, Program, Lot, Performanță, Bani, Club.
 * `match` = alte rute care aparțin aceluiași spațiu (pentru evidențierea în meniu).
 */
export type NavItem = { href: string; key: string; icon: string; match?: string[] };

/** O filă de spațiu de lucru; `tabs` = sub-file (al doilea rând), `match` = alte rute care țin de filă. */
export type Section = { href: string; key: string; cap: Capability; match?: string[]; tabs?: Array<{ href: string; key: string; cap: Capability }> };
export type VisibleSection = { href: string; key: string; match?: string[]; tabs?: Array<{ href: string; key: string }> };

/**
 * Spațiul Performanță (Vestiar + faza 4), grupat ca să rămână cel mult opt file:
 * fiecare grup deschide prima sub-filă pe care rolul o poate vedea.
 */
export const PERFORMANCE_SECTIONS: Section[] = [
  { href: "/tablou", key: "overview", cap: "viewOverview" },
  { href: "/disponibilitate", key: "availability", cap: "viewAvailabilityBoard" },
  { href: "/performanta/medical", key: "medical", cap: "viewMedicalFile" },
  {
    href: "/wellness", key: "monitoring", cap: "viewWellnessGrid",
    tabs: [
      { href: "/wellness", key: "wellness", cap: "viewWellnessGrid" },
      { href: "/performanta/incarcare", key: "load", cap: "viewWellnessGrid" },
      { href: "/performanta/corp", key: "body", cap: "viewWellnessGrid" },
    ],
  },
  {
    href: "/fizic", key: "physical", cap: "viewPhysicalData",
    tabs: [
      { href: "/fizic", key: "sessions", cap: "viewPhysicalData" },
      { href: "/fizic/teste", key: "tests", cap: "viewPhysicalData" },
    ],
  },
  {
    href: "/performanta/evaluari", key: "analysis", cap: "viewAnalysis",
    tabs: [
      { href: "/performanta/evaluari", key: "evaluations", cap: "viewAnalysis" },
      { href: "/performanta/video", key: "video", cap: "viewAnalysis" },
      { href: "/performanta/statistici", key: "stats", cap: "viewAnalysis" },
    ],
  },
  {
    href: "/planuri", key: "recovery", cap: "manage", match: ["/exercitii"],
    tabs: [
      { href: "/planuri", key: "plans", cap: "manage" },
      { href: "/programe", key: "programs", cap: "manage" },
      { href: "/biblioteca", key: "library", cap: "manage" },
    ],
  },
  {
    href: "/rapoarte", key: "tools", cap: "manage",
    tabs: [
      { href: "/rapoarte", key: "reports", cap: "manage" },
      { href: "/import", key: "imports", cap: "manage" },
    ],
  },
];

function visible(list: Section[], role: AppRole): VisibleSection[] {
  return list.filter((s) => can(role, s.cap)).map((s) => {
    const tabs = s.tabs?.filter((x) => can(role, x.cap)).map(({ href, key }) => ({ href, key }));
    // fila de grup duce la prima sub-filă vizibilă
    const href = tabs?.length ? tabs[0].href : s.href;
    const match = [...(s.match ?? []), ...(tabs ?? []).map((x) => x.href)];
    return { href, key: s.key, ...(match.length ? { match } : {}), ...(tabs && tabs.length > 1 ? { tabs } : {}) };
  });
}

export function performanceSections(role: AppRole) {
  return visible(PERFORMANCE_SECTIONS, role);
}

/** Secțiunile spațiului Bani. Prezentarea și bugetul arată doar cifre agregate; restul e registrul pe familii. */
export const MONEY_SECTIONS: Section[] = [
  { href: "/bani", key: "moneyOverview", cap: "viewMoneySummary" },
  { href: "/bani/taxe", key: "fees", cap: "manageMoney" },
  { href: "/bani/incasari", key: "payments", cap: "manageMoney" },
  { href: "/bani/banca", key: "bank", cap: "manageMoney" },
  { href: "/bani/cheltuieli", key: "expenses", cap: "manageMoney" },
  { href: "/bani/referate", key: "purchases", cap: "purchaseRequests" },
  { href: "/bani/buget", key: "budget", cap: "viewMoneySummary" },
  { href: "/bani/prime", key: "bonuses", cap: "administerMoney" },
  { href: "/bani/setari", key: "moneySettings", cap: "administerMoney" },
];

export function moneySections(role: AppRole) {
  return visible(MONEY_SECTIONS, role);
}

/** Spațiul Club: comunicarea și administrarea clubului. */
export const CLUB_SECTIONS: Section[] = [
  { href: "/club/mesaje", key: "messages", cap: "clubMessages" },
  { href: "/club/inscrieri", key: "enrolment", cap: "manageEnrolment" },
  { href: "/club/contracte", key: "contracts", cap: "manageContracts" },
  { href: "/club/tabere", key: "camps", cap: "manageCamps" },
  { href: "/club/site", key: "website", cap: "manageWebsite" },
  { href: "/club/magazin", key: "shop", cap: "manageShop" },
  { href: "/club/suporteri", key: "supporters", cap: "manageSupporters" },
  { href: "/administrare", key: "admin", cap: "administerClub" },
];

export function clubSections(role: AppRole) {
  return visible(CLUB_SECTIONS, role);
}

/** Toate grupurile de file ale rolului (pentru AppShell). */
export function sectionGroups(role: AppRole) {
  return [
    { key: "performance", sections: performanceSections(role) },
    { key: "money", sections: moneySections(role) },
    { key: "club", sections: clubSections(role) },
  ].filter((g) => g.sections.length > 0);
}

const PERFORMANCE_MATCH = [...new Set(PERFORMANCE_SECTIONS.flatMap((s) => [s.href, ...(s.match ?? []), ...(s.tabs ?? []).map((x) => x.href)]))];

const today: NavItem = { href: "/azi", key: "today", icon: "home" };
const schedule: NavItem = { href: "/program", key: "schedule", icon: "calendar" };
const squad: NavItem = { href: "/lot", key: "squad", icon: "users" };
const CLUB_MATCH = ["/club", "/administrare"];
/** Spațiul Club deschide prima secțiune pe care rolul o vede. */
const club = (href: string): NavItem => ({ href, key: "club", icon: "megaphone", match: CLUB_MATCH });
const money: NavItem = { href: "/bani", key: "money", icon: "wallet" };
/** cine vede doar referatele din spațiul Bani */
const purchases: NavItem = { href: "/bani/referate", key: "purchases", icon: "receipt" };
const profile: NavItem = { href: "/profil", key: "profile", icon: "user" };
const performance = (href: string): NavItem => ({ href, key: "performance", icon: "pulse", match: PERFORMANCE_MATCH });

/** Meniul fiecărui rol. Pe telefon: primele patru în bara de jos, restul sub „Mai mult". */
export const NAV: Record<AppRole, NavItem[]> = {
  player: [
    { href: "/azi", key: "today", icon: "home" },
    { href: "/chestionar", key: "questionnaire", icon: "clipboard" },
    { href: "/plan", key: "plan", icon: "calendar" },
    profile,
  ],
  coach: [today, schedule, squad, performance("/disponibilitate"), club("/club/mesaje"), purchases, profile],
  physio: [{ ...today, href: "/tablou" }, schedule, squad, performance("/disponibilitate"), club("/club/mesaje"), purchases, profile],
  sporting_director: [today, schedule, squad, performance("/tablou"), money, club("/club/mesaje"), profile],
  admin: [today, schedule, squad, money, club("/club/mesaje"), profile],
  secretary: [today, schedule, squad, money, club("/club/mesaje"), profile],
  accountant: [today, money, squad, club("/club/magazin"), profile],
  owner: [{ href: "/tablou", key: "overview", icon: "dashboard" }, money, profile],
  guardian: [today, { href: "/plati", key: "familyPayments", icon: "wallet" }, { href: "/mesaje", key: "inbox", icon: "megaphone", match: ["/clipuri", "/evaluari"] }, profile],
  medical_partner: [
    { href: "/cazuri", key: "cases", icon: "stethoscope" },
    profile,
  ],
};
