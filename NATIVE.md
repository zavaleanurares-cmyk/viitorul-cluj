# NATIVE.md — aplicațiile iOS și Android

Ghid complet pentru construirea aplicațiilor native ale platformei, pe același backend ca aplicația web.
Valabil pentru: **Expo SDK 57** (React Native 0.86, React 19.2.3), **Next.js 16.4** (aplicația web din `apps/web`), starea repo-ului din 7 octombrie 2026.

## 1. Pe scurt

1. **Ce se construiește:** o aplicație pentru iPhone și una pentru Android, din **un singur cod** (Expo / React Native, TypeScript), pusă în monorepo lângă aplicația web, în `apps/mobile`.
2. **Pentru cine, în prima etapă:** jucătorii — autentificare, „Azi” (plan + programe + bifare), chestionarul zilnic cu harta corpului, exercițiile cu video, RPE, profil minim, notificări push. Tot ce ține de administrare rămâne pe web.
3. **Backend:** același. Telefonul nu se conectează la baza de date; vorbește prin HTTPS cu aplicația web, care primește un mic **API pentru mobil**. Acest API **nu există încă** și este prima etapă a proiectului (Etapa 0, cam 350 de rânduri de cod, date complet în secțiunea 4).
4. **Ce se refolosește:** pachetul `@club/shared` — tipurile bazei de date și exact aceleași funcții de interogare ca pe web (`getPlayerDay`, `submitWellness`, `setCompletion`…). Permisiunile rămân în Postgres (Row Level Security).
5. **Cu ce:** Expo SDK 57, Expo Router, EAS Build / Submit / Update, `expo-notifications`, `expo-video`, `expo-secure-store`.
6. **Cât durează** (un om cu asistent AI): Etapa 0 — 2–3 zile; Etapa 1 (jucător) — 6–8 săptămâni de lucru; calendaristic 8–10 săptămâni, pentru că aprobarea conturilor de dezvoltator și recenziile magazinelor nu depind de tine. Etapa 2 — încă 3–4 săptămâni.
7. **Cât costă:** Apple Developer Program 99 USD/an; Google Play Console 25 USD o singură dată; EAS gratuit la început (15 build-uri iOS + 15 Android pe lună), 19 USD/lună dacă depășești; Vercel Pro (20 USD/lună pe loc de dezvoltator) dacă proiectul web nu este deja pe Pro.
8. **Conturile de magazin se fac pe numele unei persoane juridice**, nu personal. La Google este cerință pentru aplicațiile medicale; la Apple este cerința 5.1.1(ix) pentru aplicațiile din domeniul sănătății.
9. **Ce a fost verificat la scrierea ghidului:** tot codul din secțiunile 4, 8, 9, 10 și 11 a fost compilat (TypeScript) pe o copie a repo-ului; API-ul pentru mobil a rulat local și a fost apelat cu `curl`; clientul de date, coada offline și regulile RLS au fost testate cap-coadă pe o bază de date de test; pachetul JavaScript al aplicației a fost construit cu Metro (`npx expo export`). **Nu au fost rulate:** simulatorul, EAS Build, trimiterea reală de notificări push și publicarea în magazine — acolo urmezi pașii și verifici ce apare pe ecran.
10. **Ordinea de lucru:** secțiunea 4 (API-ul) → 7 (calculatorul) → 8 (proiectul) → ecranele din secțiunea 5 → 9, 10, 11 → 13 (publicare).

## 2. Cum citești acest ghid

**Reguli de lucru.** Sunt puține, dar te scutesc de cele mai multe probleme.

- **Un pas = o singură acțiune.** După fiecare pas scrie **„Vezi:”** — ce trebuie să apară pe ecran. Dacă vezi altceva, te oprești acolo și nu treci la pasul următor.
- **Comenzile se pregătesc întâi într-un editor de text simplu.** Deschide **TextEdit**, apoi din meniu **Format → Make Plain Text** (tastele ⇧⌘T). Lipește comanda acolo, înlocuiește valorile marcate, verifică, și abia apoi copiaz-o în Terminal. Așa nu ajunge niciodată în Terminal un text de înlocuit.
- **Valorile de înlocuit sunt marcate `<<AȘA>>`**, cu tot cu parantezele unghiulare. Înlocuiești tot, inclusiv `<<` și `>>`. Dacă în comanda finală a rămas vreun `<<`, comanda nu este gata.
- **Terminalul:** aplicația **Terminal** (⌘Space, scrii `Terminal`, Enter). O comandă se rulează cu Enter. O comandă blocată se oprește cu ⌃C (Control + C).
- **Când ceva nu merge:** selectezi în Terminal **tot** textul de la comanda pe care ai tastat-o până la ultimul rând (inclusiv comanda), îl copiezi (⌘C) și îl dai asistentului AI **exact așa**, fără rezumat. Pentru erori din aplicație (ecran roșu în simulator), copiezi textul din fereastra de Terminal în care rulează `npx expo start`. Pentru build-uri EAS, deschizi linkul afișat de comandă și copiezi secțiunea marcată cu roșu din jurnalul de build.
- **Căile de fișiere sunt complete.** Când un pas spune „creează fișierul”, îl creezi cu asistentul AI sau cu editorul de cod pe care îl folosești, exact la calea dată și cu exact conținutul dat.

**Valorile pe care le vei înlocui:**

| Marcaj | Ce pui în loc | Exemplu |
|---|---|---|
| `<<REPO>>` | folderul proiectului pe Mac-ul tău. Îl afli trăgând folderul din Finder în fereastra Terminal: calea apare scrisă. | `/Users/numeletau/Proiecte/viitorul-cluj` |
| `<<EMAIL_DEMO>>`, `<<PAROLA_DEMO>>` | un cont de **jucător din clubul demonstrativ** (fișierul `conturi-demo.local.md`). Nu folosi conturi reale la teste. | — |
| `<<TOKEN>>` | tokenul de sesiune întors de comanda de autentificare (4.6, pasul 7) | un șir de 43 de caractere |
| `<<IDENTIFICATOR>>` | identificatorul unic al aplicației în magazine, în format de domeniu inversat. **Nu se mai poate schimba după publicare.** | `ro.numelefirmei.vestiar` |
| `<<NUME_APLICATIE>>` | numele afișat sub pictogramă | `Vestiar` |
| `<<CRON_SECRET>>` | valoarea variabilei `CRON_SECRET` din Vercel | un șir aleator lung |

**Ce este cerință și ce este recomandare.** Unde scrie **[cerință]**, regula vine de la Apple, Google sau Expo și este citată în secțiunea 17. Unde scrie **[recomandare]**, este decizia acestui ghid și o poți schimba.

## 3. Arhitectură

### 3.1 Schema

```
┌────────────────────────────┐
│  Telefon (iOS / Android)   │  apps/mobile — Expo / React Native
│  • ecrane (Expo Router)    │
│  • @club/shared            │  aceleași funcții de interogare ca pe web
│  • PostgrestClient         │  construiește cereri în format PostgREST
│  • token în SecureStore    │
└──────────────┬─────────────┘
               │  HTTPS, antet „Authorization: Bearer <token>”
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Aplicația web Next.js pe Vercel                                 │
│  https://viitorul-cluj.vercel.app                                │
│                                                                  │
│  /api/mobile/auth/*     autentificare, parolă, invitație         │
│  /api/mobile/rest/*     poarta de date (handleRest)              │
│  /api/files/<bucket>/…  fișiere private (cookie sau Bearer)      │
│  /api/cron              mementouri + trimiterea notificărilor    │
└───────┬──────────────────────────┬───────────────────┬───────────┘
        │ tranzacție cu rolul      │ adresă semnată,   │ Expo Push API
        │ „authenticated” și       │ valabilă 5 minute │
        │ identitatea utilizatorului                   │
        ▼                          ▼                   ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Postgres (Neon,      │  │ Vercel Blob      │  │ Expo Push Service│
│ Frankfurt)           │  │ privat           │  │ → APNs / FCM     │
│ Row Level Security   │  │ clipuri,         │  │ → telefon        │
│ app_auth.uid()       │  │ documente        │  │                  │
└──────────────────────┘  └──────────────────┘  └──────────────────┘
```

Pe scurt: aplicația nativă este **încă un client al aplicației web**, nu al bazei de date. Baza de date rămâne accesibilă doar de pe server.

### 3.2 De ce așa

- Pe web, `db` este un `PostgrestClient` (biblioteca `@supabase/postgrest-js`) ale cărui cereri nu pleacă în rețea: `packages/db/src/client.ts` le prinde cu un `fetch` propriu (`restFetch`) și le dă funcției `handleRest` (`packages/db/src/rest.ts`), care le traduce în SQL și le execută sub RLS. Numele „supabase” apare doar pentru că aceasta este biblioteca care construiește interogările; **proiectul nu folosește serviciul Supabase**.
- `handleRest(request, exec, meta)` nu depinde de felul în care a sosit cererea. De aceea aplicația nativă poate folosi **același** `PostgrestClient`, îndreptat spre o adresă reală: `https://viitorul-cluj.vercel.app/api/mobile/rest`. Ruta de acolo face exact ce face `restFetch`: validează sesiunea, deschide o tranzacție cu identitatea utilizatorului și cheamă `handleRest`.
- Rezultatul: funcțiile din `packages/shared/src/queries.ts` primesc un `Db` și nu știu dacă rulează pe server sau pe telefon.

### 3.3 Monorepo-ul

```
<<REPO>>/
  apps/
    web/                  aplicația web (Next.js) — primește API-ul pentru mobil
    mobile/               NOU: aplicația nativă (Expo)
      app.json            configurarea aplicației (nume, identificator, pluginuri)
      eas.json            profilurile de build
      src/app/            ecranele (Expo Router: fiecare fișier este un ecran)
      src/lib/            sesiune, client de date, coadă offline, push, video
      src/components/     componente native (harta corpului, playerul video)
  packages/
    shared/               @club/shared — tipuri, reguli de domeniu, interogări (web + nativ)
    db/                   @club/db — DOAR server (Postgres, parole, sesiuni). Nu se importă în nativ.
  db/migrations/          schema și politicile RLS
```

Rădăcina are deja `"workspaces": ["apps/*", "packages/*"]`, deci `apps/mobile` devine automat parte din monorepo. **[cerință Expo]** De la SDK 52, Expo configurează singur Metro pentru monorepo: **nu este nevoie de `metro.config.js`**. Verificat pe o copie a repo-ului: `@club/shared` (TypeScript sursă, fără pas de build) a fost împachetat direct din `packages/shared/src`.

> **React în două versiuni.** Web-ul folosește React 19.3.0, iar Expo SDK 57 cere React 19.2.3. npm le instalează pe amândouă: 19.3.0 în `node_modules` din rădăcină și 19.2.3 în `apps/mobile/node_modules`. La verificare, pachetul aplicației native a conținut o singură copie de React (19.2.3), pentru că Expo aplică singur rezolvarea corectă în monorepo de la SDK 55. Nu schimba versiunea de React din `apps/web` și nu adăuga `overrides` „ca să fie la fel”. Dacă apare totuși eroarea „Invalid hook call”, rulează `npm why react` din `<<REPO>>` și dă rezultatul asistentului.

### 3.4 Ce se refolosește din `@club/shared`

| Fișier din `packages/shared/src/` | Ce folosește aplicația nativă |
|---|---|
| `database.types.ts` | `Database`, `Tables<…>`, `Enums<…>` — tipurile tuturor tabelelor |
| `client.ts` | `Db`, `DataError`, `friendlyError` (mesajele de eroare în română), `unwrap` |
| `queries.ts` | `getAppContext`, `getPlayerDay`, `setCompletion`, `getWellnessEntry`, `submitWellness`, `wellnessConfigForGroup`, `submitRpe`, `listNotifications`, `countUnreadNotifications`, `markNotificationsRead`; în Etapa 2: `getPlayerCalendar`, `listPlayers`, `listWellness` |
| `dates.ts` | `todayIn` (ziua curentă în fusul clubului), `addDays`, `formatDate`, `relativeDay`, `isMinor` |
| `body.ts` | `BODY_ZONES`, `zoneLabel`, `zoneIsSided`, `isBodyZone`, `SIDE_LABELS` |
| `consent.ts` | `CONSENT_VERSION`, `consentAudience`, `consentText` — același text de acord ca pe web |
| `media.ts` | `parseVideoUrl` — recunoaște YouTube / Vimeo / fișier |
| `settings.ts`, `load.ts`, `labels.ts`, `status.ts`, `roles.ts` | întrebările active pe grupă, `sessionLoad` (RPE × minute), etichete, culorile stărilor, `homePath` |

**Specific aplicației native** (se scrie din nou): ecranele și stilurile (pe web sunt HTML + Tailwind), sesiunea (token în SecureStore în loc de cookie), stocarea locală și coada offline, notificările push, playerul video, harta corpului desenată cu `react-native-svg`.

**Ce NU ajunge automat pe telefon:** verificările din acțiunile de server ale web-ului (`apps/web/src/app/(app)/*/actions.ts`, scheme `zod`). Aplicația nativă își validează singură formularele; ultima apărare rămâne baza de date (RLS, constrângeri `check`, indecși unici). Vezi 4.7 pentru singura diferență care merită închisă.

### 3.5 De ce Expo

- **Un singur cod** pentru iOS și Android, în TypeScript, cu aceleași tipuri ca web-ul.
- **EAS Build** compilează aplicațiile în cloud: nu ai nevoie de Xcode pentru build, doar pentru simulator. **EAS Submit** le urcă în magazine. **EAS Update** trimite corecturi de JavaScript fără un build nou (secțiunea 14).
- Modulele necesare aici (notificări, video, stocare securizată, fișiere) sunt întreținute de Expo și vin în versiuni potrivite cu SDK-ul.

### 3.6 De ce RLS rămâne singura sursă de permisiuni

Aplicația nativă este un program care rulează pe telefonul utilizatorului: oricine poate vedea ce cereri face și poate trimite altele, cu propriul token. De aceea **nicio regulă de acces nu se pune în aplicația nativă și niciuna nu se dublează în API-ul pentru mobil**. Ruta `/api/mobile/rest` doar stabilește cine este utilizatorul; ce vede și ce poate scrie hotărăsc politicile din `db/migrations/20261007000200_rls.sql`, aceleași ca pe web. O politică schimbată acolo se aplică în aceeași clipă și web-ului, și telefoanelor.

## 4. Etapa 0 — API-ul pentru mobil în `apps/web`

**Starea actuală:** în repo **nu există** niciun fișier sub `apps/web/src/app/api/mobile/`. Tot ce urmează trebuie adăugat. Sunt 9 fișiere noi (două dintre ele pentru notificări), 1 migrare și 3 modificări mici.

| # | Fișier (cale completă față de `<<REPO>>`) | Ce face |
|---|---|---|
| 1 | `apps/web/src/lib/mobile.ts` | funcții comune: citirea tokenului, sesiunea, răspunsuri JSON |
| 2 | `apps/web/src/app/api/mobile/auth/login/route.ts` | e-mail + parolă → token |
| 3 | `apps/web/src/app/api/mobile/auth/logout/route.ts` | închide sesiunea |
| 4 | `apps/web/src/app/api/mobile/auth/me/route.ts` | starea contului (parolă de ales? acord dat?) |
| 5 | `apps/web/src/app/api/mobile/auth/password/route.ts` | alegerea / schimbarea parolei |
| 6 | `apps/web/src/app/api/mobile/auth/redeem/route.ts` | folosirea unui link de invitație |
| 7 | `apps/web/src/app/api/mobile/rest/[...path]/route.ts` | poarta de date (PostgREST sub RLS) |
| 8 | `apps/web/src/lib/push.ts` + `apps/web/src/app/api/cron/route.ts` | trimiterea notificărilor push (secțiunea 9) |
| 9 | `db/migrations/20261007190000_mobile_push.sql` | coloana `pushed_at` (secțiunea 9) |
| M1 | `apps/web/src/proxy.ts` | lasă să treacă `/api/mobile` și fișierele cerute cu token |
| M2 | `apps/web/src/lib/auth.ts` | `getSession` acceptă și tokenul din antet |
| M3 | `apps/web/src/app/api/files/[bucket]/[...path]/route.ts` | adresa clipului ca JSON |

Fișierele 8 și 9 sunt descrise în secțiunea 9, dar e mai simplu să le adaugi acum, în același deploy.

### 4.1 Funcțiile comune

Creează fișierul `<<REPO>>/apps/web/src/lib/mobile.ts`:

```ts
import "server-only";
import { NextResponse } from "next/server";
import { getAppContext, type AppContext, type Db } from "@club/shared";
import { createDb, getSessionUser } from "@club/db";

/** Răspuns JSON care nu se păstrează în niciun cache. */
export function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** Tokenul de sesiune din antetul „Authorization: Bearer <token>”. */
export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

/** Corpul cererii ca obiect JSON (gol dacă lipsește sau nu e valid). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text || text.length > 10_000) return {};
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Datele folosite la limitarea încercărilor de autentificare și în lista de sesiuni. */
export function clientMeta(request: Request): { userAgent: string | null; ip: string | null } {
  const h = request.headers;
  return {
    userAgent: h.get("user-agent"),
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip"),
  };
}

export type MobileSession = {
  token: string;
  userId: string;
  email: string;
  viaLink: boolean;
  hasPassword: boolean;
  /** client de date cu identitatea utilizatorului — sub RLS */
  db: Db;
  ctx: AppContext;
};

/** Sesiunea aplicației native, din token. Null dacă tokenul lipsește, a expirat sau contul nu mai este activ. */
export async function mobileSession(request: Request): Promise<MobileSession | null> {
  const token = bearerToken(request);
  const user = await getSessionUser(token);
  if (!token || !user) return null;
  const db = createDb({ sub: user.userId, role: "authenticated" });
  const ctx = await getAppContext(db, user.userId);
  if (!ctx) return null;
  return { token, userId: user.userId, email: user.email, viaLink: user.viaLink, hasPassword: user.hasPassword, db, ctx };
}
```

### 4.2 Autentificarea

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/auth/login/route.ts`:

```ts
import { z } from "zod";
import { getAppContext } from "@club/shared";
import { createDb, deleteSession, signInWithPassword } from "@club/db";
import { clientMeta, json, readJson } from "@/lib/mobile";

const Input = z.object({ email: z.email(), password: z.string().min(1).max(200) });

/** E-mail + parolă → token de sesiune. Limitarea încercărilor eșuate este în `signInWithPassword`. */
export async function POST(request: Request) {
  const parsed = Input.safeParse(await readJson(request));
  if (!parsed.success) return json(401, { error: "E-mail sau parolă greșită." });

  const result = await signInWithPassword({ ...parsed.data, ...clientMeta(request) });
  if (!result.ok) {
    return result.reason === "locked"
      ? json(429, { error: "Prea multe încercări. Încearcă din nou peste 15 minute." })
      : json(401, { error: "E-mail sau parolă greșită." });
  }

  // același control ca pe web: fără profil activ nu există sesiune
  const db = createDb({ sub: result.userId, role: "authenticated" });
  const ctx = await getAppContext(db, result.userId);
  if (!ctx) {
    await deleteSession(result.session.token);
    return json(403, { error: "Contul nu este activ. Ia legătura cu preparatorul fizic." });
  }
  await db.rpc("log_event", { p_action: "LOGIN", p_entity: "auth", p_details: { client: "mobile" } });

  return json(200, {
    token: result.session.token,
    expiresAt: result.session.expiresAt,
    userId: result.userId,
    role: ctx.role,
    mustChangePassword: ctx.profile.must_change_password,
    consentAccepted: ctx.consentAccepted,
  });
}
```

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/auth/logout/route.ts`:

```ts
import { deleteSession } from "@club/db";
import { bearerToken, json } from "@/lib/mobile";

/** Închide sesiunea de pe acest telefon. Răspunde la fel și dacă tokenul nu mai era valid. */
export async function POST(request: Request) {
  await deleteSession(bearerToken(request));
  return json(200, { ok: true });
}
```

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/auth/me/route.ts`:

```ts
import { json, mobileSession } from "@/lib/mobile";

/** Starea contului pentru aplicația nativă: trebuie aleasă parola? trebuie dat acordul? */
export async function GET(request: Request) {
  const session = await mobileSession(request);
  if (!session) return json(401, { error: "Sesiunea a expirat. Autentifică-te din nou." });
  return json(200, {
    userId: session.userId,
    email: session.email,
    role: session.ctx.role,
    mustChoosePassword: session.viaLink || session.ctx.profile.must_change_password || !session.hasPassword,
    consentAccepted: session.ctx.consentAccepted,
  });
}
```

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/auth/password/route.ts` (aceeași logică precum acțiunea `setPassword` din `apps/web/src/lib/auth-actions.ts`):

