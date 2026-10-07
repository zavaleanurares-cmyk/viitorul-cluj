import type { PostgrestClient } from "@supabase/postgrest-js";
import type { Database } from "./database.types";

/**
 * Clientul de date tipizat (constructorul de interogări PostgREST), folosit identic pe server
 * (executat direct pe Postgres, vezi @club/db) și în aplicația nativă (prin API-ul aplicației).
 */
export type Db = PostgrestClient<Database>;

export class DataError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "DataError";
    this.code = code;
  }
}

/** Mesaj în română pentru erorile uzuale venite din Postgres / PostgREST. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "A apărut o eroare.";
  switch (error.code) {
    case "42501": return "Nu ai dreptul să faci această operațiune.";
    case "23505": return "Există deja o înregistrare cu aceste date.";
    case "23503": return "Înregistrarea este folosită în altă parte și nu poate fi ștearsă.";
    case "23514": return "Una dintre valori este în afara limitelor permise.";
    case "PGRST116": return "Înregistrarea nu a fost găsită.";
    case "PGRST301": return "Sesiunea a expirat. Autentifică-te din nou.";
  }
  const m = error.message ?? "";
  if (/row-level security/i.test(m)) return "Nu ai dreptul să faci această operațiune.";
  if (/fetch failed|network/i.test(m)) return "Nu s-a putut contacta serverul. Verifică conexiunea.";
  return m || "A apărut o eroare.";
}

/** Aruncă DataError dacă răspunsul are eroare; altfel întoarce datele. */
export function unwrap<T>(res: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (res.error) throw new DataError(friendlyError(res.error), res.error.code);
  return res.data as NonNullable<T>;
}
