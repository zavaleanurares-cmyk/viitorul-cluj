import readXlsxFile from "read-excel-file/browser";
import Papa from "papaparse";
import { cell, hashSheet, type Sheet } from "@club/shared";
import type { LoadedFile, LoadedSheet } from "./types";

export type FileProblem = "type" | "xls" | "empty" | "unreadable" | "tooBig";
export type LoadResult = { ok: true; file: LoadedFile } | { ok: false; problem: FileProblem };

const MAX_BYTES = 20 * 1024 * 1024;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Celulele de tip „oră" din Excel (durate hh:mm:ss) sosesc ca dată din 1899/1900.
 * Le transformăm în text „hh:mm:ss", ca să poată fi citite ca durată.
 */
function normalizeCell(value: unknown): unknown {
  if (value instanceof Date && !Number.isNaN(value.getTime()) && value.getUTCFullYear() < 1901) {
    const days = Math.max(0, Math.floor((value.getTime() - Date.UTC(1899, 11, 30)) / 86400000));
    return `${pad(days * 24 + value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }
  return value;
}

function hasContent(sheet: Sheet): boolean {
  return sheet.some((row) => (row ?? []).some((c) => cell(c) !== ""));
}

function decodeText(bytes: Uint8Array): string | null {
  // fișier binar (imagine, PDF, arhivă) redenumit
  if (bytes.subarray(0, 4000).includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // CSV salvat din Excel pe Windows, cu diacritice
    return new TextDecoder("windows-1250").decode(bytes);
  }
}

/** Citește fișierul în browser (nu se încarcă pe server) și întoarce foile cu date. */
export async function loadFile(file: File): Promise<LoadResult> {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  if (ext === "xls") return { ok: false, problem: "xls" };
  if (!["xlsx", "csv", "txt", "tsv"].includes(ext)) return { ok: false, problem: "type" };
  if (file.size > MAX_BYTES) return { ok: false, problem: "tooBig" };
  if (file.size === 0) return { ok: false, problem: "empty" };

  let raw: Array<{ name: string; data: Sheet }>;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (ext === "xlsx") {
      if (!isZip) return { ok: false, problem: "unreadable" };
      const sheets = await readXlsxFile(file);
      raw = sheets.map((s) => ({ name: s.sheet, data: (s.data as Sheet).map((row) => (row ?? []).map(normalizeCell)) }));
    } else {
      if (isZip) return { ok: false, problem: "type" };
      const text = decodeText(bytes);
      if (text === null) return { ok: false, problem: "type" };
      const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
      const data = parsed.data as Sheet;
      while (data.length && !(data[data.length - 1] ?? []).some((c) => cell(c) !== "")) data.pop();
      raw = [{ name: file.name, data }];
    }
  } catch {
    return { ok: false, problem: "unreadable" };
  }

  const sheets: LoadedSheet[] = [];
  for (const s of raw) {
    if (!hasContent(s.data)) continue;
    sheets.push({ ...s, hash: await hashSheet(s.data) });
  }
  if (!sheets.length) return { ok: false, problem: "empty" };
  return { ok: true, file: { filename: file.name, sheets } };
}

/** „A", „B", … „AA" — litera coloanei, ca în Excel. */
export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** Primele valori nevide dintr-o coloană, ca exemple în ecranul de mapare. */
export function sampleValues(rows: Array<{ cells: string[] }>, col: number, max = 3): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = r.cells[col];
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** Descarcă un text ca fișier CSV (cu BOM, ca Excel să afișeze corect diacriticele). */
export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = Papa.unparse(rows, { delimiter: ";" });
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