```ts
import { AuthError, checkPassword, setPassword } from "@club/db";
import { json, mobileSession, readJson } from "@/lib/mobile";

/**
 * Alegerea parolei (prima intrare, după un link de invitație / resetare) sau schimbarea ei.
 * La schimbarea voluntară se cere parola actuală. Celelalte sesiuni ale utilizatorului se închid.
 */
export async function POST(request: Request) {
  const session = await mobileSession(request);
  if (!session) return json(401, { error: "Sesiunea a expirat. Autentifică-te din nou." });
  const body = await readJson(request);
  const password = typeof body.password === "string" ? body.password : "";
  const current = typeof body.current === "string" ? body.current : "";

  const forced = session.viaLink || session.ctx.profile.must_change_password || !session.hasPassword;
  if (!forced && !(await checkPassword(session.userId, current))) {
    return json(400, { error: "Parola actuală nu este corectă." });
  }
  try {
    await setPassword(session.userId, password, session.token);
  } catch (e) {
    if (e instanceof AuthError) return json(400, { error: e.message });
    throw e;
  }
  await session.db.rpc("clear_must_change_password");
  return json(200, { ok: true });
}
```

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/auth/redeem/route.ts`:

```ts
import { consumeOneTimeToken, createSession } from "@club/db";
import { clientMeta, json, readJson } from "@/lib/mobile";

/**
 * Folosește un link de invitație / resetare (`/auth/link?t=<cod>`): primește codul și întoarce
 * un token de sesiune marcat „via link”, cu care aplicația cere imediat alegerea parolei.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const used = await consumeOneTimeToken(typeof body.token === "string" ? body.token : "");
  if (!used) return json(400, { error: "Linkul nu este valid sau a expirat. Cere unul nou de la club." });
  const session = await createSession(used.userId, { ...clientMeta(request), viaLink: true });
  return json(200, { token: session.token, expiresAt: session.expiresAt, userId: used.userId, mustChoosePassword: true });
}
```

**Acordul (consimțământul) nu are nevoie de rută proprie.** Aplicația nativă inserează direct în tabelul `consents` prin clientul de date, exact ca acțiunea `acceptConsent` de pe web; politica `consents_insert` permite utilizatorului doar propriul acord. La fel și tokenul de push: se scrie direct în `push_tokens`.

### 4.3 Poarta de date

Creează fișierul `<<REPO>>/apps/web/src/app/api/mobile/rest/[...path]/route.ts` (numele folderului este chiar `[...path]`, cu paranteze drepte și trei puncte):

```ts
import type { NextRequest } from "next/server";
import { getSessionUser, handleRest, schemaMeta, withIdentity } from "@club/db";
import type { Exec } from "@club/db/rest";
import { bearerToken, json } from "@/lib/mobile";

type Params = { params: Promise<{ path: string[] }> };

const MAX_BODY = 256 * 1024;
const pgrst = (status: number, code: string, message: string) => json(status, { code, message, details: null, hint: null });

/**
 * Poarta de date a aplicației native. Aceeași cale ca pe web (`restFetch` din packages/db/src/client.ts),
 * doar că cererea vine prin HTTPS: token → utilizator → tranzacție cu rolul `authenticated` și
 * identitatea lui → `handleRest`. Ce se vede și ce se poate scrie hotărăște Row Level Security.
 */
async function handle(request: NextRequest, { params }: Params) {
  const user = await getSessionUser(bearerToken(request));
  if (!user) return pgrst(401, "PGRST301", "Sesiunea a expirat. Autentifică-te din nou.");

  const { path } = await params;
  const method = request.method.toUpperCase();
  let body: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    const text = await request.text();
    if (text.length > MAX_BODY) return pgrst(413, "PGRST102", "Cererea este prea mare.");
    if (text !== "") {
      try {
        body = JSON.parse(text);
      } catch {
        return pgrst(400, "PGRST102", "Corpul cererii nu este JSON valid.");
      }
    }
  }

  const meta = await schemaMeta();
  const res = await withIdentity({ sub: user.userId, role: "authenticated" }, async (client) => {
    const exec: Exec = (sql, values) => client.query(sql, values) as ReturnType<Exec>;
    const out = await handleRest(
      { method, path: "/" + path.join("/"), query: request.nextUrl.searchParams, headers: request.headers, body },
      exec,
      meta,
    );
    // o eroare întoarsă ca răspuns trebuie totuși să anuleze tranzacția
    if (out.status >= 400) await client.query("rollback").then(() => client.query("begin"));
    return out;
  });

  const noBody = res.body === null || [204, 205, 304].includes(res.status) || method === "HEAD";
  return new Response(noBody ? null : res.body, {
    status: res.status,
    headers: { ...res.headers, "Cache-Control": "private, no-store" },
  });
}

