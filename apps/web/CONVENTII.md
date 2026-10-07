# Convenții de lucru — aplicația web

Citește tot fișierul înainte să scrii cod. Regulile de aici țin modulele coerente între ele.

## Structură

```
packages/shared/src/        tipuri, etichete, reguli de domeniu, parsere de import, interogări comune (web + nativ)
db/migrations/        schema, RLS, triggere, RPC (sursa de adevăr pentru permisiuni)
apps/web/src/
  app/(auth)/               autentificare, parolă uitată
  app/(setup)/              parolă inițială, consimțământ
  app/(app)/                zona autentificată — fiecare modul are directoarele lui de rute
  components/ui/            componente comune (NU le modifica; vezi lista de mai jos)
  components/charts/        grafice comune
  components/<modul>/       componentele modulului tău
  lib/                      sesiune, acțiuni, storage, temă
  messages/ro/<modul>.ts    TOATE textele vizibile ale modulului tău
```

## Next.js 16 — diferențe care contează

- `params` și `searchParams` sunt `Promise`: `const { id } = await params`.
- `cookies()` / `headers()` sunt asincrone. Middleware se numește `proxy.ts` (există deja).
- `cacheComponents` este oprit: paginile sunt dinamice, randate la cerere. Nu folosi `"use cache"`, `unstable_cache`, `revalidate`.
- Documentația versiunii instalate: `node_modules/next/dist/docs/`. Consult-o când nu ești sigur.

## Sesiune și permisiuni

```ts
// pagină (componentă server)
import { requireRole, requireCapability, requireSession, visibleGroups } from "@/lib/auth";
const { db, ctx } = await requireRole("physio");          // sau requireCapability("viewMedicalFile")
// db  = client Supabase al utilizatorului (RLS activ) — tipizat cu Database din @club/shared
// ctx = { userId, profile, role, club, settings, today, groups, statuses, staffGroupIds, player }
```

- **RLS este ultima linie de apărare; nu o ocoli.** `createAdminClient()` (cheie de serviciu) se folosește doar la crearea conturilor și în `/api/cron`.
- Nu filtra pe grupă „de mână" ca măsură de securitate: baza de date o face. Filtrele din UI sunt doar pentru comoditate.
- Roluri: `owner` (patron: doar agregate, prin RPC `club_overview`), `sporting_director` (fișa sumară, citire), `physio` (tot), `coach` (grupele lui, doar citire), `player` (pagina lui), `medical_partner` (cazurile trimise).
- La afișarea datelor medicale ale unui jucător de către staff, jurnalizează citirea:
  `await db.rpc("log_medical_access", { p_player: id, p_section: "medical" })` (secțiuni: `fisa`, `medical`, `wellness`, `fizic`, `documente`).
- `ctx.today` este ziua curentă în fusul clubului (AAAA-LL-ZZ). Nu folosi `new Date()` pentru „azi".

## Date

- Interogări comune: `@club/shared` (`listPlayers`, `getPlayer`, `getPlayerDay`, `submitWellness`, `setCompletion`, `listWellness`, `listExercises`, `listNotifications`…). Verifică `packages/shared/src/queries.ts` înainte să scrii una nouă.
- Interogările specifice modulului: `apps/web/src/components/<modul>/queries.ts` (primesc `db: Db`). Nu modifica `packages/shared` (alt modul lucrează în paralel); dacă îți lipsește ceva de acolo, scrie local și notează în fișierul tău de decizii.
- Tipuri: `Tables<"players">`, `TablesInsert<…>`, `Enums<"app_role">` din `@club/shared`.
- Etichete în română pentru valorile din baza de date: `packages/shared/src/labels.ts` (`label(INJURY_TYPES, x)`), zone: `zoneLabel`, `describeZone`, `BODY_ZONES`; date: `formatDate`, `formatDateShort`, `formatDateTime`, `relativeDay`, `plural`, `addDays`, `weekStart`, `weekDates`.
- Operațiuni atomice există ca RPC: `save_daily_plan`, `copy_daily_plan`, `save_program`, `assign_program`, `import_*`, `club_overview`, `group_test_averages`, `export_player_data`, `anonymize_player`, `refresh_daily_alerts`, `update_my_profile`, `set_my_photo`, `log_event`. Semnăturile sunt în `packages/shared/src/database.types.ts`.
- Schimbări de schemă: doar dacă sunt cu adevărat necesare. Fișier nou `db/migrations/202610071<NN>00_<modul>_<ce>.sql` (nu edita migrările existente), apoi `npm run db:migrate && npm run db:types` din rădăcină. Orice tabel nou are RLS și politici; orice funcție nouă are `revoke execute … from public, anon` + `grant` explicit.

