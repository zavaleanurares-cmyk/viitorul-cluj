/** Date comune spațiului Club: mărimi de echipament, categorii de magazin. */

/** Mărimile de echipament: la copii după înălțime (cm), apoi mărimile de adult. */
export const KIT_SIZES = ["116", "128", "140", "152", "164", "XS", "S", "M", "L", "XL", "XXL"] as const;
export const SHOE_SIZES = ["28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] as const;

/** Eticheta unei mărimi de copil: „140" → „140 cm (9–10 ani)". */
const CHILD_AGES: Record<string, string> = { "116": "5–6 ani", "128": "7–8 ani", "140": "9–10 ani", "152": "11–12 ani", "164": "13–14 ani" };
export function kitSizeLabel(size: string): string {
  return CHILD_AGES[size] ? `${size} cm (${CHILD_AGES[size]})` : size;
}

/** CNP valid: 13 cifre, cifra de control corectă (ponderile 279146358279). */
export function isValidCnp(cnp: string): boolean {
  if (!/^[1-9]\d{12}$/.test(cnp)) return false;
  const w = "279146358279";
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(cnp[i]) * Number(w[i]);
  const c = sum % 11 === 10 ? 1 : sum % 11;
  return c === Number(cnp[12]);
}

export const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani", "Brăila", "Brașov", "București", "Buzău", "Călărași",
  "Caraș-Severin", "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu", "Gorj", "Harghita", "Hunedoara",
  "Ialomița", "Iași", "Ilfov", "Maramureș", "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Sălaj", "Satu Mare", "Sibiu",
  "Suceava", "Teleorman", "Timiș", "Tulcea", "Vâlcea", "Vaslui", "Vrancea",
] as const;
