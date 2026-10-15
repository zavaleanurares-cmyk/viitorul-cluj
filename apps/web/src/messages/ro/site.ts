/** Paginile publice ale clubului (fără cont): site, formularul de înscriere, tabere, 230. */
export const site = {
  nav: { home: "Acasă", news: "Noutăți", teams: "Echipe", camps: "Tabere", gallery: "Galerie", enrol: "Înscriere", support: "Susține clubul", contact: "Contact" },
  enter: "Intră în aplicație",
  privacy: "Protecția datelor",
  poweredBy: "Locker Room",
  notFound: "Pagina nu există.",
  enrol: {
    title: "Înscrie-ți copilul",
    lead: "Completează formularul și te contactăm pentru o probă la un antrenament al echipei potrivite vârstei. Proba e gratuită.",
    child: "Despre copil",
    parent: "Despre tine",
    consent: "Sunt de acord ca clubul să folosească aceste date ca să mă contacteze despre înscriere. Datele se șterg dacă nu se ajunge la înscriere, în cel mult 12 luni.",
    consentLink: "Cum folosim datele",
    submit: "Trimite cererea",
    sent: "Mulțumim! Am primit cererea.",
    sentBody: "Te contactăm în câteva zile, la telefon sau pe e-mail, pentru o probă. Dacă vrei să adaugi ceva, răspunde la mesajul nostru.",
    another: "Trimite altă cerere",
    closed: "Înscrierile online sunt închise momentan. Te rugăm să contactezi clubul.",
    groupsTitle: "Echipele clubului",
    years: (from: number, to: number | null) => (to && to !== from ? `născuți ${from}–${to}` : `născuți în ${from}`),
  },
  errors: {
    generic: "Nu am putut trimite formularul. Încearcă din nou.",
    tooFast: "Formularul a fost trimis prea repede. Verifică datele și trimite din nou.",
  },
} as const;