## Acțiuni de server

```ts
// apps/web/src/app/(app)/<ruta>/actions.ts
"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";

const Input = z.object({ playerId: z.uuid(), note: z.string().max(2000) });

export async function saveNote(input: z.infer<typeof Input>) {
  return run({ roles: ["physio"], revalidate: ["/jucatori"], message: "Salvat." }, async ({ db, ctx }) => {
    const v = Input.parse(input);
    const { error } = await db.from("players").update({ status_note: v.note }).eq("id", v.playerId);
    if (error) throw error;                      // devine mesaj în română
    if (somethingWrong) fail("Mesaj pentru utilizator.");
    return { id: v.playerId };
  });
}
```

```tsx
// componentă client
"use client";
import { useAction } from "@/lib/use-action";
const save = useAction(saveNote, { onSuccess: () => setOpen(false) });   // toast + router.refresh() automat
<Button pending={save.pending} onClick={() => save.run({ playerId, note })}>Salvează</Button>
<FormError>{save.error}</FormError>
```

- Acțiunile primesc obiecte simple (nu `FormData`) și le validează cu zod 4 (`z.uuid()`, `z.email()`, `z.iso.date()`).
- Fișierele se încarcă din browser direct în storage (`createClient()` din `@/lib/supabase/client`), apoi o acțiune scrie rândul din tabel. Bucketuri private: `medical` (`<player_id>/<fișier>`), `exercise-media` (`<club_id>/<fișier>`), `avatars` (`<player_id>/<fișier>`), `branding` (`<club_id>/<fișier>`). Citirea: `signedUrl(db, bucket, path)` din `@/lib/storage` (linkuri cu expirare).

## Interfață

Publicul: jucători pe telefon, la marginea terenului, în soare; staff pe telefon și pe laptop.

