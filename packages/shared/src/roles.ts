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
  admin: "Administrează clubul: conturi, echipe, setări, lot, program și bani.",
  secretary: "Gestionează lotul, părinții, programul, terenurile și competițiile; încasează taxele.",
  accountant: "Se ocupă de bani: taxe, plăți, chitanțe, extrase, cheltuieli, buget. Vede lotul.",
  guardian: "Vede programul și situația copiilor lui și plătește taxele.",
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
  // Bani (faza 3)
  /** registrul pe familii: taxe, plăți, chitanțe, extrase, cheltuieli */
  manageMoney: ["admin", "secretary", "accountant"],
  /** cifrele agregate (fără rânduri pe familii): prezentare, buget */
  viewMoneySummary: ["admin", "secretary", "accountant", "sporting_director", "owner"],
  /** setări financiare, buget, prime, returnări */
  administerMoney: ["admin", "accountant"],
  /** referatele de necesitate (cererea; aprobarea depinde de setările clubului) */
  purchaseRequests: ["admin", "secretary", "accountant", "sporting_director", "physio", "coach", "owner"],
  /** ecranul de plăți al familiei */
  familyPayments: ["guardian", "player"],
  // Performanță (faza 4)
  /** detaliile medicale de pe rândul jucătorului (nota stării, zona, restricțiile); oglindește `private.db_role_for` */
  readHealth: ["physio", "coach", "sporting_director", "player", "medical_partner"],
  /** vizele medicale ale lotului (antrenorul: echipele lui) */
  viewVisas: ["admin", "secretary", "sporting_director", "physio", "coach"],
  /** aprobă documentele de viză și trimite reamintiri */
  manageVisas: ["admin", "secretary", "physio"],
  // Club (faza 4)
  /** trimite mesaje (antrenorul și preparatorul: echipelor lor) */
  clubMessages: ["admin", "secretary", "sporting_director", "physio", "coach"],
  /** cererile de înscriere, probele, înscrierea */
  manageEnrolment: ["admin", "secretary", "sporting_director"],
  /** contractele și documentele de semnat */
  manageContracts: ["admin", "secretary"],
  /** taberele: înscrieri, plăți, participanți */
  manageCamps: ["admin", "secretary"],
  /** site-ul public: știri, echipe, sponsori, galerii, contact */
  manageWebsite: ["admin", "secretary"],
  /** magazinul: produse, mărimi, comenzi */
  manageShop: ["admin", "secretary", "accountant"],
  /** suporteri: redirecționarea 230, sponsorizări */
  manageSupporters: ["admin", "secretary", "accountant"],
  /** evaluări, video, statistici sportive */
  viewAnalysis: ["sporting_director", "physio", "coach"],
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
