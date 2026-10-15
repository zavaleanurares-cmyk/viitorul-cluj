/**
 * Date standard pentru Performanță (faza 4): baterii de teste și modele de evaluare gata făcute.
 * Folosite de aplicație și de seed-ul demo.
 */

export type StandardTest = { code: string; name: string; unit: string; lower_is_better: boolean; description: string };
export type StandardBattery = { key: string; name: string; description: string; tests: StandardTest[] };

const T = {
  sprint_10: { code: "sprint_10", name: "Sprint 10 m", unit: "s", lower_is_better: true, description: "Start din picioare, cel mai bun din 2 încercări, celule fotoelectrice sau cronometru." },
  sprint_20: { code: "sprint_20", name: "Sprint 20 m", unit: "s", lower_is_better: true, description: "Start din picioare, cel mai bun din 2 încercări." },
  sprint_30: { code: "sprint_30", name: "Sprint 30 m", unit: "s", lower_is_better: true, description: "Start din picioare, cel mai bun din 2 încercări." },
  cmj: { code: "cmj", name: "Săritură CMJ", unit: "cm", lower_is_better: false, description: "Countermovement jump, mâinile pe șold, cea mai bună din 3." },
  slj: { code: "slj", name: "Săritură în lungime de pe loc", unit: "cm", lower_is_better: false, description: "Desprindere pe ambele picioare, cea mai bună din 3." },
  agility_505: { code: "agility_505", name: "Agilitate 5-0-5", unit: "s", lower_is_better: true, description: "Întoarcere pe piciorul preferat, cea mai bună din 2." },
  t_test: { code: "t_test", name: "T-test", unit: "s", lower_is_better: true, description: "Deplasări înainte, laterale și înapoi pe traseul în T." },
  yoyo_ir1: { code: "yoyo_ir1", name: "Yo-Yo IR1", unit: "m", lower_is_better: false, description: "Distanța totală până la a doua ratare a semnalului." },
  yoyo_ir1_kids: { code: "yoyo_ir1_kids", name: "Yo-Yo IR1 copii", unit: "m", lower_is_better: false, description: "Varianta pentru copii (16 m), distanța totală." },
  sit_reach: { code: "sit_reach", name: "Sit and reach", unit: "cm", lower_is_better: false, description: "Flexibilitatea lanțului posterior, cea mai bună din 2." },
  plank: { code: "plank", name: "Planșă", unit: "s", lower_is_better: false, description: "Timpul menținut cu poziția corectă." },
  slalom_ball: { code: "slalom_ball", name: "Slalom cu mingea", unit: "s", lower_is_better: true, description: "Traseu cu 6 jaloane la 2 m, dus-întors." },
  juggling: { code: "juggling", name: "Jonglerii", unit: "rep.", lower_is_better: false, description: "Numărul maxim de atingeri fără ca mingea să cadă, cea mai bună din 2." },
} satisfies Record<string, StandardTest>;

export const STANDARD_BATTERIES: StandardBattery[] = [
  { key: "speed", name: "Viteză și forță", description: "Pentru U13 și mai mari: accelerație, viteză maximă, forță explozivă, schimbare de direcție.", tests: [T.sprint_10, T.sprint_30, T.cmj, T.agility_505] },
  { key: "endurance", name: "Rezistență și mobilitate", description: "Capacitatea aerobă intermitentă și flexibilitatea.", tests: [T.yoyo_ir1, T.sit_reach, T.plank] },
  { key: "kids", name: "Copii (U8–U12)", description: "Teste simple, cu mingea, potrivite vârstei.", tests: [T.sprint_20, T.slj, T.slalom_ball, T.juggling, T.yoyo_ir1_kids] },
  { key: "agility", name: "Agilitate", description: "Schimbări de direcție pe două trasee.", tests: [T.agility_505, T.t_test] },
];

/** Percentila unui rezultat în grup (0–100): cât la sută din ceilalți au rezultate mai slabe; egalitățile contează pe jumătate. */
export function percentileOf(value: number, all: number[], lowerIsBetter: boolean): number | null {
  if (all.length < 3) return null;
  const worse = all.filter((v) => (lowerIsBetter ? v > value : v < value)).length;
  const ties = all.filter((v) => v === value).length - 1;
  return Math.round(((worse + ties / 2) / (all.length - 1)) * 100);
}