export { handle as GET, handle as HEAD, handle as POST, handle as PATCH, handle as DELETE };
```

### 4.4 Cele trei modificări

**M1 — `<<REPO>>/apps/web/src/proxy.ts`.** Fără această modificare, orice cerere fără cookie este trimisă la pagina de autentificare, deci telefonul nu ar ajunge niciodată la API.

Rândul care începe cu `const PUBLIC_PATHS` — adaugi `"/api/mobile"` după `"/api/setup"`:

```ts
const PUBLIC_PATHS = ["/autentificare", "/parola-uitata", "/auth", "/offline", "/api/cron", "/api/setup", "/api/mobile", "/manifest.webmanifest", "/sw.js", "/icon", "/apple-icon"];
```

În funcția `proxy`, înlocuiești rândul `if (!isPublic && !request.cookies.has("sesiune")) {` cu aceste trei rânduri:

```ts
  // aplicația nativă cere fișierele cu token în antet, nu cu cookie; ruta verifică tokenul
  const hasBearer = path.startsWith("/api/files/") && (request.headers.get("authorization") ?? "").startsWith("Bearer ");
  if (!isPublic && !hasBearer && !request.cookies.has("sesiune")) {
```

`proxy.ts` este doar o scurtătură; verificarea reală a tokenului se face în fiecare rută, în baza de date.

**M2 — `<<REPO>>/apps/web/src/lib/auth.ts`.** Adaugi un import, o funcție și schimbi un rând.

Sus, lângă celelalte importuri:

```ts
import { headers } from "next/headers";
```

Deasupra rândului `export const getSession = cache(async …`:

```ts
/** Aplicația nativă nu are cookie: trimite tokenul în antetul „Authorization: Bearer <token>”. */
async function readBearerToken(): Promise<string | null> {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec((await headers()).get("authorization") ?? "");
  return m ? m[1] : null;
}
```

În `getSession`, rândul `const user = await getSessionUser(await readSessionToken());` devine:

```ts
  const user = await getSessionUser((await readSessionToken()) ?? (await readBearerToken()));
```

Cookie-ul are prioritate; antetul se citește doar când nu există cookie. Un browser nu trimite singur antetul `Authorization`, deci modificarea nu deschide nicio cale de atac de tip CSRF.

**M3 — `<<REPO>>/apps/web/src/app/api/files/[bucket]/[...path]/route.ts`.** În funcția `GET`, în blocul `if (bucket === "exercise-media" && !download) {`, imediat după rândul `const url = await presignedReadUrl(bucket, path, 300);`, adaugi:

```ts
    // aplicația nativă cere adresa ca JSON (playerele video native nu urmează sigur redirecționările cu antete)
    if (request.nextUrl.searchParams.get("json") === "1") {
      return NextResponse.json({ url, expiresIn: url ? 300 : null }, { headers: { "Cache-Control": "private, no-store" } });
    }
```

Verificarea sesiunii și a dreptului de citire (`file_access`) rămâne deasupra, neschimbată. De ce e nevoie de asta: vezi secțiunea 11.

### 4.5 Verificare înainte de publicare

1. Deschide Terminal.
2. Rulează (înlocuiește `<<REPO>>`):

   ```sh
   cd <<REPO>>
   ```

   **Vezi:** nimic; doar promptul se schimbă și arată numele folderului.
3. Rulează:

   ```sh
   npm run typecheck
   ```

   **Vezi:** după 10–30 de secunde, promptul revine fără niciun rând care conține `error TS`. Dacă apar erori, copiază tot textul și dă-l asistentului.

### 4.6 Publicare și testare cu `curl`

Vercel face deploy singur la fiecare push pe ramura `main`. Migrările din `db/migrations` se aplică la build (scriptul `build` din `apps/web/package.json` rulează `scripts/migrate.mjs`).

1. Rulează:

   ```sh
   cd <<REPO>>
   ```
2. Rulează:

   ```sh
   git add apps/web/src/lib apps/web/src/proxy.ts apps/web/src/app/api apps/web/vercel.json db/migrations
   ```

   **Vezi:** nimic.
3. Rulează:

   ```sh
   git commit -m "API pentru aplicatia nativa"
   ```

   **Vezi:** un rând de forma `[main abc1234] API pentru aplicatia nativa` și numărul de fișiere schimbate.
4. Rulează:

   ```sh
   git push origin main
   ```

   **Vezi:** ultimul rând conține `main -> main`.
5. Deschide în browser `https://vercel.com`, intră în proiect, fila **Deployments**. **Vezi:** deploy-ul cel mai de sus trece din „Building” în „Ready” (1–3 minute). Dacă devine „Error”, deschide-l, copiază jurnalul de build și dă-l asistentului.
6. Test: autentificare cu parolă greșită. Rulează:

   ```sh
   curl -s -X POST https://viitorul-cluj.vercel.app/api/mobile/auth/login -H "Content-Type: application/json" -d '{"email":"<<EMAIL_DEMO>>","password":"gresit"}'
   ```

   **Vezi:** `{"error":"E-mail sau parolă greșită."}`. Dacă vezi cod HTML sau `Redirecting`, modificarea M1 din `proxy.ts` nu a ajuns în producție.
7. Test: autentificare corectă. Rulează:

   ```sh
   curl -s -X POST https://viitorul-cluj.vercel.app/api/mobile/auth/login -H "Content-Type: application/json" -d '{"email":"<<EMAIL_DEMO>>","password":"<<PAROLA_DEMO>>"}'
   ```

   **Vezi:** un rând JSON de forma `{"token":"…","expiresAt":"2026-11-…","userId":"…","role":"player","mustChangePassword":false,"consentAccepted":true}`. Copiază valoarea dintre ghilimele de după `"token":` — aceasta este `<<TOKEN>>` pentru pașii următori.
8. Test: date sub RLS. Rulează:

   ```sh
   curl -s "https://viitorul-cluj.vercel.app/api/mobile/rest/players?select=id,display_name" -H "Authorization: Bearer <<TOKEN>>"
   ```

   **Vezi:** o listă cu **un singur** jucător — chiar contul cu care te-ai autentificat: `[{"id":"…","display_name":"…"}]`. Dacă vezi mai mulți jucători cu un cont de jucător, oprește-te: este o problemă de RLS și trebuie rezolvată înainte de orice altceva.
9. Test: fără token. Rulează:

   ```sh
   curl -s "https://viitorul-cluj.vercel.app/api/mobile/rest/players?select=id"
   ```

   **Vezi:** `{"code":"PGRST301","message":"Sesiunea a expirat. Autentifică-te din nou.","details":null,"hint":null}`.
10. Test: închiderea sesiunii. Rulează:

    ```sh
    curl -s -X POST https://viitorul-cluj.vercel.app/api/mobile/auth/logout -H "Authorization: Bearer <<TOKEN>>"
    ```

    **Vezi:** `{"ok":true}`. Dacă repeți acum pasul 8, primești răspunsul de la pasul 9: tokenul nu mai este valabil.

### 4.7 Securitatea API-ului pentru mobil

| Măsură | Unde este |
|---|---|
| **Doar HTTPS** | Vercel servește numai HTTPS; web-ul trimite deja antetul HSTS (`next.config.ts`). Adresa de producție este scrisă în `apps/mobile/src/lib/config.ts`, iar aplicația refuză să pornească în producție cu o adresă care nu începe cu `https://`. |
| **Token opac, nu JWT** | 256 de biți aleatori; în bază stă doar SHA-256 al lui (`packages/db/src/auth.ts`). Poate fi revocat oricând: ieșirea din cont, dezactivarea contului și schimbarea parolei șterg sesiunile. Valabil 30 de zile, prelungit la folosire. |
| **Token păstrat în `expo-secure-store`** | Keychain pe iOS, Keystore pe Android; niciodată în AsyncStorage (secțiunea 12). |
| **Limitarea încercărilor de autentificare** | există deja în `signInWithPassword`: 8 eșecuri pe adresă de e-mail sau 40 pe IP în 15 minute → răspuns 429. Ruta de login trimite IP-ul și agentul, ca pe web. |
| **CORS neactivat** | Rutele nu trimit antete `Access-Control-Allow-*`. Aplicațiile native nu au nevoie de CORS, iar un site străin deschis într-un browser nu poate citi răspunsurile. Nu adăuga CORS „ca să meargă”. |
| **Aceleași RLS** | `/api/mobile/rest` rulează fiecare cerere cu rolul `authenticated` și `app_auth.uid()` = utilizatorul tokenului. Nu există nicio cale prin care telefonul să ajungă la `service_role`. |
| **Răspunsuri necache-uite** | toate rutele trimit `Cache-Control: private, no-store`. |
| **Mărimea cererilor** | cel mult 256 KB pe cerere de date, 10 KB pe cerere de autentificare. |

**De știut:**

- **Suprafața expusă.** Până acum, formatul PostgREST era folosit doar în interiorul serverului. Odată cu ruta `/api/mobile/rest`, orice utilizator autentificat (inclusiv personalul) poate trimite cereri PostgREST oarecare, cu tokenul lui. Este exact modelul pentru care au fost scrise politicile RLS, dar înseamnă că RLS chiar este singura barieră. Rulează `npm run test:rls` (scriptul `scripts/test-rls.ts`) înainte de fiecare lansare. **[recomandare]**
- **O verificare care există doar pe web.** Acțiunea `toggleExercise` de pe web verifică, prin `resolveItem`, că exercițiul bifat aparține chiar planului jucătorului. Politica `exercise_completions_insert` verifică doar că bifa este pe numele jucătorului și că ziua este în ultimele 3 zile. Prin API, un jucător ar putea insera o bifă proprie care arată spre un exercițiu din planul altcuiva, dacă i-ar ghici identificatorul (un UUID pe care RLS nu îl lasă să-l citească). Impactul este mic, dar merită închis cu un trigger `before insert` pe `exercise_completions`, care refuză rândul dacă `plan_item_id` nu aparține unui plan al aceluiași `player_id`. **[recomandare]** — de făcut într-o migrare separată, înainte de lansarea publică.
- **Limitarea ratei pe `/api/mobile/rest`** nu există în cod. Dacă devine necesară, se pune din Vercel Firewall (reguli pe cale), nu în aplicație. **[recomandare]**

## 5. Ce se portează și în ce ordine

Ecranele native poartă **aceleași nume de cale ca pe web** (`/azi`, `/chestionar`…). Așa, câmpul `link` din tabelul `notifications` (care conține căi web) se poate deschide direct și în aplicația nativă.

### Etapa 1 — jucătorul

| Ecran web | Ecran nativ (`apps/mobile/src/app/…`) | Prioritate | Observații |
|---|---|---|---|
| `/autentificare` | `autentificare.tsx` | 1 | `POST /api/mobile/auth/login`. Cod complet în 8.5. |
| `/auth/link?t=…` (invitație) | `invitatie.tsx` | 1 | La început: jucătorul deschide linkul în browser, își alege parola pe web, apoi intră în aplicație cu e-mail și parolă. Varianta nativă: un ecran în care lipește linkul; aplicația extrage codul de după `t=` și apelează `/api/mobile/auth/redeem`. |
| `/parola?prima=1` | `(setup)/parola.tsx` | 1 | Se arată când `/api/mobile/auth/me` întoarce `mustChoosePassword: true`. Apelează `/api/mobile/auth/password`. Minimum 10 caractere (regula din `@club/db`). |
| `/consimtamant` | `(setup)/consimtamant.tsx` | 1 | Textul vine din `consentText(consentAudience(role, minor), club.name)`. Acceptarea: `db.from("consents").insert({ user_id, player_id, kind, text_version: CONSENT_VERSION, guardian_name, guardian_relation })`, cu aceleași valori ca în `acceptConsent` din `apps/web/src/lib/auth-actions.ts`. La minori se cere numele părintelui / tutorelui. Fără acord, restul aplicației nu se deschide. |
| `/azi` | `(app)/azi.tsx` | 1 | `getPlayerDay` + `setCompletion`. Cod minim în 8.5; versiunea offline în 10. Comentariu și durere la exercițiu: un panou deschis la apăsare lungă. |
| `/chestionar` | `(app)/chestionar.tsx` | 1 | `getWellnessEntry` + `submitWellness`; întrebările suplimentare din `wellnessConfigForGroup`. Scale 1–10 cu butoane mari. Harta corpului: 5.1. |
| `/exercitii/[id]` | `(app)/exercitii/[id].tsx` | 1 | Datele exercițiului vin deja în `DayItem.exercise` (nu e nevoie de altă interogare). Video: secțiunea 11. |
| RPE (card pe `/azi`) | card în `(app)/azi.tsx` | 1 | `submitRpe(db, playerId, azi, "training" \| "match", rpe, minute)`. |
| `/profil` | `(app)/profil.tsx` | 1 (minim) | Nume, e-mail, club, grupă; comutator pentru notificări; „Ieși din cont”; „Cere ștergerea contului” (inserare în `data_requests` cu `kind: "delete"`, ca acțiunea `createDataRequest` de pe web); link către politica de confidențialitate. Editarea datelor de contact și fotografia rămân pe web în Etapa 1. |
| `/notificari` | `(app)/notificari.tsx` | 1 | `listNotifications`, `markNotificationsRead`. Atingerea unui rând deschide `link`. |

### Etapa 2

| Ecran web | Ecran nativ | Prioritate | Observații |
|---|---|---|---|
| `/plan` (calendar) | `(app)/plan.tsx` | 2 | `getPlayerCalendar`; atingerea unei zile deschide `/azi?zi=AAAA-LL-ZZ`. |
| Evoluția mea (grafice proprii) | `(app)/evolutie.tsx` | 2 | Chestionare și încărcare pe ultimele săptămâni. Graficele se redesenează nativ (pe web sunt făcute cu `recharts`, care nu merge în React Native). |
| `/disponibilitate` (antrenor) | `(staff)/disponibilitate.tsx` | 2 | **Doar citire.** `listPlayers` + `ctx.statuses`; antrenorul vede doar grupele lui, pentru că așa hotărăște RLS. Fără fișa medicală. |

### Rămâne doar pe web

| Modul web | De ce nu se portează |
|---|---|
| `/administrare`, conturi, grupe, setări | Folosit rar, de un singur om, la birou. Greșelile aici au efect asupra tuturor. |
| `/import` (stare de sănătate, oboseală, date fizice) | Lucrează cu fișiere Excel / CSV de pe calculator și cu tabele late de potrivire a numelor. |
| `/programe`, `/planuri`, editorul de plan al jucătorului | Ecrane dense, cu liste lungi și tragere-și-plasare; pe telefon ar fi mai lente decât pe web. |
| `/biblioteca` (editare exerciții, încărcare de clipuri) | Încărcarea clipurilor de 100 MB se face de pe calculator, pe rețea fixă. |
| `/rapoarte`, `/tablou`, `/wellness` (grila), `/fizic` | Tabele și grafice late, exporturi PDF / Excel. |
| Fișa medicală completă, documentele medicale, `/cazuri` | **Mai puțină suprafață de date medicale pe telefoane.** Un telefon se pierde, se împrumută, face capturi de ecran. Diagnosticele și documentele rămân într-un singur loc, cu jurnal de audit la fiecare acces. |

Web-ul rămâne instalabil ca PWA; personalul îl poate folosi în continuare de pe telefon, din browser.

### 5.1 Harta corpului

Pe web, harta este desenată din cod în `apps/web/src/components/ui/body-map.tsx`: forme simple (elipse și dreptunghiuri rotunjite) într-un cadru de 200 × 410, cu oglindire stânga / dreapta. În nativ se desenează **aceleași forme, cu aceleași coordonate**, cu `react-native-svg`.

**[recomandare]** Ca geometria să nu existe în două locuri, mută partea de date într-un fișier comun:

1. Creează `<<REPO>>/packages/shared/src/body-map.ts` și mută acolo, din `body-map.tsx`, tipurile `Shape` și `Region`, constanta `C`, funcțiile `pair`, `el`, `rc`, `buildRegions`, constanta `REGIONS` și funcția `matches`. Exportă-le sub numele `BodyShape`, `BodyRegion`, `BODY_REGIONS` și `regionMatches`.
2. Adaugă în `<<REPO>>/packages/shared/src/index.ts` rândul `export * from "./body-map";`.
3. În `body-map.tsx` de pe web, șterge codul mutat și importă-l din `@club/shared`.

Apoi componenta nativă este scurtă. Fișierul `<<REPO>>/apps/mobile/src/components/BodyMap.tsx` (instalare: `npx expo install react-native-svg`, din `apps/mobile`):

```tsx
import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Rect } from "react-native-svg";
import { BODY_REGIONS, regionMatches, zoneLabel, type BodyRegion, type BodySide, type BodyView, type BodyZoneCode } from "@club/shared";

export type BodySelection = { zone: BodyZoneCode; side: BodySide | null };

function Figure({ view, value, onPick }: { view: BodyView; value: BodySelection | null; onPick: (r: BodyRegion) => void }) {
  return (
    <View style={styles.figure}>
      <Svg viewBox="0 0 200 400" style={styles.svg}>
        {BODY_REGIONS[view].map((r, i) => {
          const selected = !!value && regionMatches(r, value.zone, value.side);
          const common = {
            fill: selected ? "#0b5cab" : "#e3e8ed",
            stroke: selected ? "#111" : "#a9b3bf",
            strokeWidth: selected ? 2 : 1,
            onPress: () => onPick(r),
            accessible: true,
            accessibilityRole: "button" as const,
            accessibilityLabel: zoneLabel(r.zone, r.side),
            accessibilityState: { selected },
          };
          return r.shape.t === "ellipse" ? (
            <Ellipse key={i} cx={r.shape.cx} cy={r.shape.cy} rx={r.shape.rx} ry={r.shape.ry} {...common} />
          ) : (
            <Rect key={i} x={r.shape.x} y={r.shape.y} width={r.shape.w} height={r.shape.h} rx={r.shape.r} {...common} />
          );
        })}
      </Svg>
      <Text style={styles.caption}>{view === "front" ? "Față" : "Spate"}</Text>
    </View>
  );
}

/** Alegerea zonei dureroase pe siluetă: aceleași forme și aceleași coduri de zonă ca pe web. */
export function BodyMap({ value, onChange }: { value: BodySelection | null; onChange: (v: BodySelection | null) => void }) {
  const pick = (r: BodyRegion) =>
    onChange(value && regionMatches(r, value.zone, value.side) && (r.side === null || value.side === r.side) ? null : { zone: r.zone, side: r.side });
  return (
    <View style={styles.row}>
      <Figure view="front" value={value} onPick={pick} />
      <Figure view="back" value={value} onPick={pick} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  figure: { flex: 1, alignItems: "center" },
  svg: { width: "100%", aspectRatio: 0.5, maxWidth: 210 },
  caption: { marginTop: 4, fontSize: 14, fontWeight: "600", color: "#4a4f57" },
});
```

Sub siluetă pune și lista de zone ca text (din `BODY_ZONES`), ca pe web: este calea de rezervă pentru cine nu nimerește zona cu degetul și pentru cititoarele de ecran. Dacă nu vrei să atingi web-ul acum, copiază geometria în `apps/mobile` și notează datoria în `DECIZII.md`.

## 6. Conturi și costuri

| Cont | Cost (verificat la 7 octombrie 2026) | Pe numele cui | Cât durează |
|---|---|---|---|
| **Apple Developer Program** | 99 USD pe an (în moneda locală) | **Persoană juridică** — firma care operează platforma (sau clubul, dacă aplicația rămâne a unui singur club). Înscrierea ca organizație cere: număr **D-U-N-S**, site public pe domeniul organizației, adresă de e-mail pe acel domeniu, o persoană cu drept de a semna pentru organizație. | D-U-N-S: gratuit, dar poate dura de la câteva zile la câteva săptămâni. Verificarea Apple: de regulă câteva zile după ce D-U-N-S există. *Durata exactă nu e publicată de Apple — de verificat la înscriere.* |
| **Google Play Console** | 25 USD, o singură dată | **Cont de organizație** (cere tot D-U-N-S). **[cerință]** Google impune cont de organizație pentru aplicațiile medicale. | Verificarea identității și a organizației: zile. *Durata nu e publicată — de verificat.* |
| **Expo / EAS** | Gratuit: 15 build-uri Android + 15 iOS pe lună, EAS Update pentru 1 000 de utilizatori activi lunar, trimitere în magazine inclusă. Starter: 19 USD/lună (include 45 USD credit de build, 3 000 de utilizatori activi pentru Update). | O **organizație** Expo a firmei, în care contul tău este membru. | Imediat. |
| **Firebase** (doar pentru notificările Android) | Fără cost pentru Cloud Messaging. *De verificat pe pagina de prețuri Firebase la creare.* | Contul Google al firmei. | Imediat. |
| **Vercel** | Proiectul web există deja. **Hobby** este permis doar pentru uz personal, necomercial, iar sarcinile programate rulează acolo cel mult o dată pe zi. **Pro:** 20 USD/lună pentru fiecare loc de dezvoltator; sarcini programate până la o dată pe minut. | Echipa Vercel a firmei. | Imediat. |
| **Neon** (Postgres) | Planul actual al aplicației web. Aplicația nativă nu adaugă nimic: nu se conectează la bază. | — | — |
| **Numărul D-U-N-S** | Gratuit (Dun & Bradstreet). | Firma. | Vezi mai sus. **Cere-l primul**: este singurul lucru din listă care poate bloca săptămâni. |

De ce nu conturi personale **[cerință + recomandare]**:

- Apple, regula 5.1.1(ix): aplicațiile din domenii reglementate, între care sănătatea, sau care cer date sensibile „should be submitted by a legal entity that provides the services, and not by an individual developer”.
- Google: contul de organizație este obligatoriu pentru „Health applications: Medical apps”. În plus, conturile **personale** create după 13 noiembrie 2023 trebuie să treacă printr-un test închis cu cel puțin 12 testeri înscriși continuu 14 zile înainte de a putea publica; cerința este formulată doar pentru conturile personale.
- Numele vânzătorului afișat în magazine este numele titularului contului. Un părinte care caută aplicația clubului trebuie să vadă o firmă, nu numele unei persoane.
- Un cont personal nu se poate preda curat dacă persoana pleacă din proiect.

## 7. Pregătirea calculatorului (Mac)

Faci asta o singură dată. Ordinea contează doar pentru Node.js (primul).

### 7.1 Node.js

1. Deschide Terminal.
2. Rulează:

   ```sh
   node -v
   ```

   **Vezi:** un număr de versiune. Expo SDK 57 cere **cel puțin v22.13**. Dacă vezi `v22.13` sau mai mare (inclusiv `v24`), treci la 7.2. Dacă vezi `command not found` sau o versiune mai mică, continuă cu pasul 3.
3. Deschide în browser `https://nodejs.org`.
4. Apasă butonul de descărcare pentru versiunea **LTS** (fișier `.pkg` pentru macOS).
5. Deschide fișierul descărcat din folderul `Downloads` și apasă **Continue** până la **Install**; introdu parola Mac-ului când o cere.
6. Închide Terminalul (⌘Q) și deschide-l din nou.
7. Rulează din nou `node -v`. **Vezi:** `v22.13` sau mai mare.

### 7.2 Xcode și simulatorul iOS

Ai nevoie de Xcode doar pentru **simulator**; compilarea se face în cloud, cu EAS.

1. Deschide **App Store** pe Mac.
2. Caută `Xcode` și apasă **Get**, apoi **Install**. Descărcarea are peste 10 GB și poate dura mai mult de o oră. Dacă App Store spune că trebuie o versiune mai nouă de macOS, actualizează întâi macOS (**System Settings → General → Software Update**).
3. Deschide **Xcode** din folderul `Applications`. **Vezi:** o fereastră cu licența. Apasă **Agree** și introdu parola Mac-ului.
4. **Vezi:** o fereastră care întreabă ce platforme instalezi. Bifează **iOS** și apasă **Install** (alte câteva GB).
5. Din meniul de sus: **Xcode → Settings…** (⌘,) → fila **Locations**. La **Command Line Tools** alege versiunea din listă (dacă lista e goală, alege singura opțiune care apare).
6. Din meniul de sus: **Xcode → Open Developer Tool → Simulator**. **Vezi:** o fereastră în formă de iPhone care pornește și ajunge la ecranul principal. Poți închide Xcode; simulatorul rămâne.

### 7.3 Android Studio și un emulator

1. Deschide în browser `https://developer.android.com/studio` și descarcă Android Studio pentru Mac (alege varianta potrivită procesorului: **Apple chip** sau **Intel chip**; afli care din meniul Apple, colțul din stânga sus → **About This Mac**).
2. Deschide fișierul `.dmg` descărcat și trage **Android Studio** în **Applications**.
3. Deschide **Android Studio**. La prima pornire alege **Standard** și apasă **Next** până la **Finish**. **Vezi:** o listă de componente care se descarcă (Android SDK, Android SDK Platform, Android Virtual Device).
4. În fereastra de întâmpinare: **More Actions → Virtual Device Manager**.
5. Apasă **+** (Create Virtual Device), alege un telefon **Pixel** și apasă **Next**.
6. La imaginea de sistem alege una care are **Google Play** în nume (fără Google Play nu funcționează notificările push) și apasă **Next**, apoi **Finish**.
7. În listă, apasă butonul ▶ din dreptul dispozitivului. **Vezi:** o fereastră în formă de telefon Android care pornește.
8. În Terminal, rulează:

   ```sh
   echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc
   ```

   **Vezi:** nimic.
9. Rulează:

   ```sh
   echo 'export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools' >> ~/.zshrc
   ```

   **Vezi:** nimic.
10. Închide Terminalul (⌘Q), deschide-l din nou și rulează:

    ```sh
    adb --version
    ```

    **Vezi:** un rând care începe cu `Android Debug Bridge version`. Dacă vezi `command not found`, copiază rezultatul comenzii `cat ~/.zshrc` și dă-l asistentului.

### 7.4 Contul Expo

1. Deschide `https://expo.dev/signup` și creează un cont (folosește o adresă de e-mail a firmei).
2. După autentificare, din meniul contului (colțul din stânga sus) alege **Create Organization** și dă-i numele firmei. **[recomandare]** Proiectul aplicației se creează în organizație, nu în contul personal.

### 7.5 EAS CLI

1. În Terminal, rulează:

   ```sh
   npm install --global eas-cli
   ```

   **Vezi:** `added … packages`. Dacă vezi o eroare cu `EACCES`, rulează în loc `sudo npm install --global eas-cli` și introdu parola Mac-ului (nu se vede când o tastezi; apeși Enter la final).
2. Rulează:

   ```sh
   eas --version
   ```

   **Vezi:** un rând care începe cu `eas-cli/` (la data scrierii: `eas-cli/24.11.0`).
3. Rulează:

   ```sh
   eas login
   ```

   **Vezi:** cere e-mailul și parola contului Expo, apoi scrie `Logged in`.
4. Rulează:

   ```sh
   eas whoami
   ```

   **Vezi:** numele contului și, dedesubt, organizația creată la 7.4.

## 8. Crearea proiectului `apps/mobile`

Toate comenzile de aici au fost rulate pe o copie a repo-ului, cu `create-expo-app` 5.0.0 și Expo SDK 57.0.27. Dacă în ziua în care lucrezi a apărut SDK 58 (era în versiune beta de la 15 septembrie 2026), comanda de creare îl va folosi pe acela; pașii rămân aceiași, dar citește întâi nota de lansare (link în secțiunea 17).

### 8.1 Crearea

1. Rulează:

   ```sh
   cd <<REPO>>
   ```
2. Rulează:

   ```sh
   npx create-expo-app@latest apps/mobile --template blank-typescript --no-install
   ```

   **Vezi:** dacă întreabă `Ok to proceed? (y)`, tastezi `y` și Enter. La final: `✅ Your project is ready!`.
3. Rulează:

   ```sh
   ls -a apps/mobile
   ```

   **Vezi:** o listă care conține `App.tsx`, `app.json`, `assets`, `index.ts`, `package.json`, `tsconfig.json`, `AGENTS.md`. Uită-te dacă lista conține și `.git`.
4. **Doar dacă** la pasul 3 a apărut `.git`: proiectul nou și-a făcut propriul depozit git, ceea ce strică monorepo-ul. Șterge-l cu comanda de mai jos, copiată exact (fără spații în cale):

   ```sh
   rm -rf apps/mobile/.git
   ```

   **Vezi:** nimic. Repetă pasul 3: `.git` nu mai apare.
5. Șterge cele două fișiere de pornire pe care Expo Router le înlocuiește:

   ```sh
   rm apps/mobile/App.tsx apps/mobile/index.ts
   ```

   **Vezi:** nimic.

### 8.2 Legarea de monorepo și instalarea pachetelor

1. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
2. Rulează (un singur rând; ghilimelele simple sunt necesare):

   ```sh
   npm pkg set 'main=expo-router/entry' 'dependencies.@club/shared=*' 'dependencies.@supabase/postgrest-js=^2.117.2'
   ```

   **Vezi:** nimic. Comanda a scris trei lucruri în `apps/mobile/package.json`: punctul de intrare al Expo Router, legătura cu pachetul comun și constructorul de interogări (aceeași versiune ca în `packages/shared`).
3. Rulează:

   ```sh
   cd <<REPO>>
   ```
4. Rulează:

   ```sh
   npm install
   ```

   **Vezi:** `added … packages` (durează 1–2 minute). Avertismentele cu `npm warn` și rândurile despre `vulnerabilities` nu sunt erori.
5. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
6. Rulează (un singur rând). `npx expo install` alege singur versiunile potrivite cu SDK-ul; folosește-l mereu în loc de `npm install` pentru pachetele aplicației native:

   ```sh
   npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar expo-splash-screen expo-secure-store expo-dev-client @react-native-async-storage/async-storage expo-network
   ```

   **Vezi:** un rând care începe cu `› Installing`, apoi `added … packages`.
7. Verifică legătura cu pachetul comun:

   ```sh
   ls -l <<REPO>>/node_modules/@club/
   ```

   **Vezi:** trei rânduri, printre care `shared -> ../../packages/shared` (săgeata arată că este o legătură către folderul din monorepo, nu o copie).

### 8.3 Configurarea aplicației

1. Înlocuiește **tot** conținutul fișierului `<<REPO>>/apps/mobile/app.json` cu (înlocuiește marcajele; `<<IDENTIFICATOR>>` apare de două ori):

   ```json
   {
     "expo": {
       "name": "<<NUME_APLICATIE>>",
       "slug": "vestiar",
       "scheme": "vestiar",
       "version": "1.0.0",
       "orientation": "portrait",
       "icon": "./assets/icon.png",
       "userInterfaceStyle": "light",
       "ios": {
         "supportsTablet": false,
         "bundleIdentifier": "<<IDENTIFICATOR>>"
       },
       "android": {
         "package": "<<IDENTIFICATOR>>",
         "allowBackup": false,
         "predictiveBackGestureEnabled": false,
         "adaptiveIcon": {
           "backgroundColor": "#E6F4FE",
           "foregroundImage": "./assets/android-icon-foreground.png",
           "backgroundImage": "./assets/android-icon-background.png",
           "monochromeImage": "./assets/android-icon-monochrome.png"
         }
       },
       "plugins": ["expo-router", "expo-secure-store"]
     }
   }
   ```

   De știut: `"allowBackup": false` oprește copierea datelor aplicației în backupul Google al telefonului (acolo ar ajunge și planul păstrat local); `"supportsTablet": false` înseamnă că nu trebuie să pregătești capturi de ecran pentru iPad. **[recomandare]**
2. Adresa serverului **nu** se configurează aici: este scrisă în `src/lib/config.ts` (pasul 8.5) și este adresa de producție. Doar dacă vrei să lucrezi cu un server web pornit pe calculatorul tău, creează fișierul `<<REPO>>/apps/mobile/.env` cu rândul `EXPO_PUBLIC_API_URL=http://localhost:3000` (pentru emulatorul Android, `http://10.0.2.2:3000`). Fișierele `.env` sunt ignorate de git în acest repo (regula din `<<REPO>>/.gitignore`), deci nu ajung în build-urile făcute de EAS — de aceea adresa de producție stă în cod, nu în `.env`. Nu pune niciodată parole sau chei în variabile `EXPO_PUBLIC_…`: orice astfel de variabilă ajunge în aplicație și poate fi citită de oricine.

### 8.4 Structura de foldere

După pașii din 8.5, `apps/mobile` arată așa:

```
apps/mobile/
  app.json   package.json   tsconfig.json   assets/
  src/
    lib/
      config.ts        adresa API-ului
      session.ts       tokenul, în SecureStore
      api.ts           fetch cu token + cereri către /api/mobile
      db.ts            clientul de date (PostgrestClient)
      auth.tsx         starea de autentificare a aplicației
    app/
      _layout.tsx          rădăcina: cine vede ce
      autentificare.tsx    ecranul de autentificare
      (app)/
        _layout.tsx        zona autentificată
        index.tsx          trimite la /azi
        azi.tsx            ecranul „Azi”
```

Folderele se creează odată cu fișierele. Numele `(app)`, cu paranteze rotunde, este corect: în Expo Router, un folder între paranteze grupează ecrane fără să apară în cale.

### 8.5 Codul minim

Creează fiecare fișier la calea dată, cu exact acest conținut.

**`<<REPO>>/apps/mobile/src/lib/config.ts`**

```ts
/**
 * Adresa aplicației web. API-ul pentru mobil este la <adresă>/api/mobile, fișierele la <adresă>/api/files.
 * Nu este un secret. Pentru lucru cu un server local, pune altă adresă în apps/mobile/.env:
 *   EXPO_PUBLIC_API_URL=http://localhost:3000
 */
const PRODUCTION_URL = "https://viitorul-cluj.vercel.app";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_URL).replace(/\/+$/, "");

if (!__DEV__ && !API_URL.startsWith("https://")) throw new Error("În producție, API-ul se apelează doar prin HTTPS.");
```

**`<<REPO>>/apps/mobile/src/lib/session.ts`**

```ts
import * as SecureStore from "expo-secure-store";

/** Tokenul de sesiune stă doar în Keychain (iOS) / Keystore (Android), niciodată în AsyncStorage. */
const KEY = "sesiune";

export type StoredSession = { token: string; userId: string };

let current: StoredSession | null = null;

export function currentSession(): StoredSession | null {
  return current;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    current = raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    current = null;
  }
  return current;
}

export async function saveSession(session: StoredSession): Promise<void> {
  current = session;
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), {
    // disponibil după prima deblocare a telefonului; nu se copiază pe alt dispozitiv prin backup
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearSession(): Promise<void> {
  current = null;
  await SecureStore.deleteItemAsync(KEY);
}
```

**`<<REPO>>/apps/mobile/src/lib/api.ts`**

```ts
import { API_URL } from "./config";
import { currentSession } from "./session";

let onUnauthorized: (() => void) | null = null;
let lastTransientFailure = 0;

/**
 * Momentul ultimei cereri la care serverul NU a dat un răspuns de luat în seamă: fără semnal, timeout,
 * eroare de server (5xx), prea multe cereri sau sesiune expirată. Coada offline îl folosește ca să
 * deosebească „mai încearcă mai târziu” de „serverul a refuzat definitiv”.
 */
export const lastTransientFailureAt = () => lastTransientFailure;

/** Apelat când serverul răspunde 401 la o cerere făcută cu token: sesiunea a expirat sau a fost închisă. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** `fetch` care adaugă tokenul de sesiune. Folosit de clientul de date și de cererile către /api/mobile și /api/files. */
export const authFetch: typeof fetch = async (input, init) => {
  const session = currentSession();
  const headers = new Headers(init?.headers);
  if (session) headers.set("Authorization", `Bearer ${session.token}`);
  let res: Response;
  try {
    res = await fetch(input, { ...init, headers });
  } catch (e) {
    lastTransientFailure = Date.now();
    throw e;
  }
  if (res.status === 401 || res.status === 429 || res.status >= 500) lastTransientFailure = Date.now();
  if (res.status === 401 && session) onUnauthorized?.();
  return res;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Cerere JSON către /api/mobile/<cale>. Aruncă ApiError cu mesajul în română venit de la server. */
export async function api<T>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(`${API_URL}/api/mobile${path}`, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(0, "Nu s-a putut contacta serverul. Verifică conexiunea.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "A apărut o eroare.");
  return data as T;
}
```

**`<<REPO>>/apps/mobile/src/lib/db.ts`** — clientul de date. Este aceeași clasă ca pe web; diferă doar adresa și felul în care ajunge tokenul.

```ts
import { PostgrestClient } from "@supabase/postgrest-js";
import type { Database, Db } from "@club/shared";
import { API_URL } from "./config";
import { authFetch } from "./api";

/**
 * Clientul de date al aplicației native: același constructor de interogări ca pe web,
 * doar că cererile pleacă prin HTTPS către /api/mobile/rest, cu tokenul de sesiune.
 * Serverul le execută sub Row Level Security, cu identitatea utilizatorului.
 */
export const db: Db = new PostgrestClient<Database>(`${API_URL}/api/mobile/rest`, {
  fetch: authFetch,
  retry: false,
  timeout: 20_000,
});
```

**`<<REPO>>/apps/mobile/src/lib/auth.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAppContext, type AppContext } from "@club/shared";
import { api, setUnauthorizedHandler } from "./api";
import { db } from "./db";
import { clearSession, loadSession, saveSession } from "./session";

type LoginResponse = { token: string; userId: string };

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; ctx: AppContext };

type AuthValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** recitește profilul de pe server (după consimțământ, schimbarea parolei etc.) */
  refresh: () => Promise<void>;
};

const CTX_KEY = "ctx";
const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth se folosește doar în interiorul <AuthProvider>.");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  /** Șterge tot ce ține de cont de pe telefon. */
  const wipe = useCallback(async () => {
    await clearSession();
    await AsyncStorage.clear();
    setState({ status: "signedOut" });
  }, []);

  const refresh = useCallback(async () => {
    const session = await loadSession();
    if (!session) return;
    // Întâi o interogare simplă: dacă dă eroare (fără semnal), rămânem pe datele păstrate local.
    const probe = await db.from("profiles").select("id, is_active").eq("id", session.userId).maybeSingle();
    if (probe.error) return;
    if (!probe.data?.is_active) return wipe();
    const ctx = await getAppContext(db, session.userId);
    if (!ctx) return;
    await AsyncStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    setState({ status: "signedIn", ctx });
  }, [wipe]);

  useEffect(() => {
    setUnauthorizedHandler(() => void wipe());
    (async () => {
      const session = await loadSession();
      if (!session) return setState({ status: "signedOut" });
      const cached = await AsyncStorage.getItem(CTX_KEY);
      if (cached) setState({ status: "signedIn", ctx: JSON.parse(cached) as AppContext });
      await refresh();
      // prima pornire fără semnal și fără date păstrate: cerem autentificarea din nou
      setState((s) => (s.status === "loading" ? { status: "signedOut" } : s));
    })();
    return () => setUnauthorizedHandler(null);
  }, [refresh, wipe]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>("/auth/login", { email: email.trim(), password });
    await saveSession({ token: res.token, userId: res.userId });
    const ctx = await getAppContext(db, res.userId);
    if (!ctx) {
      await clearSession();
      throw new Error("Contul nu este activ. Ia legătura cu preparatorul fizic.");
    }
    await AsyncStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    setState({ status: "signedIn", ctx });
  }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout").catch(() => {});
    await wipe();
  }, [wipe]);

  const value = useMemo(() => ({ state, signIn, signOut, refresh }), [state, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

**`<<REPO>>/apps/mobile/src/app/_layout.tsx`**

```tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth";

// ecranul de pornire rămâne vizibil până știm dacă există o sesiune
SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { state } = useAuth();

  useEffect(() => {
    if (state.status !== "loading") SplashScreen.hide();
  }, [state.status]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === "signedIn"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={state.status !== "signedIn"}>
        <Stack.Screen name="autentificare" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigator />
    </AuthProvider>
  );
}
```

**`<<REPO>>/apps/mobile/src/app/autentificare.tsx`**

```tsx
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Autentificare() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      // nu navigăm de mână: când starea devine „signedIn”, Stack.Protected arată zona autentificată
    } catch (e) {
      setError(e instanceof Error ? e.message : "A apărut o eroare.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Autentificare</Text>
      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
      />
      <Text style={styles.label}>Parolă</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Pressable style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Intră în cont</Text>}
      </Pressable>
      <Text style={styles.hint}>Conturile se creează doar de către club. Dacă ai primit un link de invitație, deschide-l întâi în browser și alege-ți parola.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24, color: "#111" },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 6, color: "#111" },
  input: { height: 52, borderWidth: 1, borderColor: "#8a8f98", borderRadius: 10, paddingHorizontal: 14, fontSize: 17, marginBottom: 16, color: "#111" },
  error: { color: "#b00020", fontSize: 15, marginBottom: 12 },
  button: { height: 52, borderRadius: 10, backgroundColor: "#0b5cab", alignItems: "center", justifyContent: "center" },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  hint: { marginTop: 20, fontSize: 14, lineHeight: 20, color: "#4a4f57" },
});
```

**`<<REPO>>/apps/mobile/src/app/(app)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="azi" options={{ title: "Azi" }} />
    </Stack>
  );
}
```

**`<<REPO>>/apps/mobile/src/app/(app)/index.tsx`**

```tsx
import { Redirect } from "expo-router";

