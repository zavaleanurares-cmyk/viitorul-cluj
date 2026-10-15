import { can, type AppRole, type Capability } from "@club/shared";

/**
 * Locker Room are șase spații de lucru: Azi, Program, Lot, Performanță, Bani, Club.
 * `match` = alte rute care aparțin aceluiași spațiu (pentru evidențierea în meniu).
 */
export type NavItem = { href: string; key: string; icon: string; match?: string[] };

/** Secțiunile spațiului Performanță (modulele Vestiar), cu dreptul care le deschide. */
export const PERFORMANCE_SECTIONS: Array<{ href: string; key: string; cap: Capability }> = [
  { href: "/tablou", key: "overview", cap: "viewOverview" },
  { href: "/disponibilitate", key: "availability", cap: "viewAvailabilityBoard" },
  { href: "/jucatori", key: "medicalFiles", cap: "viewPlayerList" },
  { href: "/wellness", key: "wellness", cap: "viewWellnessGrid" },
  { href: "/fizic", key: "physical", cap: "viewPhysicalData" },
  { href: "/planuri", key: "plans", cap: "manage" },
  { href: "/programe", key: "programs", cap: "manage" },
  { href: "/biblioteca", key: "library", cap: "manage" },
  { href: "/import", key: "imports", cap: "manage" },
  { href: "/rapoarte", key: "reports", cap: "manage" },
];

export function performanceSections(role: AppRole) {
  return PERFORMANCE_SECTIONS.filter((s) => can(role, s.cap));
}

/** Secțiunile spațiului Bani. Prezentarea și bugetul arată doar cifre agregate; restul e registrul pe familii. */
export const MONEY_SECTIONS: Array<{ href: string; key: string; cap: Capability }> = [
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
  return MONEY_SECTIONS.filter((s) => can(role, s.cap));
}

/** Toate grupurile de file ale rolului (pentru AppShell). */
export function sectionGroups(role: AppRole) {
  return [
    { key: "performance", sections: performanceSections(role) },
    { key: "money", sections: moneySections(role) },
  ].filter((g) => g.sections.length > 0);
}

const PERFORMANCE_MATCH = [...PERFORMANCE_SECTIONS.map((s) => s.href), "/exercitii"];

const today: NavItem = { href: "/azi", key: "today", icon: "home" };
const schedule: NavItem = { href: "/program", key: "schedule", icon: "calendar" };
const squad: NavItem = { href: "/lot", key: "squad", icon: "users" };
const club: NavItem = { href: "/administrare", key: "club", icon: "settings" };
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
  coach: [today, schedule, squad, performance("/disponibilitate"), purchases, profile],
  physio: [{ ...today, href: "/tablou" }, schedule, squad, performance("/disponibilitate"), club, purchases, profile],
  sporting_director: [today, schedule, squad, performance("/tablou"), money, profile],
  admin: [today, schedule, squad, money, club, profile],
  secretary: [today, schedule, squad, money, profile],
  accountant: [today, money, squad, profile],
  owner: [{ href: "/tablou", key: "overview", icon: "dashboard" }, money, profile],
  guardian: [today, { href: "/plati", key: "familyPayments", icon: "wallet" }, profile],
  medical_partner: [
    { href: "/cazuri", key: "cases", icon: "stethoscope" },
    profile,
  ],
};
