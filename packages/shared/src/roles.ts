import type { Database } from "./database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Patron",
  sporting_director: "Director sportiv",
  physio: "Preparator fizic",
  coach: "Antrenor",
  player: "Jucător",
  medical_partner: "Partener medical",
  admin: "Administrator",
  secretary: "Secretariat",
  accountant: "Contabil",
  guardian: "Părinte",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Vede situația de ansamblu a clubului, fără date individuale.",
  sporting_director: "Vede lotul, programul și situația fiecărui jucător; programează evenimente.",
  physio: "Vede și modifică tot ce ține de performanță: stare medicală, exerciții, programe, planuri, importuri; administrează conturile.",
  coach: "Vede echipele lui: lot, program, disponibilitate, fișa medicală. Face prezența și conduce meciurile.",
  player: "Vede doar pagina lui: planul zilei, chestionarul, exercițiile, profilul.",
  medical_partner: "Vede doar jucătorii trimiși către el și adaugă note și documente pe acele cazuri.",
  admin: "Administrează clubul: conturi, echipe, setări, lot și program.",
  secretary: "Gestionează lotul, părinții, programul, terenurile și competițiile.",
  accountant: "Vede lotul și se ocupă de bani: taxe, plăți, cheltuieli.",
  guardian: "Vede programul și situația copiilor lui.",
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
  // Locker Room
  administerClub: ["admin", "physio"],
  viewSquad: ["admin", "secretary", "sporting_director", "physio", "coach", "accountant"],
  manageSquad: ["admin", "secretary", "sporting_director", "physio"],
  viewSchedule: ["admin", "secretary", "sporting_director", "physio", "coach", "accountant"],
  manageSchedule: ["admin", "secretary", "sporting_director", "physio"],
  runEvents: ["admin", "secretary", "sporting_director", "physio", "coach"],
  guardianHome: ["guardian"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  return !!role && (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}

/** Pagina de start a fiecărui rol. */
export function homePath(role: AppRole): string {
  switch (role) {
    case "medical_partner": return "/cazuri";
    case "owner":
    case "physio": return "/tablou";
    default: return "/azi";
  }
}