/** Pagina de start. În etapa 1 aplicația este doar pentru jucători, deci mergem direct la „Azi”. */
export default function Start() {
  return <Redirect href="/azi" />;
}
```

**`<<REPO>>/apps/mobile/src/app/(app)/azi.tsx`** — aici se vede că pachetul comun funcționează: `getPlayerDay` și `setCompletion` sunt exact funcțiile folosite de pagina `/azi` de pe web.

```tsx
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { formatDate, getPlayerDay, setCompletion, todayIn, type DayItem, type PlayerDay } from "@club/shared";
import { useAuth } from "../../lib/auth";
import { db } from "../../lib/db";

export default function Azi() {
  const { state, signOut } = useAuth();
  const ctx = state.status === "signedIn" ? state.ctx : null;
  const player = ctx?.player ?? null;
  const [day, setDay] = useState<PlayerDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ctx || !player) return setLoading(false);
    setLoading(true);
    try {
      // „azi” se calculează în fusul orar al clubului, nu al telefonului
      setDay(await getPlayerDay(db, player.id, todayIn(ctx.settings.timezone)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut încărca planul.");
    } finally {
      setLoading(false);
    }
  }, [ctx, player]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(item: DayItem) {
    if (!player || !day) return;
    try {
      // păstrăm comentariul și durerea deja notate, exact ca pe web
      await setCompletion(db, player.id, day.date, item, {
        done: !item.completion?.done,
        comment: item.completion?.comment ?? null,
        pain: item.completion?.pain ?? false,
        pain_intensity: item.completion?.pain_intensity ?? null,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu am putut salva.");
    }
  }

  if (!player) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Aplicația de pe telefon este, deocamdată, doar pentru jucători. Folosește versiunea web.</Text>
        <Pressable onPress={signOut} accessibilityRole="button"><Text style={styles.link}>Ieși din cont</Text></Pressable>
      </View>
    );
  }

  const sections = [
    ...(day?.plan ? [{ title: day.plan.title ?? "Planul de azi", data: day.plan.items }] : []),
    ...(day?.programs ?? []).map((p) => ({ title: p.name, data: p.items })),
  ];

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.key}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.date}>{day ? formatDate(day.date, { weekday: true }) : ""}</Text>
          <Text style={styles.progress}>{day ? `${day.done} din ${day.total} exerciții făcute` : ""}</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={loading ? null : <Text style={styles.emptyText}>Nu ai nimic programat azi.</Text>}
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item }) => {
        const done = !!item.completion?.done;
        const dose = [item.sets ? `${item.sets} serii` : null, item.reps ? `${item.reps} repetări` : null].filter(Boolean).join(" × ");
        return (
          <Pressable
            style={styles.row}
            onPress={() => toggle(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={item.exercise.name}
          >
            <View style={[styles.box, done && styles.boxDone]}>{done ? <Text style={styles.check}>✓</Text> : null}</View>
            <View style={styles.rowText}>
              <Text style={[styles.name, done && styles.nameDone]}>{item.exercise.name}</Text>
              {dose ? <Text style={styles.dose}>{dose}</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  header: { padding: 16 },
  date: { fontSize: 22, fontWeight: "700", color: "#111" },
  progress: { marginTop: 4, fontSize: 15, color: "#4a4f57" },
  error: { marginTop: 8, color: "#b00020", fontSize: 15 },
  section: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, fontWeight: "700", backgroundColor: "#f1f3f5", color: "#111" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#c8ccd2" },
  box: { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: "#4a4f57", alignItems: "center", justifyContent: "center", marginRight: 14 },
  boxDone: { backgroundColor: "#1a7f37", borderColor: "#1a7f37" },
  check: { color: "#fff", fontSize: 20, fontWeight: "700" },
  rowText: { flex: 1 },
  name: { fontSize: 17, color: "#111" },
  nameDone: { color: "#4a4f57", textDecorationLine: "line-through" },
  dose: { marginTop: 2, fontSize: 14, color: "#4a4f57" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  emptyText: { padding: 16, fontSize: 16, lineHeight: 22, color: "#4a4f57", textAlign: "center" },
  link: { marginTop: 16, fontSize: 17, fontWeight: "600", color: "#0b5cab" },
});
```

Verificare:

1. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
2. Rulează:

   ```sh
   npx tsc --noEmit
   ```

   **Vezi:** după câteva secunde promptul revine **fără niciun text**. Orice rând cu `error TS` înseamnă o greșeală de copiere; dă textul asistentului.

### 8.6 Prima rulare în simulator

Aplicația folosește module native (stocare securizată, mai târziu notificări și video), deci se rulează într-un **development build** — o variantă a aplicației tale, făcută de EAS, care se conectează la calculator și primește codul pe măsură ce îl schimbi. **Nu folosi Expo Go:** versiunea din magazine a rămas pe SDK 54, iar notificările push nu merg în Expo Go pe Android.

1. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
2. Rulează:

   ```sh
   eas build:configure
   ```

   **Vezi:** întreabă dacă să creeze un proiect EAS (răspunzi `Y`; dacă întreabă contul, alegi **organizația**) și pentru ce platforme (alegi `All`). La final apar fișierul `eas.json` și, în `app.json`, un bloc `extra.eas.projectId`. Formularea întrebărilor poate diferi puțin de la o versiune la alta.
3. Deschide `<<REPO>>/apps/mobile/eas.json`. Păstrează blocul `cli` așa cum a fost generat și înlocuiește blocul `build` cu:

   ```json
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "environment": "development",
         "ios": { "simulator": true }
       },
       "device": {
         "developmentClient": true,
         "distribution": "internal",
         "environment": "development"
       },
       "preview": {
         "distribution": "internal",
         "environment": "preview"
       },
       "production": {
         "autoIncrement": true,
         "environment": "production"
       }
     },
   ```

   `development` este pentru simulatorul iOS și emulatorul Android; `device` este pentru un telefon real (secțiunea 9); `production` este pentru magazine (secțiunea 13).
4. Pornește build-ul pentru simulatorul iOS:

   ```sh
   eas build --platform ios --profile development
   ```

   **Vezi:** un link de forma `https://expo.dev/accounts/…/builds/…` și un indicator de așteptare. Durează 10–25 de minute (pe planul gratuit poate exista coadă). La final întreabă dacă instalează și pornește aplicația în simulator: răspunzi `Y`. **Vezi:** în simulator apare aplicația, cu un ecran Expo care caută serverul de dezvoltare.
5. Pornește serverul de dezvoltare:

   ```sh
   npx expo start
   ```

   **Vezi:** un cod QR și o listă de taste. Apasă tasta `i`. **Vezi:** în simulator, ecranul **Autentificare**.
6. Introdu `<<EMAIL_DEMO>>` și `<<PAROLA_DEMO>>` și apasă **Intră în cont**. **Vezi:** ecranul **Azi**, cu data zilei scrisă în română (de forma „miercuri, 7 octombrie 2026”) și exercițiile jucătorului demo. Atinge un exercițiu: se bifează. Deschide aplicația web cu același cont: bifa este și acolo.
7. Dacă data apare ca „NaN” sau lista e goală, deși pe web contul are plan azi: funcția `todayIn` din `packages/shared/src/dates.ts` se bazează pe `Intl.DateTimeFormat` cu fus orar, iar comportamentul trebuie confirmat pe motorul JavaScript al telefonului (Hermes). Spune-i asistentului exact asta și dă-i ce vezi pe ecran. *Aceasta este singura parte din pachetul comun care nu a putut fi verificată fără un dispozitiv.*
8. Pentru Android: cu emulatorul pornit (7.3, pasul 7), oprește serverul cu ⌃C și rulează:

   ```sh
   eas build --platform android --profile development
   ```

   **Vezi:** la final întreabă dacă instalează aplicația pe emulator: `Y`. Apoi `npx expo start` și tasta `a`.

De acum, pentru lucrul de zi cu zi ajunge `npx expo start` din `<<REPO>>/apps/mobile`. Un build nou este necesar doar când adaugi un modul nativ sau schimbi `app.json` (secțiunea 14).

Ce mai lipsește față de un ecran „Azi” complet (îi dai asistentului lista): starea „trebuie aleasă parola / trebuie dat acordul” (`/api/mobile/auth/me` → ecranele `(setup)`), panoul de comentariu și durere, cardul RPE, navigarea cu file în partea de jos (Azi, Chestionar, Profil), culorile și sigla clubului din `ctx.club` (`primary_color`, `accent_color`, `logo_path`).

## 9. Notificări push

**Principiu:** tabelul `notifications` rămâne sursa. Notificările sunt create în baza de date (triggerele din `db/migrations/20261007000300_triggers.sql` pentru plan nou, program nou, schimbare de stare; funcția `send_wellness_reminders()` pentru mementoul de chestionar). Push-ul este doar un semnal că există ceva nou: **nu poartă date medicale**. Pe ecranul blocat apare „Ai un plan nou” sau „Completează chestionarul”, niciodată o stare, un diagnostic sau un nume.

### 9.1 Ce cer platformele **[cerință]**

- Un **development build** (nu Expo Go; de la SDK 53, push-ul nu mai merge în Expo Go pe Android).
- Un dispozitiv care suportă push: telefon real, emulator Android **cu Google Play** sau simulator iOS (iOS 16 sau mai nou).
- **iOS:** cont Apple Developer plătit; cheia APNs o generează EAS la primul build pentru telefon.
- **Android:** un proiect Firebase, fișierul `google-services.json` în proiect și o **cheie de cont de serviciu** (FCM V1) încărcată în EAS.
- Aplicația **nu are voie să condiționeze** folosirea ei de acceptarea notificărilor (Apple, 5.1.2(i)). Dacă jucătorul refuză, totul merge la fel; mementourile se văd în ecranul Notificări.

### 9.2 Baza de date

Creează fișierul `<<REPO>>/db/migrations/20261007190000_mobile_push.sql`. (Numele trebuie doar să fie, alfabetic, după toate migrările existente; dacă între timp au apărut migrări cu număr mai mare, mărește numărul.)

```sql
-- Aplicația nativă: evidența notificărilor trimise ca push + un token aparține unui singur cont.

alter table public.notifications add column if not exists pushed_at timestamptz;

-- ce exista înainte de aplicația nativă nu se mai trimite ca push
update public.notifications set pushed_at = created_at where pushed_at is null;

create index if not exists notifications_push_pending_idx
  on public.notifications (created_at) where pushed_at is null;

-- Același telefon, alt cont (telefon împrumutat, frate mai mic): tokenul trece la contul nou,
-- ca notificările vechiului cont să nu mai ajungă pe acest dispozitiv.
create or replace function private.push_token_claim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_tokens where token = new.token and user_id <> new.user_id;
  return new;
end $$;

drop trigger if exists push_token_claim on public.push_tokens;
create trigger push_token_claim before insert on public.push_tokens
  for each row execute function private.push_token_claim();
```

Tabelul `push_tokens` există deja, cu politica `push_tokens_all`: fiecare utilizator își vede și își scrie doar propriile rânduri. Coloana `pushed_at` nu poate fi scrisă de utilizatori (pe `notifications`, rolul `authenticated` are drept de actualizare doar pe `read_at`).

### 9.3 Trimiterea de pe server

Creează fișierul `<<REPO>>/apps/web/src/lib/push.ts`:

```ts
import "server-only";
import { getPool } from "@club/db";
import { APP_NAME } from "./env";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Textul care ajunge pe ecranul blocat al telefonului. Intenționat generic: NU copiem titlul și
 * corpul notificării din baza de date, pentru că unele conțin stări medicale sau nume de jucători.
 * Detaliile se văd doar după deschiderea aplicației.
 */
const PUSH_TEXT: Record<string, { title: string; body: string }> = {
  wellness_reminder: { title: "Chestionarul de azi", body: "Completează chestionarul — durează sub 30 de secunde." },
  plan_new: { title: "Plan nou", body: "Ai un plan nou. Deschide aplicația ca să-l vezi." },
  program_new: { title: "Program nou", body: "Ai un program nou. Deschide aplicația ca să-l vezi." },
};
const GENERIC = { title: APP_NAME, body: "Ai o notificare nouă. Deschide aplicația ca s-o vezi." };

type Pending = { id: string; user_id: string; kind: string; link: string | null };
type Ticket = { status: "ok" | "error"; message?: string; details?: { error?: string } };

/**
 * Trimite prin Expo Push Service notificările care nu au fost încă trimise ca push.
 * Fiecare notificare este „revendicată” înainte de trimitere (pushed_at = now()), deci două rulări
 * simultane nu trimit de două ori. Dacă serviciul Expo nu răspunde, revendicarea se anulează
 * și notificarea pleacă la rularea următoare.
 */
export async function sendPendingPushes(limit = 500): Promise<{ claimed: number; sent: number; failed: number }> {
  const pool = getPool();
  const { rows: pending } = await pool.query<Pending>(
    `update public.notifications n set pushed_at = now()
     where n.id in (
       select id from public.notifications
       where pushed_at is null and created_at > now() - interval '12 hours'
       order by created_at limit $1 for update skip locked)
     returning n.id, n.user_id, n.kind, n.link`,
    [limit],
  );
  if (!pending.length) return { claimed: 0, sent: 0, failed: 0 };

  const { rows: tokens } = await pool.query<{ user_id: string; token: string }>(
    "select user_id, token from public.push_tokens where user_id = any($1::uuid[]) and platform in ('ios', 'android')",
    [[...new Set(pending.map((n) => n.user_id))]],
  );

  const messages = pending.flatMap((n) =>
    tokens
      .filter((t) => t.user_id === n.user_id)
      .map((t) => ({
        to: t.token,
        ...(PUSH_TEXT[n.kind] ?? GENERIC),
        sound: "default",
        channelId: "default",
        // doar ce îi trebuie aplicației ca să deschidă ecranul potrivit; nicio dată medicală
        data: { url: n.link, notificationId: n.id },
      })),
  );

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  const retry = new Set<string>();
  // Expo acceptă cel mult 100 de mesaje pe cerere
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) throw new Error(`Expo Push a răspuns ${res.status}`);
      const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
      tickets.forEach((ticket, j) => {
        if (ticket.status === "ok") return void sent++;
        failed++;
        // telefonul a dezinstalat aplicația sau a oprit notificările: tokenul nu mai e bun
        if (ticket.details?.error === "DeviceNotRegistered") dead.push(chunk[j].to);
        else console.error("[push]", ticket.details?.error ?? ticket.message);
      });
    } catch (e) {
      console.error("[push] trimitere eșuată:", (e as Error).message);
      for (const m of chunk) retry.add(m.data.notificationId);
    }
  }

  if (dead.length) await pool.query("delete from public.push_tokens where token = any($1::text[])", [dead]);
  if (retry.size) await pool.query("update public.notifications set pushed_at = null where id = any($1::uuid[])", [[...retry]]);
  return { claimed: pending.length, sent, failed };
}
```

**Sarcina programată.** La data scrierii, ruta `/api/cron` este pomenită în `apps/web/CONVENTII.md`, dar fișierul nu există în repo. Dacă între timp a fost creat, adaugă în el doar importul și apelul `await sendPendingPushes()`. Dacă nu, creează `<<REPO>>/apps/web/src/app/api/cron/route.ts`:

```ts
import { createServiceDb } from "@club/db";
import { sendPendingPushes } from "@/lib/push";

export const maxDuration = 60;

/** Sarcina programată (Vercel Cron). Vercel trimite antetul „Authorization: Bearer <CRON_SECRET>”. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Acces interzis", { status: 401 });
  }
  const db = createServiceDb();
  const reminders = await db.rpc("send_wellness_reminders");
  const push = await sendPendingPushes();
  return Response.json({ reminders: reminders.data ?? 0, push });
}
```

În `<<REPO>>/apps/web/vercel.json` adaugă programarea (fișierul complet):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["fra1"],
  "crons": [{ "path": "/api/cron", "schedule": "*/10 * * * *" }]
}
```

> **Atenție la planul Vercel. [cerință]** Pe **Hobby**, o sarcină programată poate rula cel mult **o dată pe zi**, iar o expresie mai deasă (ca aceea de mai sus) **face deploy-ul să eșueze**. `*/10 * * * *` (la 10 minute) merge doar pe **Pro**. Pe Hobby ar trebui `0 7 * * *` (o dată pe zi; ora este în UTC — *de verificat în documentația Vercel Cron*), ceea ce face mementoul de chestionar imprecis (± 59 de minute). Pentru un produs folosit de un club, Pro este oricum planul potrivit (Hobby este doar pentru uz necomercial).

În Vercel → proiect → **Settings → Environment Variables**, adaugă `CRON_SECRET` cu o valoare aleatoare lungă (o poți genera în Terminal cu `openssl rand -hex 32`). Vercel o trimite singur în antetul `Authorization` al sarcinii programate.

**Trimitere imediată [recomandare].** Sarcina programată este plasa de siguranță. Ca jucătorul să afle de un plan nou în câteva secunde, nu în 10 minute, cheamă `sendPendingPushes` după fiecare acțiune de server reușită. În `<<REPO>>/apps/web/src/lib/actions.ts`:

- lângă importuri, adaugă:

  ```ts
  import { after } from "next/server";
  import { sendPendingPushes } from "./push";
  ```
- în funcția `run`, imediat după rândul `const data = await fn(session);`, adaugă:

  ```ts
      // dacă acțiunea a creat notificări (plan nou, program nou…), le trimitem ca push imediat după răspuns
      after(() => sendPendingPushes().catch(() => {}));
  ```

`after` (Next.js 16) rulează funcția după ce răspunsul a plecat, deci acțiunea nu devine mai lentă. Costul este o singură interogare scurtă, pe un index parțial.

**Securitate suplimentară [recomandare].** În panoul Expo al proiectului activează protecția suplimentară pentru push („enhanced security”), creează un token de acces și pune-l în Vercel ca `EXPO_ACCESS_TOKEN`. Codul de mai sus îl trimite automat. Fără el, oricine află un token de push al unui telefon poate trimite notificări acelui telefon prin serviciul Expo.

Limitele serviciului Expo **[cerință]**: cel mult 100 de mesaje pe cerere (codul împarte în grupuri de 100), 600 de notificări pe secundă pe proiect, 4 096 de octeți pe mesaj. Expo recomandă și verificarea „chitanțelor” (push receipts) la circa 15 minute după trimitere; la volumul unui club (sub 200 de telefoane) nu este necesară la început, dar merită adăugată când apar mai multe cluburi.

### 9.4 Aplicația

1. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
2. Instalează modulul:

   ```sh
   npx expo install expo-notifications
   ```

   **Vezi:** `added … packages`.
3. În `<<REPO>>/apps/mobile/app.json`, rândul `"plugins"` devine:

   ```json
       "plugins": ["expo-router", "expo-secure-store", "expo-notifications"]
   ```
4. Creează `<<REPO>>/apps/mobile/src/lib/storage.ts` (folosit și de secțiunea 10):

   ```ts
   import AsyncStorage from "@react-native-async-storage/async-storage";

   /** Citire / scriere JSON în stocarea locală a aplicației. (Tokenul de sesiune NU stă aici, ci în SecureStore.) */
   export async function getJson<T>(key: string): Promise<T | null> {
     try {
       const raw = await AsyncStorage.getItem(key);
       return raw ? (JSON.parse(raw) as T) : null;
     } catch {
       return null;
     }
   }

   export async function setJson(key: string, value: unknown): Promise<void> {
     await AsyncStorage.setItem(key, JSON.stringify(value));
   }

   export async function removeKeys(prefix: string, keep: (key: string) => boolean): Promise<void> {
     const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix) && !keep(k));
     if (keys.length) await AsyncStorage.multiRemove(keys);
   }
   ```
5. Creează `<<REPO>>/apps/mobile/src/lib/push.ts`:

   ```ts
   import { useEffect } from "react";
   import { Platform } from "react-native";
   import Constants from "expo-constants";
   import * as Notifications from "expo-notifications";
   import { router, type Href } from "expo-router";
   import { markNotificationsRead } from "@club/shared";
   import { db } from "./db";
   import { getJson, setJson } from "./storage";

   const TOKEN_KEY = "push:token";

   // Cum se arată o notificare sosită cât timp aplicația este deschisă.
   Notifications.setNotificationHandler({
     handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
   });

   /**
    * Cere permisiunea, obține tokenul Expo și îl salvează în tabelul `push_tokens` (RLS: doar rândurile proprii).
    * Se apelează după autentificare, când jucătorul apasă „Vreau notificări” — nu la prima pornire.
    */
   export async function registerForPush(userId: string): Promise<"ok" | "denied" | "unavailable"> {
     try {
       // pe Android canalul trebuie să existe înainte de cererea tokenului
       if (Platform.OS === "android") {
         await Notifications.setNotificationChannelAsync("default", { name: "Notificări", importance: Notifications.AndroidImportance.DEFAULT });
       }
       let { status } = await Notifications.getPermissionsAsync();
       if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
       if (status !== "granted") return "denied";

       const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
       if (!projectId) return "unavailable";
       const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

       const { error } = await db.from("push_tokens").upsert(
         { user_id: userId, token, platform: Platform.OS === "ios" ? "ios" : "android" },
         { onConflict: "user_id,token" },
       );
       if (error) return "unavailable";
       await setJson(TOKEN_KEY, token);
       return "ok";
     } catch {
       return "unavailable";
     }
   }

   /** La ieșirea din cont: telefonul nu mai primește notificările acestui utilizator. Se apelează ÎNAINTE de ștergerea sesiunii. */
   export async function unregisterPush(): Promise<void> {
     const token = await getJson<string>(TOKEN_KEY);
     if (token) await db.from("push_tokens").delete().eq("token", token);
   }

   /**
    * Câmpul `link` al notificării este o cale din aplicația web. Aici o traducem într-un ecran nativ.
    * Orice altceva (adresă externă, cale necunoscută) duce la lista de notificări — nu deschidem linkuri arbitrare.
    */
   export function nativeRoute(link: unknown): Href {
     if (typeof link !== "string" || !link.startsWith("/") || link.startsWith("//")) return "/notificari";
     const [path, query = ""] = link.split("?");
     const zi = new URLSearchParams(query).get("zi");
     if (path === "/azi" || path === "/chestionar" || path === "/profil" || path === "/notificari") return path;
     if (path === "/plan") return zi && /^\d{4}-\d{2}-\d{2}$/.test(zi) ? { pathname: "/azi", params: { zi } } : "/azi";
     const exercise = /^\/exercitii\/([0-9a-f-]{36})$/.exec(path);
     if (exercise) return { pathname: "/exercitii/[id]", params: { id: exercise[1] } };
     return "/notificari";
   }

   /** Deschide ecranul potrivit când jucătorul atinge o notificare (aplicația pornită sau închisă). Se pune în layoutul zonei autentificate. */
   export function useNotificationObserver() {
     useEffect(() => {
       function open(notification: Notifications.Notification) {
         const data = notification.request.content.data as { url?: unknown; notificationId?: unknown } | undefined;
         if (typeof data?.notificationId === "string") void markNotificationsRead(db, [data.notificationId]).catch(() => {});
         router.push(nativeRoute(data?.url));
       }
       const last = Notifications.getLastNotificationResponse();
       if (last?.notification) open(last.notification);
       const sub = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification));
       return () => sub.remove();
     }, []);
   }
   ```
6. În `<<REPO>>/apps/mobile/src/lib/auth.tsx`, la ieșirea din cont, tokenul de push se șterge **înainte** de închiderea sesiunii (după aceea serverul nu mai știe cine ești). Adaugă importul `import { unregisterPush } from "./push";` și, în funcția `signOut`, deasupra rândului `await api("/auth/logout").catch(() => {});`, rândul:

   ```ts
       await unregisterPush().catch(() => {});
   ```
7. Pune un buton pe ecranul „Azi” (sau în Profil), de exemplu „Primește un memento pentru chestionar”, care cheamă `registerForPush(ctx.userId)`. **[recomandare]** Nu cere permisiunea la prima pornire: sistemul arată fereastra o singură dată, iar un jucător care nu știe încă la ce folosește aplicația apasă „Nu”.
8. `<<REPO>>/apps/mobile/src/app/(app)/_layout.tsx` — versiunea finală, care pornește și coada offline din secțiunea 10 (creează întâi fișierele din 10.2, altfel importul `outbox` nu există):

   ```tsx
   import { useEffect } from "react";
   import { Stack } from "expo-router";
   import { startOutbox } from "../../lib/outbox";
   import { useNotificationObserver } from "../../lib/push";

   export default function AppLayout() {
     // retrimite ce a rămas nesalvat: la pornire, la revenirea în prim-plan, la revenirea conexiunii
     useEffect(() => startOutbox(), []);
     // deschide ecranul potrivit când jucătorul atinge o notificare
     useNotificationObserver();

     return (
       <Stack>
         <Stack.Screen name="index" options={{ headerShown: false }} />
         <Stack.Screen name="azi" options={{ title: "Azi" }} />
       </Stack>
     );
   }
   ```

Funcția `nativeRoute` este locul în care câmpul `link` (o cale web: `/chestionar`, `/azi`, `/plan?zi=2026-10-08`, `/profil`) devine un ecran nativ. Căile necunoscute și adresele externe duc la lista de notificări: aplicația nu deschide linkuri oarecare primite într-o notificare. Construiește ecranul `/notificari` înaintea celorlalte: până există, o notificare atinsă ajunge pe ecranul „Unmatched Route” al Expo Router.

### 9.5 Credențialele

**Android (Firebase, FCM V1):**

1. Deschide `https://console.firebase.google.com` cu contul Google al firmei și apasă **Add project** (sau **Create a project**). Dă-i un nume și termină pașii.
2. În proiect, apasă pictograma Android (**Add app**). La **Android package name** scrie exact `<<IDENTIFICATOR>>`. Apasă **Register app**.
3. Apasă **Download google-services.json** și mută fișierul descărcat în `<<REPO>>/apps/mobile/google-services.json`.
4. În `<<REPO>>/apps/mobile/app.json`, în blocul `"android"`, adaugă rândul:

   ```json
         "googleServicesFile": "./google-services.json",
   ```

   Acest fișier conține doar identificatori publici și poate fi pus în git.
