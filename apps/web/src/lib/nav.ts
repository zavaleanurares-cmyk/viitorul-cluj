import { can, type AppRole, type Capability } from "@club/shared";

/**
 * Locker Room are șase spații de lucru: Azi, Program, Lot, Performanță, Bani (faza 3), Club.
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

const PERFORMANCE_MATCH = [...PERFORMANCE_SECTIONS.map((s) => s.href), "/exercitii"];

const today: NavItem = { href: "/azi", key: "today", icon: "home" };
const schedule: NavItem = { href: "/program", key: "schedule", icon: "calendar" };
const squad: NavItem = { href: "/lot", key: "squad", icon: "users" };
const club: NavItem = { href: "/administrare", key: "club", icon: "settings" };
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
  coach: [today, schedule, squad, performance("/disponibilitate"), profile],
  physio: [{ ...today, href: "/tablou" }, schedule, squad, performance("/disponibilitate"), club, profile],
  sporting_director: [today, schedule, squad, performance("/tablou"), profile],
  admin: [today, schedule, squad, club, profile],
  secretary: [today, schedule, squad, profile],
  accountant: [today, squad, profile],
  owner: [{ href: "/tablou", key: "overview", icon: "dashboard" }, profile],
  guardian: [today, profile],
  medical_partner: [
    { href: "/cazuri", key: "cases", icon: "stethoscope" },
    profile,
  ],
};
