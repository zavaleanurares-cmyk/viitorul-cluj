import type { Database } from "./database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Patron",
  sporting_director: "Director sportiv",
  physio: "Preparator fizic",
  coach: "Antrenor",
  player: "Jucător",
  medical_partner: "Partener medical",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Vede situația de ansamblu a clubului, fără date individuale.",
  sporting_director: "Vede situația clubului și fișa sumară a fiecărui jucător. Nu modifică nimic.",
  physio: "Vede și modifică tot: jucători, stare medicală, exerciții, programe, planuri, importuri, conturi.",
  coach: "Vede doar grupele lui: disponibilitate, fișa medicală, chestionare și date fizice. Nu modifică nimic.",
  player: "Vede doar pagina lui: planul zilei, chestionarul, exercițiile, profilul.",
  medical_partner: "Vede doar jucătorii trimiși către el și adaugă note și documente pe acele cazuri.",
};

/** Ce are voie fiecare rol în interfață. Regulile reale sunt impuse în baza de date (RLS); aici doar ascundem ce nu se aplică. */
export const CAPABILITIES = {
  viewOverview: ["owner", "sporting_director", "physio"],
  viewPlayerList: ["sporting_director", "physio", "coach"],
  viewAvailabilityBoard: ["sporting_director", "physio", "coach"],
  viewMedicalFile: ["physio", "coach"],
  viewWellnessGrid: ["physio", "coach"],
  viewPhysicalData: ["physio", "coach"],
  manage: ["physio"],
  playerHome: ["player"],
  partnerCases: ["medical_partner"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  return !!role && (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}

/** Pagina de start a fiecărui rol. */
export function homePath(role: AppRole): string {
  switch (role) {
    case "player": return "/azi";
    case "coach": return "/disponibilitate";
    case "medical_partner": return "/cazuri";
    default: return "/tablou";
  }
}
