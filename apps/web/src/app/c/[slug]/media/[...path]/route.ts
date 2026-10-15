import { NextResponse } from "next/server";
import { createAnonDb } from "@club/db";
import { isSafePath, readFile } from "@/lib/files";

/** Imaginile site-ului public: doar cele folosite de o știre publicată sau fotografiile cu acord. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path: segments } = await params;
  const path = segments.map(decodeURIComponent).join("/");
  if (!isSafePath(path)) return new NextResponse(null, { status: 404 });
  const { data: ok } = await createAnonDb().rpc("site_public_file", { p_slug: slug, p_path: path });
  if (ok !== true) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const file = await readFile("site", path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      // scurt: o fotografie poate deveni privată (acord retras), deci nu o ținem mult în cache
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ...(file.size !== null ? { "Content-Length": String(file.size) } : {}),
    },
  });
}
