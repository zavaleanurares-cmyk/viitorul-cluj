/** Etichete în română pentru valorile stocate ca text în baza de date. */

export const EXERCISE_CATEGORIES = {
  prevention: "Prevenție",
  recovery: "Recuperare",
  kinetotherapy: "Kinetoterapie",
  mobility: "Mobilitate",
  strength: "Forță",
  activation: "Activare",
} as const;
export type ExerciseCategory = keyof typeof EXERCISE_CATEGORIES;

export const EXERCISE_LEVELS = { beginner: "Începător", intermediate: "Mediu", advanced: "Avansat" } as const;

export const EQUIPMENT = {
  none: "Fără echipament",
  mat: "Saltea",
  band: "Bandă elastică",
  miniband: "Mini-bandă",
  foam_roller: "Rulou de masaj",
  ball: "Minge",
  swiss_ball: "Minge de gimnastică",
  dumbbell: "Gantere",
  kettlebell: "Kettlebell",
  barbell: "Bară",
  bench: "Bancă",
  box: "Cutie / treaptă",
  balance: "Placă de echilibru",
  partner: "Partener",
  cones: "Jaloane",
  slider: "Discuri de alunecare",
  machine: "Aparat",
} as const;
export type EquipmentCode = keyof typeof EQUIPMENT;

export const PROGRAM_KINDS = { prevention: "Prevenție", recovery: "Recuperare", warmup: "Încălzire", other: "Altul" } as const;

export const ASSIGNMENT_TARGETS = { player: "Un jucător", group: "O grupă", position: "Un post", manual: "Selecție manuală" } as const;

export const POSITIONS = { GK: "Portar", DEF: "Fundaș", MID: "Mijlocaș", FWD: "Atacant" } as const;
export type PositionCode = keyof typeof POSITIONS;

export const FEET = { left: "Stângul", right: "Dreptul", both: "Ambele" } as const;

export const INJURY_TYPES = {
  muscle: "Musculară",
  ligament: "Ligamentară",
  tendon: "Tendinoasă",
  bone: "Osoasă / fractură",
  joint: "Articulară",
  contusion: "Contuzie",
  concussion: "Comoție",
  overuse: "Suprasolicitare",
  other: "Altul",
} as const;

export const INJURY_CONTACT = { contact: "Cu contact", non_contact: "Fără contact", unknown: "Necunoscut" } as const;
export const INJURY_CONTEXT = { training: "La antrenament", match: "La meci", other: "În afara activității", unknown: "Necunoscut" } as const;
export const INJURY_SEVERITY = {
  minor: "Ușoară (1–7 zile)",
  moderate: "Moderată (8–28 de zile)",
  severe: "Severă (peste 28 de zile)",
  unknown: "Neevaluată",
} as const;

/** Etapele de revenire în joc (return-to-play). */
export const RTP_STAGES = [
  "Repaus / tratament",
  "Recuperare în sală",
  "Alergare și lucru individual pe teren",
  "Antrenament cu grupa, fără contact",
  "Antrenament complet",
  "Apt de joc",
] as const;

export const DOCUMENT_KINDS = {
  mri: "RMN",
  ultrasound: "Ecografie",
  xray: "Radiografie",
  letter: "Scrisoare medicală",
  lab: "Analize",
  consent: "Acord semnat",
  other: "Alt document",
} as const;

export const SESSION_TYPES = { training: "Antrenament", match: "Meci", test: "Testare", other: "Altceva" } as const;

export const ALERT_KINDS = {
  fatigue_high: "Oboseală ridicată",
  muscle_load_high: "Încărcătură musculară ridicată",
  fatigue_spike: "Creștere bruscă a oboselii",
  pain_reported: "Durere raportată",
  exercise_pain: "Durere la exerciții",
  missing_wellness: "Chestionar necompletat",
  visa_expiring: "Viză medicală",
} as const;

export const IMPORT_KINDS = {
  health_status: "Stare de sănătate",
  fatigue_grid: "Chestionar săptămânal",
  roster: "Listă nominală",
  physical: "Date fizice (K-Sport)",
  tests: "Teste fizice",
} as const;

export const AUDIT_ACTIONS = {
  INSERT: "Adăugare", UPDATE: "Modificare", DELETE: "Ștergere", READ: "Vizualizare",
  EXPORT: "Export", DOWNLOAD: "Descărcare", LOGIN: "Autentificare", CONSENT: "Consimțământ",
} as const;

export const AUDIT_ENTITIES: Record<string, string> = {
  players: "Jucător", player_contacts: "Date de contact", anthropometrics: "Antropometrie",
  injuries: "Accidentare", injury_treatments: "Tratament", medical_documents: "Document medical",
  referrals: "Trimitere", partner_notes: "Notă partener", wellness_entries: "Chestionar", rpe_entries: "RPE",
  fitness_test_results: "Test fizic", daily_plans: "Plan zilnic", programs: "Program",
  program_assignments: "Alocare program", exercises: "Exercițiu", profiles: "Cont", staff_groups: "Grupe staff",
  groups: "Grupă", clubs: "Club", club_statuses: "Stare", consents: "Consimțământ", data_requests: "Cerere GDPR",
  imports: "Import", raport_saptamanal: "Raport săptămânal", lista_jucatori: "Lista jucătorilor", auth: "Autentificare", fisa: "Fișa jucătorului", medical: "Fișa medicală", wellness: "Chestionare", fizic: "Date fizice",
  documente: "Documente",
};

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined, fallback = "—"): string {
  return key && key in map ? map[key as keyof T] : key || fallback;
}
