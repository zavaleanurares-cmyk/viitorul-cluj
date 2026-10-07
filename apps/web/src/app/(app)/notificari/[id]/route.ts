import { NextResponse, type NextRequest } from "next/server";
import { markNotificationsRead } from "@club/shared";
import { getSession } from "@/lib/auth";
import { safeInternalLink } from "@/components/notifications/links";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Deschiderea unei notificări: o marchează citită și trimite la ecranul ei.
 * Este o rută (nu o acțiune) ca notificarea să fie un link obișnuit, care merge și fără JavaScript.
 * Citirea și marcarea trec prin RLS: un id care nu este al utilizatorului nu găsește nimic.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = (path: string) =>
    NextResponse.redirect(new URL(path, request.nextUrl.origin), { status: 303, headers: { "Cache-Control": "private, no-store" } });

  const session = await getSession();
  if (!session) return to("/autentificare");
  if (!UUID.test(id)) return to("/notificari");

  const { data } = await session.db.from("notifications").select("id, link, read_at").eq("id", id).maybeSingle();
  if (!data) return to("/notificari");
  if (!data.read_at) await markNotificationsRead(session.db, [data.id]).catch(() => {});
  return to(safeInternalLink(data.link) ?? "/notificari");
}