/** Modele de evaluare gata făcute, pe grupe de vârstă. Criterii scurte, observabile la antrenament și la meci. */
export type Category = "technical" | "tactical" | "physical" | "mental";
export const CATEGORIES: Category[] = ["technical", "tactical", "physical", "mental"];
export type StandardTemplate = { key: string; name: string; age_label: string; criteria: Array<{ category: Category; name: string; description?: string }> };

export const STANDARD_TEMPLATES: StandardTemplate[] = [
  {
    key: "foundation", name: "Formare", age_label: "U8–U12",
    criteria: [
      { category: "technical", name: "Conducerea mingii" },
      { category: "technical", name: "Pasa" },
      { category: "technical", name: "Preluarea" },
      { category: "technical", name: "Șutul" },
      { category: "tactical", name: "Demarcajul", description: "Se oferă pentru pasă, caută spațiul liber." },
      { category: "tactical", name: "Reacția la pierderea mingii" },
      { category: "physical", name: "Coordonare și echilibru" },
      { category: "physical", name: "Viteză de reacție" },
      { category: "mental", name: "Atitudinea la antrenament" },
      { category: "mental", name: "Joc de echipă" },
    ],
  },
  {
    key: "development", name: "Dezvoltare", age_label: "U13–U16",
    criteria: [
      { category: "technical", name: "Prima atingere" },
      { category: "technical", name: "Pasa scurtă și lungă" },
      { category: "technical", name: "Dribling 1 la 1" },
      { category: "technical", name: "Finalizarea" },
      { category: "technical", name: "Jocul cu capul" },
      { category: "tactical", name: "Înțelegerea jocului", description: "Citește faza, alege soluția potrivită." },
      { category: "tactical", name: "Poziționarea defensivă" },
      { category: "tactical", name: "Tranzițiile" },
      { category: "physical", name: "Viteza" },
      { category: "physical", name: "Rezistența" },
      { category: "physical", name: "Forța în duel" },
      { category: "mental", name: "Concentrarea" },
      { category: "mental", name: "Comunicarea pe teren" },
      { category: "mental", name: "Reziliența", description: "Cum reacționează după o greșeală sau un gol primit." },
      { category: "mental", name: "Disciplina" },
    ],
  },
  {
    key: "performance", name: "Performanță", age_label: "U17 și seniori",
    criteria: [
      { category: "technical", name: "Calitatea pasei sub presiune" },
      { category: "technical", name: "Jocul 1 la 1 (ofensiv)" },
      { category: "technical", name: "Jocul 1 la 1 (defensiv)" },
      { category: "technical", name: "Finalizarea / fazele fixe" },
      { category: "tactical", name: "Decizia sub presiune" },
      { category: "tactical", name: "Disciplina tactică" },
      { category: "tactical", name: "Tranzițiile" },
      { category: "physical", name: "Viteza și accelerația" },
      { category: "physical", name: "Capacitatea de a repeta sprinturile" },
      { category: "physical", name: "Forța" },
      { category: "mental", name: "Leadership" },
      { category: "mental", name: "Profesionalism", description: "Punctualitate, recuperare, somn, alimentație." },
      { category: "mental", name: "Reziliența" },
    ],
  },
];

/** Șabloane de mesaje gata făcute (clubul își poate salva altele). */
export const STANDARD_MESSAGE_TEMPLATES: Array<{ key: string; name: string; title: string; body: string }> = [
  { key: "cancelled", name: "Antrenament anulat", title: "Antrenamentul de azi se anulează", body: "Bună ziua,\n\nAntrenamentul de azi nu are loc. Ne vedem la următorul, conform programului din aplicație.\n\nMulțumim!" },
  { key: "callup", name: "Convocare la meci", title: "Convocare: meciul de sâmbătă", body: "Bună ziua,\n\nLotul pentru meciul de sâmbătă este în aplicație, la Program. Întâlnirea este cu o oră înainte de meci, la teren.\n\nVă rugăm să confirmați dacă un copil nu poate veni." },
  { key: "schedule", name: "Schimbare de program", title: "Programul se schimbă", body: "Bună ziua,\n\nÎncepând de săptămâna viitoare, programul echipei se modifică. Orele noi sunt în aplicație, la Program." },
  { key: "kit", name: "Echipament", title: "Echipamentul pentru sezonul nou", body: "Bună ziua,\n\nEchipamentul pentru sezonul nou se poate ridica de la secretariatul clubului. Mărimile le găsiți în aplicație." },
  { key: "meeting", name: "Ședință cu părinții", title: "Ședință cu părinții", body: "Bună ziua,\n\nVă invităm la o ședință cu părinții. Detaliile (data, ora, locul) sunt mai jos.\n\n" },
];
