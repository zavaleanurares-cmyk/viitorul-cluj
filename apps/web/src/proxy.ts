import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/c", "/demo", "/autentificare", "/parola-uitata", "/auth", "/offline", "/api/cron", "/api/setup", "/api/plati/webhook", "/manifest.webmanifest", "/sw.js", "/icon", "/apple-icon"];

/**
 * Trimite vizitatorii fără cookie de sesiune la pagina de autentificare.
 * Este doar o scurtătură: sesiunea se verifică în baza de date la fiecare pagină și acțiune (lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "."));
  if (!isPublic && !request.cookies.has("sesiune")) {
    const url = request.nextUrl.clone();
    url.pathname = "/autentificare";
    url.search = path !== "/" ? `?inapoi=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