- **Mobile-first.** Verifică fiecare ecran la 390 px lățime, apoi la 1280 px. Fără derulare orizontală a paginii (tabelele late stau în `TableWrap`).
- **Ținte mari**: controale de 48 px înălțime (`Button`, `Input`, `Select` au deja). **Puțin text.**
- **Stare = culoare + text/pictogramă, mereu**: folosește `StatusChip`. Culorile `st-green / st-yellow / st-orange / st-red / st-gray` sunt rezervate stărilor și alertelor; nu le folosi decorativ.
- Culoarea clubului (`bg-brand text-brand-ink`) doar pe navigație și pe acțiunea principală a ecranului.
- Fără umbre decorative, fără gradiente, fără animații de intrare. Carduri cu chenar de 1 px (`Card`).
- Titluri în propoziții („Adaugă accidentare"), nu Title Case, nu MAJUSCULE (excepție: etichetele de stare ale clubului — APT, ACC — care sunt vocabularul lor).
- Stări goale utile: spune ce lipsește și ce poate face utilizatorul (`EmptyState`).
- Accesibilitate: `label` pe fiecare câmp (`Field`), `aria-label` pe butoanele doar cu pictogramă (`IconButton`), focus vizibil (există global), contrast AA.

Componente comune (importă-le, nu le rescrie):

| Fișier | Ce oferă |
|---|---|
| `ui/button` | `Button` (variant: primary / secondary / ghost / danger; size; pending; icon), `LinkButton`, `IconButton`, `buttonClass` |
| `ui/card` | `Card`, `CardHeader`, `CardBody`, `PageHeader`, `EmptyState`, `Stat`, `Notice` |
| `ui/form` | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Segmented`, `FormError` |
| `ui/status` | `StatusChip`, `Badge`, `ReviewBadge`, `StatusIcon`, `TONE_SOLID / TONE_SOFT / TONE_BAR / TONE_HEX` |
| `ui/overlay` | `Dialog` (foaie de jos pe telefon, centrat pe desktop) |
| `ui/toast` | `useToast()` |
| `ui/scale` | `ScaleInput` (1–10, butoane mari), `ScoreCell` |
| `ui/body-map` | `BodyMap` (hartă SVG față/spate; selectare sau afișare cu `highlights`) |
| `ui/video` | `ExerciseMedia` (clip încărcat / YouTube / Vimeo / imagine / lipsă) |
| `ui/misc` | `Avatar`, `ProgressBar`, `TabLinks`, `PrevNext`, `TableWrap`, `DataList` |
| `charts` | `TrendChart`, `BarsChart`, `StackedBarsChart`, `Sparkline`, `SERIES_COLORS`, `AVAILABILITY_COLORS` |

Pictograme: `lucide-react`. Grafice: doar componentele din `components/charts` (o singură axă, legendă de la 2 serii, culorile de serie în ordinea dată).

Starea ecranului stă în URL (`?grupa=…&zi=…`) cu linkuri, nu în `useState`, oricând are sens să poată fi trimis linkul sau apăsat „înapoi".

## Texte (i18n) și limbă

- Niciun text vizibil scris direct în componente. Totul în `src/messages/ro/<modul>.ts`:
  ```ts
  export const wellness = { title: "Chestionare", missing: (n: number) => `${n} necompletate` } as const;
  ```
  Folosire: `const t = getT().wellness` (server) / `const t = useT().wellness` (client). Texte comune: `getT().common`.
  Etichetele de domeniu din `@club/shared` (roluri, zone, categorii) se folosesc ca atare.
- Română firească, cu diacritice corecte (ș, ț cu virgulă), ortografie DOOM 3: „niciun", „niciodată", „sunt", „odată" / „o dată" după sens; ghilimele „ ”; numeral + „de" de la 20 în sus (`plural()` din shared).
- Tonul: direct, la persoana a II-a singular pentru jucător („Completează chestionarul"), impersonal-scurt pentru staff. Fără „Ups!", fără scuze, fără semne de exclamare.
- Butonul spune exact ce face („Salvează starea", nu „Trimite").

## Verificare înainte să predai

Rulează din rădăcina repo-ului (`/home/claude/vc`):

```bash
npx tsc --noEmit -p apps/web            # fără erori
npx eslint apps/web/src/<fișierele tale>  # fără erori (din apps/web: npx eslint src/...)
```

Serverul de dezvoltare rulează deja pe `http://localhost:3000` (NU porni altul, NU rula `next build`, NU rula `npm install`).
Baza de date locală rulează deja; variabilele sunt în `tools/local-stack/.data/env` (`DATABASE_URL` pentru `psql`).

Capturi de ecran / verificare în browser (Playwright, Chromium la `/opt/pw-browsers/chromium`):

```bash
node tools/e2e/shot.mjs <email> <cale> mobile|desktop /cale/captura.png   # se autentifică și face captura
```

Pentru fluxuri (click, completare) scrie-ți un script Playwright scurt în directorul tău de scratch, după modelul `tools/e2e/shot.mjs`.
Uită-te la capturi (instrumentul Read afișează imagini) și corectează ce arată rău. Închide browserul după fiecare rulare.

Conturi demo (parolele sunt în `conturi-demo.local.md`, la rădăcină):

- **Club Demo** (date inventate, bogate — folosește-l pentru verificări): `preparator.demo@example.com`, `antrenor.demo@example.com` (Seniori), `antrenor.juniori.demo@example.com` (U19 + U17), `director.demo@example.com`, `patron.demo@example.com`, `jucator.demo@example.com`, `jucator.accidentat.demo@example.com` (are plan de recuperare), `jucator.minor.demo@example.com`, `partener.demo@example.com`.
- **Viitorul Cluj** (datele reale importate: 117 jucători, 5 grupe, fără conturi de jucător): `preparator.viitorul@example.com`, `antrenor.l3.viitorul@example.com`, `antrenor.juniori.viitorul@example.com`, `director.viitorul@example.com`, `patron.viitorul@example.com`, `partener.viitorul@example.com`. **Nu modifica și nu șterge datele acestui club**; pentru teste care scriu, folosește Club Demo.

Verifică și negativul: intră cu un rol care NU ar trebui să vadă pagina și confirmă că este redirecționat sau că nu vede date.

## Ce predai

1. Codul, în directoarele modulului tău. Nu modifica fișierele altor module sau cele comune (`components/ui`, `components/charts`, `lib`, `messages/index.ts`, `messages/ro/index.ts`, `app/(app)/layout.tsx`, `packages/shared`, migrările existente). Dacă un fișier comun are un defect care te blochează, repară-l minimal și spune explicit în raport.
2. `docs/decizii/<modul>.md`: presupunerile și deciziile luate, ce a rămas nefăcut și de ce (scurt, pe puncte, în română).
3. Raportul final: ce ai construit (rute), ce ai verificat efectiv și cum, ce nu merge sau a rămas pe dinafară. Fii exact: „nu am verificat X" este un răspuns bun; „totul merge" fără probă nu este.