5. În Firebase: roata dințată → **Project settings** → fila **Service accounts** → **Generate new private key** → **Generate key**. Se descarcă un fișier `.json`. **Acesta este un secret: nu îl muta în repo.** Lasă-l în `Downloads`.
6. În Terminal, din `<<REPO>>/apps/mobile`, rulează:

   ```sh
   eas credentials
   ```

   Alege, pe rând: **Android** → **production** → **Google Service Account** → opțiunea de încărcare a cheii pentru notificări push (FCM V1) → indică fișierul din `Downloads`. **Vezi:** un mesaj că cheia a fost încărcată. (Alternativ, din `https://expo.dev`: proiect → **Credentials** → identificatorul Android → **Service Credentials** → **FCM V1 service account key**.) Denumirile din meniu pot diferi puțin între versiuni.
7. După încărcare, șterge fișierul cheii din `Downloads` și golește coșul.

**iOS:** nu pregătești nimic de mână. La primul build pentru telefon (`--profile device`), EAS îți cere să te autentifici cu contul Apple Developer, să înregistrezi telefonul și întreabă dacă să configureze notificările push: răspunzi **Yes**, iar EAS generează și păstrează cheia APNs.

### 9.6 Build nou și testare

Ai adăugat un modul nativ, deci îți trebuie build-uri noi.

1. Simulator / emulator:

   ```sh
   eas build --platform all --profile development
   ```
2. Telefon real (opțional acum, obligatoriu înainte de lansare):

   ```sh
   eas build --platform all --profile device
   ```

   **Vezi:** pentru iOS, pașii de autentificare Apple și de înregistrare a telefonului (dacă nu îi propune singur, rulează întâi `eas device:create` și deschide pe iPhone linkul primit); la final, un cod QR / link de instalare pentru fiecare platformă. Pe iPhone trebuie activat **Developer Mode** (**Settings → Privacy & Security → Developer Mode**) ca aplicația să pornească.
3. Pornește `npx expo start`, deschide aplicația, autentifică-te și apasă butonul de la 9.4, pasul 7. **Vezi:** fereastra sistemului care cere permisiunea. Apasă **Allow / Permite**.
4. Verifică salvarea tokenului (cu `<<TOKEN>>` obținut ca la 4.6, pasul 7, pentru **același** cont):

   ```sh
   curl -s "https://viitorul-cluj.vercel.app/api/mobile/rest/push_tokens?select=token,platform" -H "Authorization: Bearer <<TOKEN>>"
   ```

   **Vezi:** un rând de forma `[{"token":"ExponentPushToken[…]","platform":"ios"}]`.
5. Test direct: deschide `https://expo.dev/notifications`, lipește valoarea `ExponentPushToken[…]`, scrie un titlu și apasă **Send**. **Vezi:** notificarea pe dispozitiv. Dacă nu apare: pe Android, verifică pașii din 9.5; pe iOS, verifică în **Settings → Notifications** că aplicația are permisiune.
6. Test cap-coadă: în aplicația web, cu un cont de preparator din clubul demo, salvează un plan pentru jucătorul demo, pentru mâine. **Vezi:** pe telefon, „Plan nou — Ai un plan nou. Deschide aplicația ca să-l vezi.” Atinge notificarea: se deschide ecranul „Azi”.
7. Sarcina programată, de mână:

   ```sh
   curl -s https://viitorul-cluj.vercel.app/api/cron -H "Authorization: Bearer <<CRON_SECRET>>"
   ```

   **Vezi:** `{"reminders":0,"push":{"claimed":0,"sent":0,"failed":0}}` (cifrele diferă). Fără antet sau cu o valoare greșită: `Acces interzis`.

## 10. Offline pentru chestionar și plan

Vestiarele și terenurile au des semnal slab. Două lucruri trebuie să meargă fără rețea: **să vezi planul de azi** și **să completezi** chestionarul și bifele; trimiterea se face singură când revine semnalul.

### 10.1 Abordarea

Standardul obișnuit în React Native pentru date de pe server este **TanStack Query v5**, cu `onlineManager` legat de starea rețelei și cu persistarea cache-ului (`PersistQueryClientProvider`). Este o alegere bună când aplicația are multe ecrane cu date.

**[recomandare]** Pentru Etapa 1, ghidul folosește ceva mai mic și scris de mână: un **cache de citire** de 30 de rânduri și o **coadă de scrieri** de 140. Motivul: sunt doar două ecrane și trei feluri de scrieri, iar regulile de retrimitere (ce înseamnă „dublură”, ce se întâmplă când a trecut ziua) sunt reguli ale acestui domeniu, nu ale unei biblioteci. Dacă în Etapa 2 apar multe ecrane de citire, cache-ul se poate înlocui cu TanStack Query fără să atingi coada.

### 10.2 Ce se salvează pe telefon

| Ce | Unde | Cheie | Cât timp |
|---|---|---|---|
| Tokenul de sesiune | SecureStore | `sesiune` | până la ieșirea din cont |
| Profilul și clubul (`AppContext`) | AsyncStorage | `ctx` | până la ieșirea din cont |
| Planul și programele zilei (`PlayerDay`) pentru azi și mâine | AsyncStorage | `cache:zi:<jucător>:<dată>` | 3 zile, apoi `pruneDays` le șterge |
| Chestionarul de azi, dacă a fost deja trimis | AsyncStorage | `cache:chestionar:<jucător>:<dată>` | 3 zile |
| Scrierile netrimise | AsyncStorage | `outbox:queue` | până sunt trimise |
| Scrierile refuzate de server | AsyncStorage | `outbox:dropped` | până le vede jucătorul |
| Clipurile descărcate | folderul de cache al aplicației | `clipuri/…` | până la ieșirea din cont sau până sistemul are nevoie de spațiu |

Pe iOS, AsyncStorage își exclude singur datele din backupul iCloud; pe Android, backupul este oprit din `app.json` (`allowBackup: false`, pasul 8.3).

Creează `<<REPO>>/apps/mobile/src/lib/cache.ts`:

```ts
import { getJson, removeKeys, setJson } from "./storage";

export type Cached<T> = { data: T; savedAt: string; fromCache: boolean };

/**
 * Încearcă serverul; dacă reușește, păstrează rezultatul pe telefon. Dacă nu (fără semnal),
 * întoarce ultima copie păstrată. Aruncă eroarea doar când nu există nici copie locală.
 */
export async function cached<T>(key: string, load: () => Promise<T>): Promise<Cached<T>> {
  try {
    const data = await load();
    const savedAt = new Date().toISOString();
    await setJson(`cache:${key}`, { data, savedAt });
    return { data, savedAt, fromCache: false };
  } catch (e) {
    const stored = await getJson<{ data: T; savedAt: string }>(`cache:${key}`);
    if (stored) return { ...stored, fromCache: true };
    throw e;
  }
}

/** Șterge copiile zilelor mai vechi de `minDate` (chei de forma `zi:<jucător>:<AAAA-LL-ZZ>`). */
export async function pruneDays(minDate: string): Promise<void> {
  await removeKeys("cache:", (key) => {
    const date = /(\d{4}-\d{2}-\d{2})$/.exec(key)?.[1];
    return !date || date >= minDate;
  });
}
```

Creează `<<REPO>>/apps/mobile/src/lib/outbox.ts`:

```ts
import { AppState } from "react-native";
import * as Network from "expo-network";
import {
  DataError, friendlyError, setCompletion, submitRpe, submitWellness,
  type CompletionInput, type DayItem, type PlayerDay, type WellnessInput,
} from "@club/shared";
import { lastTransientFailureAt } from "./api";
import { db } from "./db";
import { getJson, setJson } from "./storage";

/** Referința unui exercițiu din ziua jucătorului (aceleași trei câmpuri ca în `DayItem`). */
export type ItemRef = Pick<DayItem, "plan_item_id" | "assignment_id" | "program_exercise_id">;

export type OutboxItem = { key: string; createdAt: string; playerId: string; date: string } & (
  | { kind: "wellness"; input: WellnessInput }
  | { kind: "completion"; ref: ItemRef; input: CompletionInput }
  | { kind: "rpe"; sessionType: "training" | "match"; rpe: number; durationMin: number }
);
type NewItem = OutboxItem extends infer T ? (T extends OutboxItem ? Omit<T, "key" | "createdAt"> : never) : never;

export type Dropped = { item: OutboxItem; reason: string };

const QUEUE_KEY = "outbox:queue";
const DROPPED_KEY = "outbox:dropped";
const listeners = new Set<() => void>();
let flushing: Promise<void> | null = null;

/**
 * Cheia spune „despre ce” este scrierea. O scriere nouă cu aceeași cheie o înlocuiește pe cea veche,
 * deci în coadă nu stau niciodată două chestionare pentru aceeași zi sau două bife pe același exercițiu.
 */
function keyOf(item: NewItem): string {
  if (item.kind === "wellness") return `wellness:${item.playerId}:${item.date}`;
  if (item.kind === "rpe") return `rpe:${item.playerId}:${item.date}:${item.sessionType}`;
  const r = item.ref;
  return r.plan_item_id
    ? `completion:${item.playerId}:plan:${r.plan_item_id}`
    : `completion:${item.playerId}:${item.date}:${r.assignment_id}:${r.program_exercise_id}`;
}

export const pending = async () => (await getJson<OutboxItem[]>(QUEUE_KEY)) ?? [];
export const dropped = async () => (await getJson<Dropped[]>(DROPPED_KEY)) ?? [];
export const clearDropped = async () => { await setJson(DROPPED_KEY, []); notify(); };

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const notify = () => listeners.forEach((l) => l());

async function send(item: OutboxItem): Promise<void> {
  if (item.kind === "wellness") return submitWellness(db, item.playerId, item.date, item.input);
  if (item.kind === "rpe") return submitRpe(db, item.playerId, item.date, item.sessionType, item.rpe, item.durationMin);

  // Bifă: citim întâi rândul existent de pe server, ca retrimiterea să fie o actualizare, nu o dublură.
  for (let attempt = 0; ; attempt++) {
    let q = db.from("exercise_completions").select("id, done, comment, pain, pain_intensity").eq("player_id", item.playerId);
    q = item.ref.plan_item_id
      ? q.eq("plan_item_id", item.ref.plan_item_id)
      : q.eq("done_on", item.date).eq("assignment_id", item.ref.assignment_id!).eq("program_exercise_id", item.ref.program_exercise_id!);
    const { data: existing, error } = await q.maybeSingle();
    if (error) throw new DataError(friendlyError(error), error.code);
    try {
      return await setCompletion(db, item.playerId, item.date, { ...item.ref, completion: existing }, item.input);
    } catch (e) {
      // 23505 = indexul unic a prins o dublură (altă trimitere a ajuns între timp): mai încercăm o dată, ca actualizare
      if (e instanceof DataError && e.code === "23505" && attempt === 0) continue;
      throw e;
    }
  }
}

/** Trimite ce este în coadă, în ordine. Se oprește la prima eroare trecătoare; refuzurile definitive se scot din coadă. */
export function flush(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (const item of await pending()) {
        const startedAt = Date.now();
        try {
          await send(item);
        } catch (e) {
          // serverul nu a răspuns (fără semnal, timeout, 5xx, sesiune expirată): lăsăm totul în coadă și reîncercăm mai târziu
          if (lastTransientFailureAt() >= startedAt) return;
          // serverul a răspuns și a refuzat (de exemplu ziua a trecut): nu are rost să retrimitem
          const reason = e instanceof Error ? e.message : "Serverul a refuzat salvarea.";
          await setJson(DROPPED_KEY, [...(await dropped()), { item, reason }]);
        }
        // scoatem din coadă doar dacă între timp nu a fost înlocuit de o scriere mai nouă
        await setJson(QUEUE_KEY, (await pending()).filter((x) => !(x.key === item.key && x.createdAt === item.createdAt)));
        notify();
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Salvează o scriere: o pune în coadă (pe telefon) și încearcă imediat să o trimită.
 *  - „sent”: a ajuns pe server;
 *  - „queued”: a rămas pe telefon și pleacă singură când revine semnalul;
 *  - „rejected”: serverul a refuzat-o (motivul este în lista `dropped()`).
 */
export async function save(item: NewItem): Promise<"sent" | "queued" | "rejected"> {
  const entry = { ...item, key: keyOf(item), createdAt: new Date().toISOString() } as OutboxItem;
  await setJson(QUEUE_KEY, [...(await pending()).filter((x) => x.key !== entry.key), entry]);
  notify();
  await flush();
  const same = (x: OutboxItem) => x.key === entry.key && x.createdAt === entry.createdAt;
  if ((await pending()).some(same)) return "queued";
  return (await dropped()).some((d) => same(d.item)) ? "rejected" : "sent";
}

/** Pornește retrimiterea automată: la deschiderea aplicației, la revenirea în prim-plan și la revenirea conexiunii. */
export function startOutbox(): () => void {
  void flush();
  const app = AppState.addEventListener("change", (s) => { if (s === "active") void flush(); });
  const net = Network.addNetworkStateListener((s) => { if (s.isConnected && s.isInternetReachable !== false) void flush(); });
  return () => { app.remove(); net.remove(); };
}

/** Aplică peste ziua venită de pe server (sau din copia locală) bifele încă netrimise, ca ecranul să arate ce a făcut jucătorul. */
export function applyPending(day: PlayerDay, queue: OutboxItem[]): PlayerDay {
  const patch = (item: DayItem): DayItem => {
    const q = queue.find(
      (x) => x.kind === "completion" && x.date === day.date && x.ref.plan_item_id === item.plan_item_id &&
        x.ref.assignment_id === item.assignment_id && x.ref.program_exercise_id === item.program_exercise_id,
    );
    if (!q || q.kind !== "completion") return item;
    return {
      ...item,
      completion: {
        id: item.completion?.id ?? "local", done: q.input.done, comment: q.input.comment ?? null,
        pain: !!q.input.pain, pain_intensity: q.input.pain_intensity ?? null,
      },
    };
  };
  const plan = day.plan ? { ...day.plan, items: day.plan.items.map(patch) } : null;
  const programs = day.programs.map((p) => ({ ...p, items: p.items.map(patch) }));
  const all = [...(plan?.items ?? []), ...programs.flatMap((p) => p.items)];
  return { ...day, plan, programs, done: all.filter((i) => i.completion?.done).length };
}
```

