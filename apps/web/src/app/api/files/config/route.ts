import { NextResponse } from "next/server";
import { storageMode } from "@/lib/files";

/** Spune browserului cum se încarcă fișierele în acest mediu. */
export function GET() {
  return NextResponse.json({ mode: storageMode() }, { headers: { "Cache-Control": "private, no-store" } });
}
