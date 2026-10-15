/** Site-ul public și știrile: blocurile editorului, textele de pornire. */

export type SiteBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "quote"; text: string; by?: string }
  | { type: "list"; items: string[] }
  | { type: "image"; path: string; alt?: string; caption?: string };

export const BLOCK_TYPES = ["paragraph", "heading", "image", "quote", "list"] as const;

/** Rezumatul implicit: primul paragraf, tăiat la ~200 de caractere pe un cuvânt întreg. */
export function blocksExcerpt(blocks: SiteBlock[], max = 200): string {
  const p = blocks.find((b): b is { type: "paragraph"; text: string } => b.type === "paragraph" && !!b.text.trim());
  if (!p) return "";
  const text = p.text.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : max).trimEnd()}…`;
}

/** Secțiunile site-ului, în ordinea din meniu; `fallback` = starea dacă clubul nu a ales. */
export const SITE_SECTIONS = [
  { key: "news", fallback: true },
  { key: "teams", fallback: true },
  { key: "camps", fallback: true },
  { key: "gallery", fallback: true },
  { key: "enrolment", fallback: true },
  { key: "support", fallback: true },
  { key: "contact", fallback: true },
] as const;

/**
 * Textul de pornire al politicii de confidențialitate a site-ului. E un punct de plecare, nu un aviz juridic:
 * clubul îl completează și îl verifică (de preferat cu un jurist) înainte de publicare.
 */
export const PRIVACY_POLICY_STARTER = `Cine suntem
{{club}} administrează acest site și aplicația clubului. Pentru orice întrebare despre datele tale ne poți scrie la [adresa de e-mail a clubului].

Ce date colectăm pe site
- Formularul de înscriere: numele și data nașterii copilului, numele și datele de contact ale părintelui, informațiile pe care alegi să ni le scrii.
- Formularul pentru tabere: aceleași date și, opțional, informații pentru organizatori (de exemplu alergii).
- Formularul 230: datele completate se folosesc doar pentru a genera documentul și nu se păstrează pe server; păstrăm numele și adresa de contact dacă bifezi că vrei să fii anunțat.
Nu folosim cookie-uri de marketing și nu urmărim vizitatorii.

De ce le folosim
Ca să te contactăm despre înscriere sau tabără și să organizăm activitatea. Temeiul este consimțământul tău (formularele) și contractul cu familia (după înscriere).

Cât le păstrăm
Cererile de înscriere care nu ajung la înscriere se șterg în cel mult 12 luni. Informațiile pentru organizatorii taberelor și contactele copiilor din afara clubului se șterg la 30 de zile după tabără.

Fotografii
Publicăm fotografii cu copii doar dacă părintele și-a dat acordul. Acordul se poate retrage oricând din aplicație sau printr-un mesaj către club; fotografiile dispar de pe site imediat.

Drepturile tale
Ai dreptul să ceri accesul la date, corectarea sau ștergerea lor, restricționarea prelucrării, portabilitatea și să te opui prelucrării. Poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (www.dataprotection.ro).`;

/** „Victorie în derby-ul U17" → „victorie-in-derby-ul-u17". */
export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
