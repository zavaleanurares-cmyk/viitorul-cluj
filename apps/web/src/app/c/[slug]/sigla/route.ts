import { NextResponse } from "next/server";
import { createAnonDb } from "@club/db";
import { isSafePath, readFile } from "@/lib/files";

/** Sigla clubului pentru paginile publice: singurul fișier din „branding" servit fără sesiune. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: path } = await createAnonDb().rpc("public_logo_path", { p_slug: slug });
  if (typeof path !== "string" || !isSafePath(path)) return new NextResponse(null, { status: 404 });
  const file = await readFile("branding", path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
