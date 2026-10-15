import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Clase condiționale; la conflict câștigă ultima (de exemplu `className="w-20"` peste `w-full` din componentă).
 * Fără twMerge, ordinea din CSS decide, nu ordinea din cod, și suprascrierile nu se aplică sigur.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
