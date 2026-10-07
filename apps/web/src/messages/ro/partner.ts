import { plural } from "@club/shared";

/** Texte pentru partenerul medical extern: lista de cazuri și pagina unui caz. */
export const partner = {
  title: "Cazuri",
  description: "Jucătorii trimiși de club către tine. Vezi doar cazurile active.",
  count: (n: number) => (n === 1 ? "Un caz activ" : `${plural(n, "caz activ", "cazuri active")}`),
  emptyTitle: "Niciun caz activ",
  emptyDescription: "Când preparatorul fizic al clubului îți trimite un jucător, cazul apare aici.",
  sentOn: (date: string) => `Trimis la ${date}`,
  noReason: "Fără motiv precizat",
  open: (name: string) => `Deschide cazul: ${name}`,

  back: "Cazuri",
  reason: "Motivul trimiterii",
  playerTitle: "Jucător",
  fullName: "Nume complet",
  birthDate: "Data nașterii",
  age: (n: number) => plural(n, "an", "ani"),
  group: "Grupă",
  position: "Post",
  foot: "Picior de bază",

  injuriesTitle: "Accidentări",
  injuriesScopeOne: "Vezi accidentarea pentru care a fost trimis jucătorul.",
  injuriesScopeAll: "Clubul ți-a trimis toate accidentările jucătorului.",
  injuriesEmpty: "Trimiterea nu are nicio accidentare asociată.",

  notesTitle: "Notele tale",
  notesDescription: "Sunt vizibile pentru preparatorul fizic și antrenorii grupei.",
  notesEmpty: "Nu ai adăugat încă nicio notă.",
  noteLabel: "Notă nouă",
  notePlaceholder: "Constatări, recomandări, pași următori",
  noteAdd: "Adaugă nota",
  noteSaved: "Nota a fost adăugată.",
  noteDelete: "Șterge nota",
  noteDeleteTitle: "Ștergi nota?",
  noteDeleted: "Nota a fost ștearsă.",

  docsTitle: "Documentele cazului",
  docsDescription: "Fișierele sunt private; se deschid printr-un link care expiră în două minute.",
  docsEmpty: "Niciun document pe acest caz.",
  docsEmptyHint: "Poți încărca rezultate, imagini sau scrisori medicale.",

  errNoteRequired: "Scrie nota.",
  errCaseNotFound: "Cazul nu mai este activ sau nu îți este alocat.",
} as const;
