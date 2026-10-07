/** Normalizare pentru comparații: majuscule, fără diacritice, fără punctuație. */
export function norm(input: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function tokens(input: unknown): string[] {
  const n = norm(input);
  return n ? n.split(" ") : [];
}

export function cell(input: unknown): string {
  if (input === null || input === undefined) return "";
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return String(input).replace(/\s+/g, " ").trim();
}

/** „POPESCU ANDREI" -> „Popescu Andrei" (pentru afișare; numele de afișare rămân cum le scrie clubul). */
export function titleCase(input: string): string {
  return input
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s\-'.])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("ro"));
}

export function initials(name: string): string {
  const t = name.trim().split(/\s+/).filter(Boolean);
  if (!t.length) return "?";
  return (t[0][0] + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
}
