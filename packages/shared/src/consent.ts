import type { AppRole } from "./roles";

/** Versiunea textului de consimțământ. Se schimbă la orice modificare de fond; utilizatorii reacceptă. */
export const CONSENT_VERSION = "2026-10-v1";

export type ConsentAudience = "player_adult" | "player_minor_guardian" | "staff";

export function consentAudience(role: AppRole, minor: boolean | null): ConsentAudience {
  if (role !== "player") return "staff";
  return minor ? "player_minor_guardian" : "player_adult";
}

/**
 * Textele afișate la primul login. `clubName` vine din configurarea clubului.
 * Formularea este un punct de plecare: clubul o validează cu responsabilul său de protecția datelor (vezi GDPR.md).
 */
export function consentText(audience: ConsentAudience, clubName: string): { title: string; intro: string; points: string[]; accept: string } {
  const who =
    "preparatorul fizic al clubului (toate datele), antrenorii grupei din care faci parte (fișa medicală completă, " +
    "chestionarele și datele fizice — doar citire), directorul sportiv (fișa sumară: datele de bază, starea curentă și istoricul stărilor, zona accidentată, observațiile, restricțiile de antrenament, data estimată de revenire și viza medicală — fără diagnostice, documente sau chestionare), " +
    "conducerea clubului (doar cifre de ansamblu, fără nume) și, dacă ești trimis la un control, partenerul medical al clubului (doar cazul respectiv)";
  if (audience === "staff") {
    return {
      title: "Confidențialitatea datelor medicale",
      intro: `Prin contul tău ai acces la date despre sănătatea jucătorilor de la ${clubName}. Sunt date sensibile, iar o parte dintre jucători sunt minori.`,
      points: [
        "Folosești datele doar pentru activitatea sportivă și medicală a clubului.",
        "Nu le copiezi, nu le fotografiezi și nu le transmiți în afara aplicației.",
        "Nu îți împrumuți contul și nu lași aplicația deschisă pe dispozitive folosite de alții.",
        "Fiecare accesare a unei fișe medicale și fiecare modificare sunt înregistrate în jurnalul de audit.",
      ],
      accept: "Am înțeles și respect aceste reguli",
    };
  }
  const data = [
    "date de identificare și de contact (nume, data nașterii, post, telefon, e-mail)",
    "starea medicală: accidentări, diagnostice, tratamente, documente medicale, viza medicală",
    "răspunsurile la chestionarul zilnic (oboseală, încărcătură musculară, zone dureroase)",
    "date fizice: măsurători, teste, date GPS de la antrenamente și meciuri",
    "programele și planurile de pregătire și ce exerciții ai bifat",
  ];
  if (audience === "player_minor_guardian") {
    return {
      title: "Acordul părintelui sau al tutorelui",
      intro: `${clubName} folosește această aplicație pentru a urmări starea medicală și pregătirea fizică a jucătorilor. Pentru că jucătorul este minor, avem nevoie de acordul unui părinte sau al tutorelui legal.`,
      points: [
        `Ce date prelucrăm: ${data.join("; ")}.`,
        `Cine le vede: ${who.replace("faci parte", "face parte jucătorul").replace("ești trimis", "este trimis")}.`,
        "De ce: prevenirea accidentărilor, recuperare și planificarea pregătirii. Datele nu sunt folosite în alt scop și nu sunt vândute sau transmise altcuiva.",
        "Cât timp: pe durata legitimării la club și, după plecare, pe perioada de păstrare stabilită de club; apoi sunt șterse sau anonimizate.",
        "Drepturi: puteți cere oricând o copie a datelor, corectarea lor, ștergerea lor sau retragerea acordului, din pagina Profil sau direct la club. Retragerea acordului nu afectează participarea la antrenamente.",
      ],
      accept: "Sunt părintele / tutorele legal și sunt de acord",
    };
  }
  return {
    title: "Acordul tău pentru prelucrarea datelor",
    intro: `${clubName} folosește această aplicație pentru a urmări starea ta medicală și pregătirea fizică.`,
    points: [
      `Ce date prelucrăm: ${data.join("; ")}.`,
      `Cine le vede: ${who}.`,
      "De ce: prevenirea accidentărilor, recuperare și planificarea pregătirii. Datele nu sunt folosite în alt scop și nu sunt vândute sau transmise altcuiva.",
      "Cât timp: cât ești legitimat la club și, după plecare, pe perioada de păstrare stabilită de club; apoi sunt șterse sau anonimizate.",
      "Drepturi: poți cere oricând o copie a datelor, corectarea lor, ștergerea lor sau retragerea acordului, din pagina Profil. Retragerea acordului nu îți afectează participarea la antrenamente.",
    ],
    accept: "Sunt de acord",
  };
}
