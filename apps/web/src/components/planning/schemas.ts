import "server-only";
import { z } from "zod";
import { DataError, type Db } from "@club/shared";

const text = (max: number) => z.string().trim().max(max, `Textul este prea lung (cel mult ${max} de caractere).`);

/** Un exercițiu dintr-un program sau dintr-un plan, așa cum îl primește acțiunea de server. */
export const ItemSchema = z.object({
  id: z.uuid().nullable(),
  exercise_id: z.uuid(),
  sets: z.number().int().min(1, "Numărul de serii trebuie să fie între 1 și 30.").max(30, "Numărul de serii trebuie să fie între 1 și 30.").nullable(),
  reps: text(60).nullable(),
  duration_sec: z.number().int().min(1, "Durata trebuie să fie între 1 și 7200 de secunde.").max(7200, "Durata trebuie să fie între 1 și 7200 de secunde.").nullable(),
  rest_sec: z.number().int().min(0, "Pauza trebuie să fie între 0 și 1800 de secunde.").max(1800, "Pauza trebuie să fie între 0 și 1800 de secunde.").nullable(),
  tempo: text(30).nullable(),
  notes: text(500).nullable(),
});

export const ItemsSchema = z.array(ItemSchema).max(60, "Cel mult 60 de exerciții.");

export const DateSchema = z.iso.date("Data nu este validă.");
export { text };

/** Toate exercițiile trimise trebuie să fie din biblioteca clubului (RLS le ascunde pe celelalte). */
export async function assertExercises(db: Db, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const { data, error } = await db.from("exercises").select("id").in("id", unique);
  if (error) throw error;
  if ((data ?? []).length !== unique.length) throw new DataError("Unul dintre exerciții nu mai există în bibliotecă. Reîncarcă pagina.");
}
