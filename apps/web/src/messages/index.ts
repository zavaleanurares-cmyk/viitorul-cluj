import { ro } from "./ro";

/**
 * Internaționalizare: toate textele interfeței stau în `messages/<limbă>/`.
 * Pentru o limbă nouă: copiază directorul `ro`, tradu valorile și adaugă limba mai jos.
 * Tipul `Messages` garantează că nicio cheie nu lipsește.
 */
export type Messages = typeof ro;
export const locales = { ro } satisfies Record<string, Messages>;
export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "ro";

/** Textele interfeței (componente server și client). */
export function getT(locale: Locale = defaultLocale): Messages {
  return locales[locale] ?? ro;
}

/** Același lucru, cu nume de hook, pentru componentele client. */
export function useT(): Messages {
  return getT();
}
