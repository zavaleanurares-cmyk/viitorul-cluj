import { plural } from "@club/shared";

/** Texte pentru notificări și sarcini programate. */
export const notifications = {
  title: "Notificări",
  description: (unread: number) =>
    unread === 0 ? "Toate notificările sunt citite." : unread === 1 ? "O notificare necitită." : `${plural(unread, "notificare necitită", "notificări necitite")}.`,
  markAll: "Marchează toate ca citite",
  markedAll: "Toate notificările au fost marcate ca citite.",
  unread: "Necitită",
  unreadSection: "Necitite",
  readSection: "Citite",
  open: "Deschide",
  emptyTitle: "Nicio notificare",
  emptyDescription: "Aici apar mementourile, planurile noi și schimbările de stare.",
  limitNote: (n: number) => `Sunt afișate cele mai recente ${plural(n, "notificare", "notificări")}.`,
  today: (time: string) => `azi, ${time}`,
  yesterday: (time: string) => `ieri, ${time}`,
  kinds: {
    wellness_reminder: "Memento",
    plan_new: "Plan",
    program_new: "Program",
    status_changed: "Stare",
    alert: "Alertă",
    visa_expiring: "Viză medicală",
    other: "Notificare",
  },

  /**
   * E-mailul-rezumat trimis de sarcina programată. Fără date medicale: doar câte notificări sunt
   * și titluri neutre, pe tipuri. Detaliile se văd numai în aplicație, după autentificare.
   */
  email: {
    subject: (n: number, app: string) => (n === 1 ? `O notificare nouă în ${app}` : `${plural(n, "notificare nouă", "notificări noi")} în ${app}`),
    greeting: "Bună ziua,",
    intro: (n: number, app: string) => (n === 1 ? `Ai o notificare nouă în ${app}:` : `Ai ${plural(n, "notificare nouă", "notificări noi")} în ${app}:`),
    open: "Detaliile se văd doar în aplicație, după autentificare:",
    footer: "Primești acest mesaj pentru că notificările pe e-mail sunt pornite. Le poți opri din aplicație, în Profil.",
    times: (title: string, n: number) => (n > 1 ? `${title} (${n})` : title),
    neutral: {
      wellness_reminder: "Completează chestionarul de azi",
      plan_new: "Plan nou",
      program_new: "Program nou",
      status_self: "Starea ta a fost actualizată",
      status_staff: "Stare actualizată în grupa ta",
      alert: "Alertă nouă",
      visa_expiring: "Viza medicală: verifică data de expirare",
      other: "Notificare nouă",
    },
  },
} as const;