### 10.3 Folosirea în ecrane

În `azi.tsx`, încărcarea și bifarea devin (înlocuiesc apelurile directe la `getPlayerDay` și `setCompletion`):

```ts
import { cached } from "../../lib/cache";
import { applyPending, pending, save } from "../../lib/outbox";

// în load():
const today = todayIn(ctx.settings.timezone);
const res = await cached(`zi:${player.id}:${today}`, () => getPlayerDay(db, player.id, today));
setDay(applyPending(res.data, await pending()));   // bifele netrimise se văd ca făcute
setFromCache(res.fromCache);                       // pentru bannerul „date de la ora …”

// în toggle(item):
const result = await save({
  kind: "completion",
  playerId: player.id,
  date: day.date,
  ref: { plan_item_id: item.plan_item_id, assignment_id: item.assignment_id, program_exercise_id: item.program_exercise_id },
  input: {
    done: !item.completion?.done,
    comment: item.completion?.comment ?? null,
    pain: item.completion?.pain ?? false,
    pain_intensity: item.completion?.pain_intensity ?? null,
  },
});
setNotice(result === "queued" ? "Salvat pe telefon. Se trimite singur când ai semnal." : null);
await load();
```

În `chestionar.tsx`, trimiterea este `await save({ kind: "wellness", playerId, date: todayIn(ctx.settings.timezone), input })`, cu același `input` (`WellnessInput`) ca pe web. La deschiderea aplicației cu semnal, descarcă din timp și ziua de mâine: `cached("zi:<jucător>:<mâine>", …)`.

### 10.4 Cum se evită dublurile

| Scriere | Ce o face unică în baza de date | Ce face coada |
|---|---|---|
| Chestionar | cheia unică `(player_id, entry_date)`; `submitWellness` face `upsert` pe ea | Trimis de două ori, al doilea apel actualizează același rând. În coadă există cel mult un chestionar pe zi (o completare nouă o înlocuiește pe cea veche). |
| Bifă pe un exercițiu din plan | indexul unic `exercise_completions_plan_uq (player_id, plan_item_id)` | Înainte de trimitere citește rândul existent de pe server; dacă există, face actualizare, nu inserare. Dacă două trimiteri se întâlnesc, indexul unic refuză a doua (eroarea `23505`), iar coada reîncearcă o dată, ca actualizare. |
| Bifă pe un exercițiu de program | indexul unic `exercise_completions_program_uq (player_id, done_on, assignment_id, program_exercise_id)` | La fel. |
| RPE | cheia unică `(player_id, entry_date, session_type)`; `submitRpe` face `upsert` | La fel ca la chestionar. |

Verificat pe baza de test: o bifă făcută fără semnal, urmată de a doua atingere tot fără semnal, apoi revenirea conexiunii → **un singur rând** în `exercise_completions`, cu ultima valoare.

### 10.5 Ce vede jucătorul

- **Fără semnal, la deschidere:** planul din copia locală și un banner discret: „Fără conexiune. Vezi planul salvat la 08:14.”
- **După o bifă sau un chestionar fără semnal:** „Salvat pe telefon. Se trimite singur când ai semnal.” Bifa rămâne vizibilă. Un contor mic („2 de trimis”) se actualizează prin `subscribe` + `pending()`.
- **La revenirea semnalului:** coada pleacă singură (`startOutbox`: la pornire, la revenirea în prim-plan, la schimbarea stării rețelei). Contorul dispare; nu e nevoie de niciun mesaj.
- **Dacă serverul a refuzat ceva:** la următoarea deschidere, un mesaj clar, compus de aplicație din `dropped()` (felul scrierii și data): „Chestionarul din 6 octombrie nu a mai putut fi trimis.” Jucătorul apasă „Am înțeles” (`clearDropped`). Câmpul `reason` este mesajul tehnic al serverului; păstrează-l pentru diagnostic, nu îl afișa ca atare.

Coada face diferența între „mai încearcă” și „refuzat” fără să ghicească după textul erorii: `authFetch` notează momentul oricărei cereri la care serverul nu a răspuns cum trebuie (fără semnal, timeout, 5xx, 429, 401). Dacă trimiterea a eșuat și un astfel de moment s-a produs în timpul ei, scrierea rămâne în coadă; altfel, serverul a răspuns și a spus „nu”, deci scrierea se scoate și se arată jucătorului.

### 10.6 Limite și o schimbare mică de backend

**Regula actuală.** Politica `wellness_insert` din `db/migrations/20261007000200_rls.sql` lasă jucătorul să insereze chestionarul doar dacă `entry_date = private.club_today()` — **doar pentru ziua curentă**, în fusul clubului. Celelalte două scrieri sunt deja mai îngăduitoare: bifele se acceptă pentru ultimele 3 zile (`done_on between club_today() - 2 and club_today()`), RPE-ul pentru azi și ieri.

**Ce se întâmplă acum dacă jucătorul completează chestionarul fără semnal și prinde rețea abia a doua zi:** serverul îl refuză. Verificat pe baza de test: răspunsul este „Nu ai dreptul să faci această operațiune.”, iar coada îl mută în lista de refuzate. Datele zilei se pierd.

**Soluția propusă [recomandare — decizia este a clubului]:** o toleranță de o zi, doar la inserare. O migrare nouă, `<<REPO>>/db/migrations/20261007190100_wellness_offline.sql`:

```sql
-- Chestionar completat fără semnal: telefonul îl poate trimite și a doua zi (cel mult ziua precedentă).
-- Se schimbă DOAR politica de inserare. Politica de actualizare rămâne „doar azi”, deci un chestionar
-- întârziat poate completa o zi lipsă, dar nu poate rescrie un răspuns deja trimis.
drop policy wellness_insert on public.wellness_entries;
create policy wellness_insert on public.wellness_entries for insert to authenticated
  with check (
    private.can_manage_player(player_id)
    or (private.is_self(player_id)
        and entry_date between (select private.club_today()) - 1 and (select private.club_today())
        and source = 'app' and not needs_review)
  );
```

De ce doar inserarea: politica `wellness_update` rămâne „doar azi”. Verificat pe baza de test, după migrare: chestionarul de ieri este acceptat **dacă pentru ieri nu exista niciunul**; unul de alaltăieri este refuzat; o a doua trimitere pentru ieri (care ar rescrie răspunsul) este refuzată. Deci un chestionar întârziat poate completa o zi lipsă, dar nu poate „corecta” trecutul. Întârzierea rămâne vizibilă pentru preparator: `created_at` este în altă zi decât `entry_date`.

Dacă clubul nu vrea toleranța (de exemplu fiindcă chestionarul se citește dimineața, înainte de antrenament), nu aplica migrarea; atunci aplicația trebuie să spună cinstit, la revenirea semnalului: „Chestionarul de ieri nu a mai putut fi trimis.”

**Alte limite:**

- **Ceasul telefonului.** Data chestionarului se calculează pe telefon (`todayIn` cu fusul clubului). Un telefon cu data greșită produce o dată pe care serverul o refuză. Serverul are ultimul cuvânt.
- **Sesiune expirată cu scrieri în coadă.** La un răspuns 401, aplicația șterge tot ce ține de cont, inclusiv coada (pe un telefon care poate ajunge la altcineva, datele unui cont fără sesiune nu trebuie să rămână). Sesiunea se prelungește la fiecare folosire și ține 30 de zile, deci se întâmplă doar după o lună fără semnal sau după dezactivarea contului.
- **Planul se poate schimba cât ești offline.** Dacă preparatorul șterge un exercițiu pe care jucătorul l-a bifat fără semnal, bifa este refuzată la trimitere (cheia străină nu mai există) și apare în lista de refuzate.
- **Clipurile** nu sunt disponibile offline decât dacă au fost descărcate dinainte (secțiunea 11.4). Cele de pe YouTube / Vimeo nu se pot descărca.

## 11. Redare video

`ExerciseCard` (din `getPlayerDay`) are două câmpuri: `video_path` — un clip încărcat de club în depozitul privat — și `video_url` — un link extern. Regula este aceeași ca în `apps/web/src/components/ui/video.tsx`: dacă există clip încărcat, acela se redă; altfel linkul, interpretat cu `parseVideoUrl` din `@club/shared`.

**Starea bibliotecilor [cerință]:** `expo-av` a fost **scos** din Expo începând cu SDK 55. Pentru video se folosește `expo-video` (`useVideoPlayer` + `VideoView`).

Instalare (din `<<REPO>>/apps/mobile`), urmată de un build nou de dezvoltare:

```sh
npx expo install expo-video expo-file-system react-native-webview
```

și în `app.json`: `"plugins": ["expo-router", "expo-secure-store", "expo-notifications", "expo-video"]`.

### 11.1 Clipurile încărcate de club

Pe web, browserul cere `/api/files/exercise-media/<cale>` cu cookie-ul de sesiune; ruta verifică dreptul de citire și răspunde cu o **redirecționare** către o adresă semnată a depozitului, valabilă 5 minute. Un player video nativ nu poate fi lăsat să facă singur drumul acesta: ar trebui să trimită antetul `Authorization`, iar după redirecționare antetul ar ajunge (sau nu, în funcție de platformă) la alt server.

De aceea aplicația face drumul în doi pași, folosind modificarea M3 din 4.4:

1. `authFetch("…/api/files/exercise-media/<cale>?json=1")` → serverul verifică sesiunea și dreptul și răspunde `{ "url": "<adresă semnată>", "expiresIn": 300 }`;
2. adresa semnată se dă playerului, fără niciun antet.

Creează `<<REPO>>/apps/mobile/src/lib/video.ts`:

```ts
import { Directory, File, Paths } from "expo-file-system";
import type { VideoSource } from "expo-video";
import { parseVideoUrl, type ExerciseCard } from "@club/shared";
import { API_URL } from "./config";
import { authFetch } from "./api";
import { currentSession } from "./session";

export type ResolvedVideo =
  | { kind: "file"; source: VideoSource; /** după acest moment adresa semnată nu mai e valabilă */ expiresAt: number | null }
  | { kind: "embed"; embedUrl: string }
  | { kind: "link"; url: string }
  | null;

const fileApiUrl = (videoPath: string) =>
  `${API_URL}/api/files/exercise-media/${videoPath.split("/").map(encodeURIComponent).join("/")}`;

const localFile = (videoPath: string) => new File(new Directory(Paths.cache, "clipuri"), videoPath.replace(/[^A-Za-z0-9._-]/g, "_"));

/** Adresa semnată (valabilă 5 minute) a unui clip încărcat de club. Null dacă serverul nu folosește adrese semnate. */
async function signedUrl(videoPath: string): Promise<string | null> {
  const res = await authFetch(`${fileApiUrl(videoPath)}?json=1`);
  if (!res.ok) throw new Error("Clipul nu este disponibil.");
  return ((await res.json()) as { url: string | null }).url;
}

/** Hotărăște de unde se redă clipul unui exercițiu: copie locală, clip încărcat de club, YouTube / Vimeo sau link. */
export async function resolveVideo(ex: Pick<ExerciseCard, "video_path" | "video_url">): Promise<ResolvedVideo> {
  if (ex.video_path) {
    const local = localFile(ex.video_path);
    if (local.exists) return { kind: "file", source: { uri: local.uri }, expiresAt: null };
    const url = await signedUrl(ex.video_path);
    if (url) return { kind: "file", source: { uri: url }, expiresAt: Date.now() + 4 * 60_000 };
    // dezvoltare locală (fără depozit de fișiere în cloud): serverul trimite fișierul direct, cu tokenul în antet
    const token = currentSession()?.token;
    return { kind: "file", source: { uri: fileApiUrl(ex.video_path), headers: token ? { Authorization: `Bearer ${token}` } : undefined }, expiresAt: null };
  }
  const v = parseVideoUrl(ex.video_url);
  if (!v) return null;
  if (v.kind === "youtube" || v.kind === "vimeo") return { kind: "embed", embedUrl: v.embedUrl };
  if (v.kind === "file") return { kind: "file", source: { uri: v.url }, expiresAt: null };
  return { kind: "link", url: v.url };
}

/** Descarcă un clip al clubului pe telefon, ca să poată fi redat fără semnal. Nu face nimic dacă există deja. */
export async function downloadVideo(videoPath: string): Promise<void> {
  const target = localFile(videoPath);
  if (target.exists) return;
  const url = await signedUrl(videoPath);
  if (!url) return;
  new Directory(Paths.cache, "clipuri").create({ intermediates: true, idempotent: true });
  await File.downloadFileAsync(url, target, { idempotent: true });
}

/** La ieșirea din cont se șterg și clipurile descărcate. */
export function clearVideos(): void {
  const dir = new Directory(Paths.cache, "clipuri");
  if (dir.exists) dir.delete();
}
```

Creează `<<REPO>>/apps/mobile/src/components/ExerciseVideo.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { WebView } from "react-native-webview";
import type { ExerciseCard } from "@club/shared";
import { resolveVideo, type ResolvedVideo } from "../lib/video";

/** YouTube refuză redarea (eroarea 153) dacă cererea nu are un „Referer”; folosim identificatorul aplicației. */
const REFERER = `https://${Constants.expoConfig?.ios?.bundleIdentifier ?? Constants.expoConfig?.android?.package ?? "app"}`;

function FilePlayer({ source, onExpired }: { source: VideoSource; onExpired: () => void }) {
  const player = useVideoPlayer(source);
  // adresa semnată a expirat în timpul redării (pauză lungă, derulare după 5 minute): cerem una nouă
  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "error") onExpired();
  });
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />;
}

export function ExerciseVideo({ exercise }: { exercise: Pick<ExerciseCard, "name" | "video_path" | "video_url"> }) {
  const [video, setVideo] = useState<ResolvedVideo | "loading" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    resolveVideo(exercise).then((v) => active && setVideo(v), () => active && setVideo("error"));
    return () => { active = false; };
  }, [exercise.video_path, exercise.video_url, attempt]);

  if (video === "loading") return <View style={styles.media} />;
  if (video === "error" || video === null) {
    return <View style={[styles.media, styles.center]}><Text style={styles.note}>Clip indisponibil. Urmează pașii descriși.</Text></View>;
  }
  if (video.kind === "file") {
    // `key` recreează playerul când primim o adresă nouă; cel mult două reîncercări, ca să nu intrăm în buclă
    return <FilePlayer key={attempt} source={video.source} onExpired={() => (attempt < 2 ? setAttempt(attempt + 1) : setVideo("error"))} />;
  }
  if (video.kind === "embed") {
    return (
      <WebView
        style={styles.media}
        source={{ uri: video.embedUrl, headers: { Referer: REFERER } }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        accessibilityLabel={`Clip: ${exercise.name}`}
      />
    );
  }
  return (
    <Pressable style={[styles.media, styles.center]} onPress={() => Linking.openURL(video.url)} accessibilityRole="link">
      <Text style={styles.linkText}>Deschide clipul</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  media: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#111" },
  center: { alignItems: "center", justifyContent: "center", padding: 16 },
  note: { color: "#fff", fontSize: 15, textAlign: "center" },
  linkText: { color: "#fff", fontSize: 17, fontWeight: "700", textDecorationLine: "underline" },
});
```

**Reîmprospătarea adresei.** Adresa semnată este cerută abia când se deschide ecranul exercițiului, nu când se încarcă lista. Dacă jucătorul pune pauză mai mult de 5 minute și apoi derulează, playerul primește o eroare de la depozit; componenta cere o adresă nouă și repornește clipul (de cel mult două ori). Dacă în practică 5 minute se dovedesc prea puține pentru clipuri lungi, durata se mărește dintr-un singur loc: al treilea parametru al `presignedReadUrl` din ruta de fișiere. **[recomandare]** Rămâi la 5 minute până apare o problemă reală.

### 11.2 YouTube și Vimeo

`parseVideoUrl` întoarce deja adresa de încorporare (`embedUrl`, pe `youtube-nocookie.com`, respectiv `player.vimeo.com`). În nativ, ea se încarcă într-un `WebView` (`react-native-webview`), ca în componenta de mai sus.

De reținut: YouTube refuză redarea într-un WebView (eroarea 153) dacă cererea nu are antetul `Referer`. Componenta îl trimite, construit din identificatorul aplicației. *Soluția este documentată de comunitate, nu de Google: testeaz-o pe ambele platforme, pe un telefon real, cu un clip din biblioteca clubului.* Alternativa, dacă nu merge: pachetul `react-native-youtube-iframe` (ultima versiune publicată: 2.4.1, din iulie 2025) sau deschiderea linkului în aplicația YouTube cu `Linking.openURL`.

### 11.3 Linkuri către fișiere video și alte linkuri

Un `video_url` care se termină în `.mp4`, `.webm`, `.mov` se redă direct cu `expo-video`. Orice alt link apare ca buton „Deschide clipul” și se deschide în browser.

### 11.4 Descărcare dinainte și consum de date

- **Nimic nu pornește singur.** Clipul se încarcă doar când jucătorul deschide exercițiul și apasă redarea (`mediaPlaybackRequiresUserAction` pe WebView; playerul nativ nu are `play()` automat).
- **Descărcare pentru offline [recomandare]:** un buton „Descarcă clipurile de azi” pe ecranul „Azi”, care cheamă `downloadVideo(video_path)` pentru fiecare exercițiu cu clip încărcat. Fișierele ajung în folderul de cache al aplicației; `resolveVideo` le preferă dacă există. Descărcarea automată se face **doar pe Wi-Fi**: `expo-network` → `getNetworkStateAsync()` → `type === Network.NetworkStateType.WIFI`. Pe date mobile, doar la apăsarea butonului, cu mărimea totală afișată.
- **De ce nu `useCaching` din `expo-video`:** cache-ul playerului este legat de adresă, iar adresa semnată se schimbă la fiecare cerere, deci nu s-ar potrivi niciodată. Descărcarea într-un fișier cu nume stabil (derivat din `video_path`) rezolvă problema.
- **Curățenie:** la ieșirea din cont se cheamă `clearVideos()`. Sistemul poate șterge oricând folderul de cache dacă telefonul rămâne fără spațiu; aplicația descarcă din nou la nevoie.
- **Mărimea clipurilor** se controlează la sursă: depozitul acceptă până la 100 MB pe clip (`BUCKETS` din `apps/web/src/lib/files.ts`). **[recomandare]** Cere preparatorului clipuri scurte (15–30 de secunde, 720p); un clip de 5–10 MB se descarcă repede și pe date mobile.

## 12. Securitate și confidențialitate pe dispozitiv

| Subiect | Ce se face | Stare |
|---|---|---|
| **Tokenul de sesiune** | Doar în `expo-secure-store` (Keychain pe iOS, Keystore pe Android), cu `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: nu se mută pe alt dispozitiv prin backup. Niciodată în AsyncStorage, în jurnale sau în mesaje de eroare. | în codul din 8.5 |
| **Reinstalare pe iOS** | Keychain-ul supraviețuiește dezinstalării. La prima pornire după instalare (un indicator `instalat` care lipsește din AsyncStorage), șterge sesiunea din SecureStore, ca un telefon dat mai departe să nu redeschidă contul vechi. | de adăugat **[recomandare]** |
| **Date medicale păstrate local** | Doar ce îi trebuie jucătorului offline: planul pe 2 zile, chestionarul propriu, coada. Nicio fișă medicală, niciun document. Fără backup în cloud (iOS: implicit la AsyncStorage; Android: `allowBackup: false`). | în cod |
| **Notificări** | Text generic, pe tip de notificare (`PUSH_TEXT` din `apps/web/src/lib/push.ts`). În `data` pleacă doar calea de deschis și identificatorul notificării. | în cod |
| **Ieșirea din cont** | Șterge tokenul de push de pe server, închide sesiunea pe server, șterge SecureStore, **tot** AsyncStorage și clipurile descărcate. În `signOut`, adaugă `clearVideos()` (din `src/lib/video.ts`) lângă `wipe()`. | parțial în cod |
| **Sesiune expirată sau cont dezactivat** | Orice răspuns 401 la o cerere cu token declanșează aceeași ștergere locală. | în cod |
| **Blocare cu biometrie** (opțional) | `expo-local-authentication`: la revenirea în prim-plan după mai mult de 5 minute, cere Face ID / amprentă (`authenticateAsync`). Necesită în `app.json` pluginul `expo-local-authentication` cu textul pentru Face ID. Oferă-l ca opțiune în Profil, oprit implicit: mulți jucători sunt minori cu telefoane fără biometrie configurată. | Etapa 1, opțional |
| **Comutatorul de aplicații** (opțional) | `expo-screen-capture`: `enableAppSwitcherProtectionAsync()` acoperă conținutul cu un strat neclar când aplicația nu este în prim-plan (**doar iOS**). `usePreventScreenCapture()` blochează capturile de ecran pe ambele platforme; folosește-l, dacă vrei, doar pe ecranul chestionarului. | opțional |
| **Telefon pierdut** | Preparatorul dezactivează contul din Administrare (`setUserDisabled` șterge toate sesiunile) sau jucătorul își schimbă parola pe web (închide celelalte sesiuni). La următoarea cerere, aplicația de pe telefonul pierdut primește 401 și își șterge datele. | există pe web |
| **Analitice și SDK-uri terțe** | Niciunul. Fără reclame, fără urmărire, fără analitice de la terți. Este și condiția cea mai simplă pentru regulile privind minorii (secțiunea 13.5). Dacă vrei rapoarte de erori, alege un serviciu care nu colectează identificatori de dispozitiv și declară-l în formularele magazinelor. | **[recomandare]** |
| **Jurnale** | Nu scrie în `console.log` răspunsuri de la server sau conținutul chestionarului; în build-urile de producție, jurnalele pot fi citite de pe un telefon conectat la calculator. | regulă de lucru |

