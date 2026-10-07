import type { AppRole } from "@club/shared";

export type NavItem = { href: string; key: string; icon: string };

/** Meniul fiecărui rol. Primele patru intrări apar în bara de jos pe telefon; restul sub „Mai mult". */
export const NAV: Record<AppRole, NavItem[]> = {
  player: [
    { href: "/azi", key: "today", icon: "home" },
    { href: "/chestionar", key: "questionnaire", icon: "clipboard" },
    { href: "/plan", key: "plan", icon: "calendar" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
  coach: [
    { href: "/disponibilitate", key: "availability", icon: "pulse" },
    { href: "/jucatori", key: "players", icon: "users" },
    { href: "/wellness", key: "wellness", icon: "clipboard" },
    { href: "/fizic", key: "physical", icon: "gauge" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
  physio: [
    { href: "/tablou", key: "overview", icon: "dashboard" },
    { href: "/disponibilitate", key: "availability", icon: "pulse" },
    { href: "/jucatori", key: "players", icon: "users" },
    { href: "/wellness", key: "wellness", icon: "clipboard" },
    { href: "/planuri", key: "plans", icon: "calendar" },
    { href: "/programe", key: "programs", icon: "list" },
    { href: "/biblioteca", key: "library", icon: "dumbbell" },
    { href: "/fizic", key: "physical", icon: "gauge" },
    { href: "/import", key: "imports", icon: "upload" },
    { href: "/rapoarte", key: "reports", icon: "file" },
    { href: "/administrare", key: "admin", icon: "settings" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
  sporting_director: [
    { href: "/tablou", key: "overview", icon: "dashboard" },
    { href: "/disponibilitate", key: "availability", icon: "pulse" },
    { href: "/jucatori", key: "players", icon: "users" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
  owner: [
    { href: "/tablou", key: "overview", icon: "dashboard" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
  medical_partner: [
    { href: "/cazuri", key: "cases", icon: "stethoscope" },
    { href: "/profil", key: "profile", icon: "user" },
  ],
};