## 13. Build și publicare

### 13.1 Ce pregătești înainte

**Pe web (o singură dată) [cerință]:**

- O pagină **publică** cu politica de confidențialitate, de exemplu `https://viitorul-cluj.vercel.app/confidentialitate`: ce date se colectează, în ce scop, cine le vede, cât se păstrează, cum se retrage acordul și cum se cere ștergerea. Conținutul vine din `GDPR.md`. Ambele magazine cer adresa ei, iar Apple și Google cer și un link către ea **în aplicație** (pune-l în Profil și pe ecranul de autentificare).
- O pagină **publică** despre ștergerea contului, de exemplu `/stergere-cont`: cum se cere (din aplicație: Profil → „Cere ștergerea contului”; sau în scris, la club), ce se șterge, ce se păstrează și de ce, în cât timp. Google cere adresa ei în formularul Data safety.
- Ambele căi trebuie adăugate în `PUBLIC_PATHS` din `apps/web/src/proxy.ts`, altfel vizitatorii neautentificați sunt trimiși la autentificare, iar recenzenții văd o pagină de login în loc de politică.

**Materiale:**

| Ce | Detalii |
|---|---|
| Pictograma | Un fișier PNG pătrat, 1024 × 1024, fără transparență → `apps/mobile/assets/icon.png`. Pentru Android și fișierele `android-icon-*.png` din același folder. |
| Capturi de ecran | Din simulator (⌘S salvează captura pe Desktop) și din emulator. Cel puțin: Azi, Chestionar (cu harta corpului), un exercițiu cu video. Folosește **doar contul demo**, cu date inventate. Dimensiunile acceptate sunt afișate în formularele de încărcare — *se schimbă des; de verificat acolo.* |
| Texte | Numele aplicației (cel mult 30 de caractere), o descriere scurtă și una lungă în română, adresa de suport (e-mail), adresa politicii de confidențialitate. |
| Descrierea — două propoziții obligatorii | (1) „Aplicația este destinată jucătorilor cluburilor care folosesc platforma. Conturile sunt create de club; nu există înregistrare publică.” (2) „Aplicația nu este un dispozitiv medical și nu diagnostichează, nu tratează, nu vindecă și nu previne nicio afecțiune. Pentru sfaturi medicale, diagnostic sau tratament, adresați-vă unui medic.” **[cerință]** A doua vine din politica Google pentru aplicațiile de sănătate și din regula Apple 1.4.1. |
| Contul demo pentru recenzie | Un cont de **jucător adult** din clubul demonstrativ, cu parolă care nu expiră, acordul deja dat, un plan pe ziua curentă și un exercițiu cu clip. Verifică-l în dimineața trimiterii. **[cerință]** Apple 2.1: aplicațiile cu autentificare trebuie trimise cu date de cont demo și cu serverul pornit. Google: „App access”. |
| Nota pentru recenzent (în engleză) | Vezi textul de la 13.2, pasul 9. |

**Fără sume de bani în aplicație.** Aplicația este gratuită, iar platforma se vinde cluburilor în afara magazinelor. Nu pune în aplicație prețuri, abonamente sau linkuri de plată.

### 13.2 iOS — pas cu pas

1. Verifică în `<<REPO>>/apps/mobile/app.json` că `ios.bundleIdentifier` este `<<IDENTIFICATOR>>` final și că `version` este `1.0.0`.
2. Rulează:

   ```sh
   cd <<REPO>>/apps/mobile
   ```
3. Rulează:

   ```sh
   eas build --platform ios --profile production
   ```

   **Vezi:** la prima rulare, EAS cere autentificarea cu contul Apple Developer (cu cod de verificare pe telefon), alegerea echipei (alegi **organizația**) și întreabă dacă să genereze certificatul de distribuție și profilul de aprovizionare: răspunzi **Yes** la toate. Apoi un link de build; 15–30 de minute. La final: un link către fișierul `.ipa`.
4. Deschide `https://appstoreconnect.apple.com` → **Apps** → **+** → **New App**. Completează: platformă **iOS**, numele, limba principală **Romanian**, **Bundle ID** = `<<IDENTIFICATOR>>` (apare în listă după pasul 3), **SKU** = orice cod intern (de exemplu `vestiar-1`), acces **Full Access**. Apasă **Create**. (Dacă la pasul 5 `eas submit` se oferă să creeze aplicația, poți sări peste pasul acesta.)
5. Rulează:

   ```sh
   eas submit --platform ios
   ```

   **Vezi:** întreabă ce build trimite (alegi ultimul) și, la prima rulare, datele de acces la App Store Connect (lasă-l să genereze o cheie API). La final: un mesaj că trimiterea a reușit. Build-ul apare în **TestFlight** după procesare (de regulă 10–15 minute).
6. Pe iPhone, instalează aplicația **TestFlight** din App Store. În App Store Connect → aplicație → **TestFlight** → **Internal Testing**, adaugă-te ca tester. **Vezi:** un e-mail de invitație; din TestFlight, apeși **Install**. Testează pe telefonul real: autentificare, bifă, chestionar, video, o notificare push, modul avion.
7. În App Store Connect → aplicație → **App Information**: categorie principală **Health & Fitness**, secundară **Sports** **[recomandare]** (categoria Medical atrage o recenzie mai strictă și nu descrie corect aplicația); **Age Rating**: răspunde la chestionar cu ce face efectiv aplicația (inclusiv întrebările despre teme medicale sau de bunăstare, introduse în 2025); nu există conținut generat de utilizatori vizibil altora, nici cumpărături, nici reclame.
8. **App Privacy** → **Get Started**: completezi după tabelul din 13.4. La **Privacy Policy URL** pui adresa paginii publice.
9. **App Review Information**: bifează **Sign-in required**, pune `<<EMAIL_DEMO>>` și `<<PAROLA_DEMO>>`, un telefon și un e-mail de contact, iar la **Notes** lipește (adaptat):

   ```
   This app is a private tool for football clubs that use our platform. Accounts are created
   only by club staff: there is no public sign-up, and nothing can be purchased in or for the app.

   Demo account (player role, demo club, fictional data): see the sign-in fields above.

   What the app does: a player sees the day's exercise plan (with videos), ticks completed
   exercises and fills in a short daily wellness questionnaire (fatigue, muscle load, optional
   pain location on a body map). The club's physical trainer uses these answers for injury
   prevention and rehabilitation. The app is not a medical device and gives no diagnosis.

   Data: health-related answers are stored on our servers in the EU, visible only to the
   player and the club's authorised staff, never shared with third parties and never used for
   advertising. No third-party analytics or advertising SDKs. Consent is collected at first
   sign-in; for players under 18, a parent or guardian gives consent.

   Account deletion: Profile → "Cere ștergerea contului" (Request account deletion).
   Push notifications are optional and contain no health data.
   ```
10. Pe pagina versiunii (**1.0 Prepare for Submission**): încarcă capturile, descrierea, cuvintele-cheie, adresa de suport; la **Build**, alege build-ul din TestFlight; la **Pricing and Availability**, gratuit, disponibil în **România** (și în Republica Moldova, dacă e cazul) **[recomandare]** — nu „toate țările”: alte piețe aduc alte obligații legale pentru datele minorilor.
11. Apasă **Add for Review**, apoi **Submit**. **Vezi:** starea trece în „Waiting for Review”. *Durata recenziei nu e garantată de Apple; de regulă, câteva zile — de verificat la momentul trimiterii.* Răspunsurile vin pe e-mail și în App Store Connect → **App Review**.
12. **Opțional — aplicație nelistată [recomandare, de discutat cu clubul].** Apple permite ca o aplicație pentru un public restrâns să fie publicată, dar găsită doar printr-un link direct („Unlisted App Distribution”). Se cere printr-un formular, după ce aplicația a fost trimisă la recenzie, cu o mențiune în nota pentru recenzent. Avantaj: nu apare în căutări și nu primește recenzii de la oameni care nu se pot autentifica. Oricine are linkul o poate instala, deci autentificarea rămâne singura barieră — exact ca acum.

### 13.3 Android — pas cu pas

1. Verifică în `app.json` că `android.package` este `<<IDENTIFICATOR>>` final.
2. Rulează din `<<REPO>>/apps/mobile`:

   ```sh
   eas build --platform android --profile production
   ```

   **Vezi:** la prima rulare întreabă dacă să genereze un „keystore” (cheia de semnare): **Yes**. EAS o păstrează; nu o pierde nimeni din greșeală. La final: un link către un fișier `.aab`.
3. Deschide `https://play.google.com/console` → **Create app**: numele, limba implicită **Romanian**, **App** (nu joc), **Free**; bifezi declarațiile. Apasă **Create app**.
4. Mergi la **Policy → App content** și completezi fiecare secțiune (răspunsurile sunt în 13.4):
   - **Privacy policy** — adresa paginii publice;
   - **App access** — „All or some functionality is restricted”; adaugi contul demo și, în instrucțiuni, propoziția „Accounts are created by the club; no public sign-up.”;
   - **Ads** — **No**;
   - **Content rating** — chestionarul;
   - **Target audience and content** — vârstele din 13.5;
   - **Data safety** — tabelul din 13.4;
   - **Health apps** — declarația din 13.4.
5. **Testing → Internal testing → Create new release.** Descarcă fișierul `.aab` de la linkul din pasul 2 și trage-l în zona de încărcare. Apasă **Next**, apoi **Save and publish**. **[recomandare]** Prima versiune urc-o de mână: `eas submit --platform android` are nevoie de o cheie de cont de serviciu Google pentru API-ul Play (alta decât cea de la push), iar configurarea ei merită făcută abia după ce prima versiune este în consolă. Pașii sunt în documentația EAS Submit (secțiunea 17).
6. În **Internal testing → Testers**, creează o listă cu adresele de e-mail (conturi Google) ale testerilor și copiază linkul de înscriere. **Vezi:** pe telefonul Android, linkul deschide Google Play, de unde instalezi aplicația.
7. **Testare închisă [recomandare]:** înainte de producție, 1–2 săptămâni cu o grupă reală (**Testing → Closed testing**), ca să vezi notificările și modul offline pe telefoanele jucătorilor. **[cerință doar pentru conturile personale]** Conturile *personale* create după 13 noiembrie 2023 nu pot publica în producție fără un test închis cu cel puțin 12 testeri înscriși continuu cel puțin 14 zile, urmat de o cerere de acces la producție (răspuns de regulă în cel mult 7 zile). Cu un cont de organizație, această condiție nu apare în cerința Google.
8. **Production → Create new release** → alegi versiunea testată → **Countries/regions**: România (și Moldova) → **Send for review**. *Durata recenziei: de verificat în consolă la momentul trimiterii.*

### 13.4 Formularele și răspunsurile corecte pentru această aplicație

Răspunsurile de mai jos descriu aplicația așa cum este construită în acest ghid (fără reclame, fără analitice terțe, fără date de localizare). **Dacă adaugi orice SDK terț, refaci formularele.**

**Apple — App Privacy („etichetele de confidențialitate”).** „Colectat” înseamnă, la Apple, orice dată care pleacă de pe telefon și este păstrată mai mult decât durata cererii.

| Tip de date (denumirea Apple) | Colectat | Legat de identitate | Folosit pentru urmărire | Scop |
|---|---|---|---|---|
| Contact Info → Name, Email Address, Phone Number | Da | Da | Nu | App Functionality |
| Health & Fitness → **Health** (chestionar, durere, stare) | Da | Da | Nu | App Functionality |
| Health & Fitness → **Fitness** (exerciții bifate, RPE) | Da | Da | Nu | App Functionality |
| Identifiers → User ID | Da | Da | Nu | App Functionality |
| Identifiers → Device ID (tokenul de push) | Da | Da | Nu | App Functionality |
| User Content → Other User Content (comentariile la exerciții) | Da | Da | Nu | App Functionality |
| Usage Data → Product Interaction (jurnalul de autentificări) | Da | Da | Nu | App Functionality |
| Location, Contacts, Financial Info, Browsing / Search History, Purchases, Diagnostics, Sensitive Info | Nu | — | — | — |

La întrebarea despre urmărire („tracking”): **Nu**. Aplicația nu leagă datele de date ale altor companii și nu le dă brokerilor de date.

**Apple — manifestul de confidențialitate (privacy manifest). [cerință]** Apple cere declararea motivelor pentru anumite API-uri de sistem. Pachetele Expo care le folosesc își aduc propriul manifest, dar Expo nu completează automat manifestul aplicației. Dacă, după încărcarea unui build, primești de la Apple un e-mail despre un „required reason API” nedeclarat, adaugi în `app.json` blocul `ios.privacyManifests`, după ghidul Expo „Privacy manifests” (secțiunea 17), și faci un build nou.

**Google — Data safety.**

| Întrebare | Răspuns |
|---|---|
| Aplicația colectează sau partajează date de utilizator? | **Da** (colectează) |
| Toate datele sunt criptate în tranzit? | **Da** (numai HTTPS) |
| Oferi o cale prin care utilizatorii pot cere ștergerea datelor? | **Da** — adresa paginii `/stergere-cont` |
| **Personal info:** Name, Email address, User IDs, Phone number, Other info (data nașterii) | Colectat: Da · Partajat: Nu · Obligatoriu · Scop: App functionality, Account management |
| **Health and fitness:** Health info, Fitness info | Colectat: Da · Partajat: Nu · Obligatoriu · Scop: App functionality |
| **App activity:** App interactions (jurnalul de autentificări), Other user-generated content (comentarii) | Colectat: Da · Partajat: Nu · Scop: App functionality |
| **Device or other IDs** (tokenul de push) | Colectat: Da · Partajat: Nu · Scop: App functionality |
| Location, Financial info, Messages, Photos and videos, Audio, Files, Calendar, Contacts, Web browsing | Nu |

De ce „Partajat: Nu”, deși datele trec pe la Vercel, Neon și Expo: la Google, transferul către **furnizori de servicii** care prelucrează datele în numele tău nu se declară ca partajare. Asta presupune că ai cu ei acorduri de prelucrare a datelor (vezi `GDPR.md`).

**Google — Health apps declaration. [cerință]** Toate aplicațiile de pe Google Play completează declarația (**Policy → App content → Health apps**). **[recomandare]** Pentru aplicația din Etapa 1 bifează: la *Health and Fitness* — **Activity and Fitness**; la *Medical* — **Physical Therapy and Rehabilitation** (planurile de recuperare prescrise de preparator). Nu bifa „Medical Device Apps”: aplicația nu măsoară și nu diagnostichează nimic. Dacă în Etapa 2 personalul vede în aplicație stări medicale ale jucătorilor, reevaluează (categoria „Healthcare Services and Management”). *Lista de categorii se schimbă; citește descrierile din formular în ziua completării.*

**Google — politica „Health Content and Services”. [cerință]** Politica de confidențialitate trebuie să existe și în Play Console, și în aplicație; să descrie complet accesul, colectarea, folosirea și partajarea datelor personale și sensibile; aplicația nu cere permisiuni de care nu are nevoie (aici: doar notificări). Descrierea conține propoziția despre dispozitivul medical de la 13.1.

### 13.5 Utilizatori minori

Jucătorii de la U15 în sus au între 13 și 18 ani. Aplicația **nu** este o aplicație pentru copii în sensul magazinelor; este o aplicație de uz general pe care o folosesc și minori, sub acordul unui părinte.

| Platformă | Ce alegi | De ce |
|---|---|---|
| **Apple — Kids Category** | **Nu** intri în Kids Category. Nu folosi în nume, subtitlu sau capturi expresii ca „pentru copii”. | **[cerință]** Kids Category este pentru aplicații făcute anume pentru copii și vine cu reguli proprii (fără linkuri externe fără „parental gate” etc.). Expresiile „For Kids” / „For Children” sunt rezervate acelei categorii. |
| **Apple — regula 5.1.4** | Politică de confidențialitate + respectarea legilor privind datele copiilor (GDPR). Fără analitice și reclame de la terți. | **[cerință]** Se aplică oricărei aplicații care colectează date personale de la minori, nu doar celor din Kids Category. |
| **Google — Target audience and content** | Bifezi **13–15**, **16–17** și **18 and over**. Nu bifa grupele sub 13 ani. | **[cerință]** Grupele sub 13 ani atrag politica „Families” (cu cerințe suplimentare). Pentru 13–15 și 16–17, Google avertizează că în unele țări pot fi considerați copii și că răspunderea respectării legii locale este a ta. |
| **Ambele** | Pictograma și capturile nu trebuie să pară adresate copiilor mici. | Google poate respinge o aplicație al cărei material de prezentare atrage copii, deși publicul declarat este mai mare. |

Ce face deja platforma și trebuie păstrat în nativ: la prima autentificare a unui jucător minor, acordul este dat de **părinte sau tutore** (ecranul de consimțământ, `kind: "guardian_digital"`, cu numele și calitatea lui). Fără acord, aplicația nu afișează și nu colectează nimic.

**Dacă un club cere conturi pentru grupe sub 13 ani:** nu le activa în aplicația nativă înainte de a relua această secțiune. Pe Google intri sub politica „Families”; pe ambele platforme, cerințele legale pentru datele copiilor sunt mai stricte. Aceasta este o decizie juridică, nu tehnică.

### 13.6 Ștergerea contului

- **Apple [cerință], 5.1.1(v):** dacă aplicația permite crearea de conturi, trebuie să permită și **inițierea ștergerii din aplicație**; simpla dezactivare nu e de ajuns. Aici conturile sunt create de club, nu din aplicație, deci litera regulii nu se aplică întocmai — dar recenzenții cer des această funcție la orice aplicație cu autentificare. **[recomandare]** Pune-o din prima versiune.
- **Cum:** Profil → „Cere ștergerea contului” → explicație scurtă (ce se șterge, ce se păstrează anonimizat, în cât timp — cel mult 30 de zile) → confirmare → inserare în `data_requests` cu `kind: "delete"` → mesaj „Cererea a fost trimisă clubului”. Preparatorul o rezolvă din web (funcția `anonymize_player` există deja). Apple acceptă explicit procesele manuale, cu condiția să spui cât durează și să confirmi la final; pentru domeniile reglementate (între care sănătatea) acceptă și pași de confirmare prin personal.
- **Google [cerință]:** cere cale în aplicație **și** link web pentru ștergere atunci când contul se poate crea din aplicație. Nu este cazul aici, dar formularul Data safety întreabă oricum dacă există o cale de ștergere: răspunzi Da și dai adresa paginii `/stergere-cont`.

### 13.7 Motive frecvente de respingere și cum le previi

| Motiv | Cum arată respingerea | Prevenire |
|---|---|---|
| **Recenzentul nu poate intra** (conturi doar prin invitație) | Apple 2.1 „We were unable to sign in”; Google „App access” | Cont demo verificat în ziua trimiterii; parolă simplă de tastat; nota de la 13.2; serverul și baza de date demo pornite. Nu lăsa contul demo cu „trebuie să-ți alegi parola” sau cu acordul nedat. |
| **„Aplicația pare neterminată / nu face nimic”** | Apple 2.1 / 4.2 | Contul demo are plan pe ziua curentă, exerciții cu clip și chestionarul necompletat. Un cont gol arată ca o aplicație goală. Programează un plan demo recurent. |
| **Lipsește ștergerea contului** | Apple 5.1.1(v) | Butonul din Profil + rândul din nota pentru recenzent care spune exact unde este. |
| **Date de sănătate fără explicații** | Apple 5.1.1(i)/(ii), 5.1.3; Google „Health Content and Services” | Politica de confidențialitate publică și legată din aplicație; ecranul de acord la prima intrare; formularele din 13.4 completate la fel ca politica (nepotrivirile dintre ele sunt cel mai des motiv). |
| **Trimisă de pe un cont personal** | Apple 5.1.1(ix); Google: cont de organizație pentru aplicații medicale | Conturi pe persoana juridică (secțiunea 6). |
| **Minori** | Apple 5.1.4, 2.3.8; Google „Target audience” | Fără „pentru copii” în texte; vârstele din 13.5; fără SDK-uri de reclame sau analitice; acordul părintelui în aplicație. |
| **Pretenții medicale** | Apple 1.4.1; Google | Fără „previne accidentările”, „diagnostichează”, „tratează” în descriere. Spune ce face: „jucătorul își vede planul și completează chestionarul”. Propoziția despre dispozitivul medical. |
| **Notificări obligatorii** | Apple 5.1.2(i) | Aplicația merge identic fără permisiunea de notificări. |
| **Formular Data safety / App Privacy nepotrivit cu aplicația** | respingere sau eliminare ulterioară | Refă formularele la fiecare SDK nou; păstrează tabelul din 13.4 la zi. |
| **Linkuri moarte** | Apple 2.1 | Verifică adresa de suport, politica și pagina de ștergere dintr-o fereastră privată de browser (fără sesiune). |

## 14. Actualizări

Există două feluri de actualizări. Diferența: s-a schimbat doar JavaScript-ul sau și partea nativă.

| | **Actualizare OTA (EAS Update)** | **Build nou + magazin** |
|---|---|---|
| Ce poate schimba | cod TypeScript / JavaScript, stiluri, imagini | orice, inclusiv module native, `app.json`, pictograma, permisiunile, versiunea de Expo SDK |
| Cum ajunge la utilizator | aplicația o descarcă la pornire și o aplică la următoarea deschidere | actualizare din App Store / Google Play |
| Recenzia magazinului | nu | da |
| Când o folosești | corecturi de erori, texte, ajustări de ecran | funcții noi care au nevoie de un modul nativ; trecerea la un SDK nou; **orice schimbare de `app.json`** |
| Durată | minute | ore – zile |

**Configurare (o singură dată, înainte de primul build de producție):**

1. Din `<<REPO>>/apps/mobile`:

   ```sh
   npx expo install expo-updates
   ```
2. Rulează:

   ```sh
   eas update:configure
   ```

   **Vezi:** în `app.json` apar `updates.url` și `runtimeVersion`; în `eas.json`, profilurile `preview` și `production` primesc câte un `"channel"`.
3. Fă build-urile de producție **după** acest pas (un build făcut înainte nu știe să primească actualizări).

**Publicarea unei actualizări OTA:**

```sh
eas update --channel production --environment production --message "Corectura la chestionar"
```

**Vezi:** un link către actualizare. Pe un telefon cu aplicația din magazin: închizi complet aplicația și o deschizi de două ori; a doua oară rulează codul nou. (Parametrul `--environment` este obligatoriu de la SDK 55.)

**Reguli de lucru [recomandare]:**

- **Versiuni.** `version` din `app.json` este versiunea văzută de utilizatori (`1.0.0` → `1.0.1` pentru corecturi, `1.1.0` pentru funcții). O mărești la fiecare build trimis în magazine. Numărul de build îl crește EAS singur (`"autoIncrement": true`).
- **`runtimeVersion`** leagă o actualizare OTA de build-urile care o pot primi. Păstrează politica pusă de `eas update:configure` și **mărește `version` de fiecare dată când schimbi ceva nativ**; altfel o actualizare ar putea ajunge la un build căruia îi lipsește modulul nativ și aplicația s-ar închide la pornire.
- **Întâi `preview`, apoi `production`.** Publică actualizarea pe canalul `preview`, verific-o pe un build `preview` instalat pe telefonul tău, apoi public-o pe `production`.
- **Nu schimba prin OTA ce face aplicația.** Magazinele acceptă actualizările OTA pentru corecturi și îmbunătățiri; o funcție nouă importantă trece prin recenzie, cu un build nou. *Formularea exactă din ghidurile Apple nu a fost verificată la scrierea ghidului — de citit înainte de prima actualizare OTA cu funcții noi.*
- **Compatibilitate cu serverul.** Telefoanele rămân săptămâni pe versiuni vechi. Cât timp există versiuni vechi în uz: nu redenumi și nu șterge coloane folosite de `packages/shared/src/queries.ts`, nu schimba forma răspunsurilor din `/api/mobile/*`, adaugă doar. Dacă o schimbare incompatibilă devine inevitabilă, adaugă în `/api/mobile/auth/me` un câmp `minAppVersion` și un ecran „Actualizează aplicația”.
- **`@club/shared` este comun.** O modificare într-o funcție din `queries.ts` ajunge pe web la următorul deploy, dar pe telefoane abia la următoarea actualizare OTA sau la următorul build. Planifică-le împreună.
- **SDK nou.** Expo scoate trei–patru versiuni pe an. Treci la una nouă cu `npx expo install expo@latest`, apoi `npx expo install --fix`, citești nota de lansare, faci build-uri de dezvoltare și testezi. Nu sări mai mult de două versiuni.

## 15. Etape și estimări

Estimările sunt pentru **un om care lucrează cu un asistent AI**, în zile de lucru efective. Aprobările și recenziile sunt timp de așteptare, nu de lucru.

| Etapă | Livrabile | Durată | Depinde de | În paralel cu web-ul? |
|---|---|---|---|---|
| **A. Conturi** | Număr D-U-N-S, cont Apple Developer (organizație), cont Google Play (organizație), organizație Expo, proiect Firebase | 1 zi de lucru + **1–4 săptămâni de așteptare** | firma și documentele ei | Da. **Pornește-o din prima zi.** |
| **0. API-ul pentru mobil** | Rutele din secțiunea 4, migrarea `pushed_at`, testele cu `curl`, `npm run test:rls` | 2–3 zile | web-ul în producție | Atinge 3 fișiere existente din web; de coordonat cu cine lucrează pe `proxy.ts` și `lib/auth.ts`. |
| **1a. Scheletul** | Calculatorul pregătit, `apps/mobile`, autentificare, „Azi” minim, primul build de dezvoltare pe simulator și emulator | 3–4 zile | 0 | Da |
| **1b. Intrarea în cont** | Alegerea parolei, invitația, ecranul de acord (inclusiv părinte / tutore), navigarea cu file, culorile clubului | 4–5 zile | 1a | Da |
| **1c. Azi complet** | Comentariu și durere la exercițiu, RPE, ecranul exercițiului cu video (clipuri încărcate + YouTube / Vimeo) | 5–6 zile | 1a; modificarea M3 | Da |
| **1d. Chestionarul** | Scalele, întrebările suplimentare pe grupă, harta corpului nativă, corectarea în aceeași zi | 4–5 zile | 1a; geometria în `@club/shared` (5.1) | Mutarea geometriei atinge `body-map.tsx` de pe web. |
| **1e. Offline** | Cache-ul, coada, bannerele, lista de refuzate, descărcarea clipurilor; decizia clubului despre toleranța de o zi | 4–6 zile | 1c, 1d | Migrarea `wellness_offline` este o schimbare de backend. |
| **1f. Notificări** | Firebase + APNs, înregistrarea tokenului, trimiterea de pe server, deschiderea ecranului potrivit, ecranul Notificări | 3–4 zile | A (cont Apple pentru telefon real), 0 | Atinge `lib/actions.ts` și `vercel.json`. |
| **1g. Profil și finisaje** | Profil minim, cererea de ștergere, linkul către politică, accesibilitate (text mărit, VoiceOver / TalkBack, contrast), stări de eroare și de gol | 4–5 zile | 1b | Paginile publice `/confidentialitate` și `/stergere-cont` sunt pe web. |
| **1h. Publicare** | Pictogramă, capturi, texte, formulare, TestFlight + testare internă, test închis cu o grupă reală, trimiterea la recenzie | 4–5 zile de lucru + **1–3 săptămâni** (test cu grupa + recenzii) | A, toate cele de mai sus | Da |
| **Total Etapa 1** | Aplicația jucătorului în ambele magazine | **6–8 săptămâni de lucru**; 8–10 calendaristic | | |
| **2a. Calendar și evoluție** | `/plan` cu `getPlayerCalendar`, graficele proprii | 6–8 zile | Etapa 1 | Da |
| **2b. Antrenor: disponibilitate** | Tabloul de disponibilitate, doar citire; reevaluarea formularelor din 13.4 | 5–7 zile | Etapa 1 | Da |
| **2c. Publicare Etapa 2** | Build nou, formulare actualizate, recenzie | 2–3 zile + recenzie | 2a, 2b | Da |

**Ordinea de lucru:** A (pornită imediat) → 0 → 1a → 1b → 1c → 1d → 1e → 1f → 1g → 1h. Etapele 1c și 1d se pot inversa. 1f se poate muta înainte de 1e dacă contul Apple este gata devreme.

**Ce poate întârzia cel mai mult:** D-U-N-S și verificarea organizației (A); o respingere la prima recenzie (o săptămână în plus, de regulă pentru contul demo sau pentru formulare); redarea YouTube în WebView, dacă soluția cu `Referer` nu ține pe una dintre platforme (11.2).

## 16. Listă de verificare înainte de publicare

**Server**

- [ ] Rutele `/api/mobile/*` sunt în producție; testele din 4.6 trec.
- [ ] `npm run test:rls` trece.
- [ ] Migrarea `pushed_at` este aplicată; `CRON_SECRET` este setat; sarcina programată rulează (Vercel → proiect → **Cron Jobs**).
- [ ] Proiectul Vercel este pe un plan care permite frecvența din `vercel.json` și uzul comercial.
- [ ] `EXPO_ACCESS_TOKEN` este setat, iar protecția suplimentară pentru push este activă în Expo.
- [ ] Paginile `/confidentialitate` și `/stergere-cont` se deschid într-o fereastră privată, fără autentificare.
- [ ] Decizia despre toleranța de o zi la chestionar (10.6) este luată și notată în `DECIZII.md`.

**Aplicație**

- [ ] `PRODUCTION_URL` din `apps/mobile/src/lib/config.ts` este adresa de producție, cu `https://`.
- [ ] `<<IDENTIFICATOR>>` este cel final, același pe iOS și Android. Nu a rămas niciun `<<` în `app.json` sau `eas.json`.
- [ ] Pictograma și ecranul de pornire sunt ale produsului, nu cele implicite Expo.
- [ ] Pe telefon real, iOS **și** Android: autentificare, alegerea parolei, acordul (adult și minor), „Azi”, bifă, comentariu, RPE, chestionar cu hartă, video încărcat, video YouTube, notificare primită și atinsă, ieșire din cont.
- [ ] Mod avion: planul se vede; o bifă și un chestionar se salvează local; la revenirea semnalului pleacă singure; în baza de date nu apar dubluri.
- [ ] Fără permisiunea de notificări, aplicația merge la fel.
- [ ] După ieșirea din cont: redeschiderea aplicației cere autentificarea; al doilea cont pe același telefon nu vede nimic din primul și nu primește notificările lui.
- [ ] Textul notificărilor de pe ecranul blocat nu conține nicio stare medicală și niciun nume.
- [ ] Text mărit din setările telefonului: ecranele rămân utilizabile. VoiceOver / TalkBack citesc bifele și zonele hărții.
- [ ] Linkul către politica de confidențialitate și „Cere ștergerea contului” sunt în Profil.
- [ ] Niciun `console.log` cu date de la server.
- [ ] `expo-updates` este configurat înainte de build-ul de producție (secțiunea 14).

**Magazine**

- [ ] Conturile Apple și Google sunt pe persoana juridică.
- [ ] Contul demo: jucător adult, parolă valabilă, acord dat, plan pe azi, clip disponibil. Verificat în ziua trimiterii.
- [ ] Nota pentru recenzent (13.2) este completată.
- [ ] Apple: App Privacy completat după 13.4; Age Rating completat; categoria aleasă; disponibilitate doar în țările dorite.
- [ ] Google: Privacy policy, App access, Ads, Content rating, Target audience (13+), Data safety, Health apps — toate marcate ca finalizate în **App content**.
- [ ] Descrierea conține propoziția despre conturile create de club și pe cea despre dispozitivul medical; nu conține pretenții medicale și nici „pentru copii”.
- [ ] Capturile de ecran sunt făcute cu date demo.
- [ ] Test închis cu o grupă reală, cel puțin o săptămână, fără erori blocante.

## 17. Surse

Toate paginile au fost consultate la **7 octombrie 2026**. Prețurile, limitele și regulile magazinelor se schimbă; unde ghidul spune „de verificat”, verifică pe pagina oficială în ziua în care faci pasul.

**Expo și React Native**

- Tabelul versiunilor (SDK 57 = React Native 0.86, React 19.2.3, Node ≥ 22.13, Xcode ≥ 26.4, iOS ≥ 16.4): https://docs.expo.dev/versions/latest/
- Nota de lansare SDK 57 (30 iunie 2026): https://expo.dev/changelog/sdk-57
- SDK 58 beta (15 septembrie 2026): https://expo.dev/changelog/sdk-58-beta
- Nota de lansare SDK 56 (iOS minim 16.4, `expo/fetch` implicit): https://expo.dev/changelog/sdk-56-beta
- Trecerea la SDK 55 (`expo-av` scos; doar Noua Arhitectură): https://expo.dev/blog/upgrading-to-sdk-55
- Expo Go și App Store (mai 2026): https://expo.dev/changelog/expo-go-and-app-store-may-2026
- Monorepo (configurare automată de la SDK 52): https://docs.expo.dev/guides/monorepos/
- EAS Build în monorepo: https://docs.expo.dev/build-reference/build-with-monorepos/
- `create-expo-app` (șabloane, opțiuni): https://docs.expo.dev/more/create-expo/
- Expo Router — instalare manuală: https://docs.expo.dev/router/installation/
- Expo Router — autentificare, `Stack.Protected`: https://docs.expo.dev/router/advanced/authentication/
- EAS Build — primul build: https://docs.expo.dev/build/setup/
- Development build: https://docs.expo.dev/develop/development-builds/create-a-build/
- EAS Submit — iOS: https://docs.expo.dev/submit/ios/ · Android: https://docs.expo.dev/submit/android/
- EAS Update: https://docs.expo.dev/eas-update/getting-started/
- Variabile de mediu (`EXPO_PUBLIC_`, medii EAS): https://docs.expo.dev/eas/environment-variables/
- Planuri și prețuri EAS: https://expo.dev/pricing
- Notificări — configurare: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Notificări — credențiale FCM V1: https://docs.expo.dev/push-notifications/fcm-credentials/
- Notificări — trimitere (Expo Push API, limite, erori): https://docs.expo.dev/push-notifications/sending-notifications/
- `expo-notifications` (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/notifications/
- `expo-video` (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/video/
- `expo-file-system` (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/
- `expo-secure-store` (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
- `expo-screen-capture` (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/
- `react-native-webview` în Expo: https://docs.expo.dev/versions/v57.0.0/sdk/webview/
- Manifestul de confidențialitate Apple în Expo: https://docs.expo.dev/guides/apple-privacy/
- Pregătirea mediului React Native (Android Studio, variabile): https://reactnative.dev/docs/set-up-your-environment
- Registrul npm, la aceeași dată: `expo` 57.0.27 (eticheta `next`: 58.0.6), `create-expo-app` 5.0.0, `eas-cli` 24.11.0, `react-native-youtube-iframe` 2.4.1.

**Offline**

- TanStack Query v5 în React Native (`onlineManager`, `focusManager`): https://tanstack.com/query/latest/docs/framework/react/react-native
- Persistarea cache-ului: https://tanstack.com/query/v5/docs/framework/react/plugins/persistQueryClient

**Video**

- Eroarea 153 la YouTube în WebView (sursă a comunității, nu oficială): https://vegcale.com/2025/11/01/how-to-solve-youtube-error-153-in-react-native/

**Apple**

- Înscrierea în Apple Developer Program (individual / organizație, D-U-N-S, 99 USD): https://developer.apple.com/programs/enroll/
- App Review Guidelines (1.3, 1.4.1, 2.1, 5.1.1, 5.1.2, 5.1.3, 5.1.4): https://developer.apple.com/app-store/review/guidelines/
- Ștergerea contului din aplicație: https://developer.apple.com/support/offering-account-deletion-in-your-app
- App Privacy — tipurile de date și definițiile: https://developer.apple.com/app-store/app-privacy-details/
- Distribuție nelistată: https://developer.apple.com/support/unlisted-app-distribution/
- Clasificarea pe vârste actualizată (iulie 2025): https://developer.apple.com/news/?id=ks775ehf

**Google Play**

- Înregistrarea în Play Console (25 USD, verificări): https://support.google.com/googleplay/android-developer/answer/6112435
- Tipul de cont (organizație obligatorie pentru aplicații medicale): https://support.google.com/googleplay/android-developer/answer/13634885
- Cerința de testare pentru conturile personale noi (12 testeri, 14 zile): https://support.google.com/googleplay/android-developer/answer/14151465
- Declarația pentru aplicații de sănătate: https://support.google.com/googleplay/android-developer/answer/14738291
- Politica „Health Content and Services”: https://support.google.com/googleplay/android-developer/answer/13996823
- Formularul Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Cerințele de ștergere a contului: https://support.google.com/googleplay/android-developer/answer/13327111
- Public-țintă și conținut: https://support.google.com/googleplay/android-developer/answer/9867159

**Vercel**

- Sarcini programate — limite pe planuri: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Planul Hobby (uz necomercial; 20 USD/lună pe loc la Pro): https://vercel.com/docs/plans/hobby

**Ce nu a putut fi verificat și trebuie confirmat la momentul respectiv**

| Subiect | Unde verifici |
|---|---|
| Durata aprobării conturilor Apple și Google și a recenziilor | în conturile respective, la înscriere / trimitere |
| Dimensiunile capturilor de ecran și ale graficelor de magazin | formularele de încărcare din App Store Connect și Play Console |
| Formularea întrebărilor puse de `eas build:configure`, `eas credentials`, `eas submit` | pe ecran, la rulare; documentația EAS de mai sus |
| Prima trimitere pe Android prin `eas submit` (cheia de cont de serviciu pentru API-ul Play) | https://docs.expo.dev/submit/android/ |
| Ora (UTC) și securizarea sarcinilor programate Vercel (`CRON_SECRET`) | documentația Vercel Cron Jobs |
| Regulile Apple pentru actualizările OTA | App Review Guidelines, la zi |
| Redarea YouTube în WebView cu antetul `Referer` | pe telefon real, iOS și Android |
| `todayIn` (`Intl.DateTimeFormat` cu fus orar) pe Hermes | primul ecran „Azi” în simulator (8.6, pasul 6) |
| Trimiterea reală prin Expo Push Service | pașii din 9.6 |
| Prețul Firebase Cloud Messaging și planul Neon | paginile de prețuri ale furnizorilor |
