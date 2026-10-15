# Locker Room

Platforma de administrare a clubului de fotbal: echipe, jucători, familii, program, meciuri, antrenamente, performanță, bani și comunicare, într-o singură aplicație multi-club, în limba română. Înlocuiește The Football Brain la Viitorul Cluj.

Locker Room pornește din Vestiar, platforma medicală și de pregătire fizică descrisă mai jos, care devine spațiul de lucru **Performanță**. Istoricul Vestiar este păstrat în acest depozit. Planul de reconstrucție (arhitectura informației, modelul de date, etapele) este documentul „Locker Room — Rebuild Plan”.

---

# Platformă medicală și de pregătire fizică pentru cluburi de fotbal

Aplicație web în care un club ține evidența stării medicale și fizice a fiecărui jucător, iar preparatorul fizic prescrie și urmărește programe de prevenție, recuperare și planuri zilnice. Fiecare jucător are contul lui și își vede doar pagina lui; permisiunile sunt impuse în baza de date, nu doar în interfață. Aplicația este multi-club (nume, siglă, culori, grupe și stări sunt date de configurare) și este în limba română. Primul client: Viitorul Cluj.

**Producție:** https://viitorul-cluj.vercel.app

| Document | Ce găsești |
|---|---|
| [`DECIZII.md`](DECIZII.md) | ce s-a hotărât pe parcurs, abaterile de la specificație, ce a rămas de făcut |
| [`GDPR.md`](GDPR.md) | ce date se prelucrează, cine le vede, ce are clubul de făcut |
| [`NATIVE.md`](NATIVE.md) | ghidul pentru aplicațiile iOS și Android |
| [`docs/cerinte.md`](docs/cerinte.md) | specificația inițială |
| [`docs/surse-exercitii.md`](docs/surse-exercitii.md) | sursele de clipuri cercetate și lista exercițiilor fără clip |
| [`docs/ilustratii-exercitii.md`](docs/ilustratii-exercitii.md) | ilustrațiile exercițiilor: setul gratuit folosit și varianta plătită |
| [`apps/web/CONVENTII.md`](apps/web/CONVENTII.md) | convențiile de cod — de citit înainte de orice modificare |
| [`docs/decizii/`](docs/decizii/) | deciziile de detaliu, câte un fișier pe modul |

---

## 1. Roluri și conturi demo

| Rol | Ce vede | Ce modifică | Pagina de start |
|---|---|---|---|
| Patron | doar cifre pe club și pe grupe, fără nume | nimic | `/tablou` |
| Director sportiv | cifrele + fișa sumară a fiecărui jucător (stare, zonă, revenire, restricții) | nimic | `/tablou` |
| Preparator fizic | tot, în clubul lui | tot: jucători, medical, exerciții, programe, planuri, importuri, conturi, setări | `/tablou` |
| Antrenor | doar grupele lui: disponibilitate, fișa medicală completă, chestionare, date fizice | nimic | `/disponibilitate` |
| Jucător | doar pagina lui | chestionarul, bifele, efortul (RPE), datele de profil | `/azi` |
| Partener medical | doar jucătorii trimiși către el | note și documente pe acele cazuri | `/cazuri` |

Tabelul complet, cu excepțiile, este în [`GDPR.md`](GDPR.md), secțiunea 2.

**Conturile demo** (aceleași adrese local și în producție):

| Club | Rol | E-mail |
|---|---|---|
| Viitorul Cluj | Patron | `patron.viitorul@example.com` |
| Viitorul Cluj | Director sportiv | `director.viitorul@example.com` |
| Viitorul Cluj | Preparator fizic | `preparator.viitorul@example.com` |
| Viitorul Cluj | Antrenor (Liga 3) | `antrenor.l3.viitorul@example.com` |
| Viitorul Cluj | Antrenor (U17 + U16) | `antrenor.juniori.viitorul@example.com` |
| Viitorul Cluj | Partener medical | `partener.viitorul@example.com` |
| Club Demo | Patron | `patron.demo@example.com` |
| Club Demo | Director sportiv | `director.demo@example.com` |
| Club Demo | Preparator fizic | `preparator.demo@example.com` |
| Club Demo | Antrenor (Seniori) | `antrenor.demo@example.com` |
| Club Demo | Antrenor (U19 + U17) | `antrenor.juniori.demo@example.com` |
| Club Demo | Jucător adult | `jucator.demo@example.com` |
| Club Demo | Jucător cu plan de recuperare | `jucator.accidentat.demo@example.com` |
| Club Demo | Jucător minor (acordul părintelui) | `jucator.minor.demo@example.com` |
| Club Demo | Partener medical | `partener.demo@example.com` |

- **Viitorul Cluj** conține datele reale importate din cele două tabele ale clubului. Nu are conturi de jucător. Nu-l folosi pentru teste care scriu.
- **Club Demo** conține date inventate, pentru prezentări și teste.
- **Parolele nu sunt în git.** Sunt generate aleator la inițializare. Local le găsești în `conturi-demo.local.md`, la rădăcina proiectului (fișier ignorat de git). Parolele din producție au fost predate separat.
- **Regenerarea parolelor în producție:** secțiunea 5.3.
- Adresele `@example.com` nu primesc e-mail: „Am uitat parola” nu funcționează pentru ele.

---

## 2. Arhitectura pe scurt

```
apps/web/           aplicația Next.js 16 (React 19, TypeScript, Tailwind 4), instalabilă ca PWA
  src/app/(auth)/     autentificare, parolă uitată
  src/app/(setup)/    alegerea parolei, consimțământ
  src/app/(app)/      zona autentificată — fiecare modul are rutele lui
  src/app/api/        files (fișiere private), cron (sarcini programate), setup (inițializare)
  src/lib/            sesiune, permisiuni, fișiere, e-mail, temă
  src/messages/ro/    toate textele vizibile
  vercel.json         regiunea funcțiilor (fra1) și sarcinile programate
packages/shared/    tipuri, etichete, reguli de domeniu, parsere de import, interogări comune (web + nativ)
packages/db/        conexiunea la Postgres, clientul de date sub RLS, autentificarea proprie
packages/seed/      date inițiale: club, bibliotecă de exerciții, club demonstrativ
db/migrations/      schema, politicile RLS, triggerele, funcțiile — sursa de adevăr pentru permisiuni
scripts/            migrări, seed, importul tabelelor, testul de acces pe roluri, generarea tipurilor
tools/local-stack/  Postgres local pentru dezvoltare (fără Docker)
tools/e2e/          capturi de ecran cu Playwright
```

**Stackul** (diferit de specificație — vezi [`DECIZII.md`](DECIZII.md), secțiunea 2): Postgres pe Neon, autentificare proprie, fișiere în Vercel Blob, găzduire pe Vercel. Nu se folosește Supabase.

**Cum circulă o cerere**

1. `apps/web/src/proxy.ts` trimite la `/autentificare` orice vizitator fără cookie-ul `sesiune`.
2. `apps/web/src/lib/auth.ts` verifică sesiunea în baza de date (în cookie stă un cod aleator, în bază doar amprenta lui) și construiește `db`, clientul de date al utilizatorului.
3. Codul scrie interogări în sintaxa PostgREST: `db.from("players").select("id, groups(name)")`. Ele nu pleacă prin rețea: `packages/db/src/rest.ts` le traduce în SQL.
4. `packages/db/src/client.ts` rulează fiecare interogare într-o tranzacție în care rolul Postgres este `authenticated`, iar `app_auth.uid()` este utilizatorul curent. Row Level Security hotărăște ce rânduri se văd.

Clientul care ocolește RLS (`createServiceDb`) este folosit doar de `/api/cron`, `/api/setup` și scripturile de seed.

**Fișierele** (documente medicale, clipuri, fotografii, sigle) stau într-un depozit privat: Vercel Blob în producție, directorul `tools/local-stack/.data/files` local. Nu au adrese publice. Se cer prin `/api/files/<depozit>/<cale>`, care verifică sesiunea și dreptul de citire la fiecare cerere (funcția SQL `file_access`) și jurnalizează descărcările de documente medicale.

---

## 3. Rulare locală

**Cum citești pașii.** Un pas = o singură acțiune. După fiecare pas scrie **„Vezi:”** — ce trebuie să apară. Dacă vezi altceva, te oprești acolo, copiezi din Terminal tot textul de la comandă până la ultimul rând și îl dai asistentului AI exact așa.

- Terminalul: aplicația **Terminal** (⌘Space, scrii `Terminal`, Enter). O comandă se rulează cu Enter și se oprește cu ⌃C.
- `<<REPO>>` este folderul proiectului pe calculatorul tău. Îl afli trăgând folderul din Finder în fereastra Terminal. Pregătește comenzile care conțin `<<…>>` într-un editor de text simplu și abia apoi lipește-le în Terminal.
- Ai nevoie de **două ferestre de Terminal**: una pentru baza de date, una pentru aplicație. Amândouă rămân ocupate cât lucrezi.

### 3.1 Prima instalare

1. Rulează:

   ```sh
   node -v
   ```

   **Vezi:** `v20.9` sau mai mare (recomandat `v22` sau `v24`). Dacă vezi `command not found` sau o versiune mai mică, instalează versiunea LTS de la `https://nodejs.org`, închide Terminalul, deschide-l din nou și repetă pasul.

2. Intră în folderul proiectului:

   ```sh
   cd <<REPO>>
   ```

   **Vezi:** nimic; promptul arată acum numele folderului.

3. Instalează dependențele:

   ```sh
   npm ci
   ```

   **Vezi:** după 1–3 minute, un rând care începe cu `added` și un număr de pachete. Avertismentele (`npm warn`) nu sunt erori.

4. Pornește baza de date locală:

   ```sh
   npm run stack:start
   ```

   **Vezi:** `Postgres local pornit.` și un rând `DATABASE_URL=postgres://app_owner:postgres@127.0.0.1:54322/club`. Fereastra rămâne ocupată: **las-o deschisă**.

5. Deschide a doua fereastră de Terminal (⌘N) și intră din nou în proiect:

   ```sh
   cd <<REPO>>
   ```

   **Vezi:** nimic. Toți pașii următori se fac în această a doua fereastră.

6. Creează structura bazei de date:

   ```sh
   npm run db:migrate
   ```

   **Vezi:** nouă rânduri de forma `→ 20261007000050_platform.sql … ok`, apoi `Migrări aplicate.`

7. Creează fișierul `<<REPO>>/apps/web/.env.local` (cu asistentul AI sau cu editorul de cod), cu exact acest conținut:

   ```
   DATABASE_URL=postgres://app_owner:postgres@127.0.0.1:54322/club
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_APP_NAME=Vestiar
   ```

   **Vezi:** fișierul există la calea dată. (Este ignorat de git.)

8. Creează clubul Viitorul Cluj, biblioteca de exerciții și conturile de staff:

   ```sh
   npm run db:seed-club
   ```

   **Vezi:** `Viitorul Cluj: club creat, 6 conturi. Parolele sunt în conturi-demo.local.md.`

9. Creează clubul demonstrativ:

   ```sh
   npm run db:seed-demo
   ```

   **Vezi:** `Club Demo: 40 jucători, 9 conturi. Parolele sunt în conturi-demo.local.md.` Poate dura până la un minut.

10. Pune cele două tabele ale clubului în folderul `<<REPO>>/data/private/`, descărcate din Google Sheets cu **File → Download → Microsoft Excel (.xlsx)** și redenumite exact așa:
    - `stare-de-sanatate.xlsx`
    - `fatigue-l3.xlsx`

    **Vezi:** cele două fișiere în folder. (Folderul este ignorat de git: datele clubului nu ajung în repo.) Dacă nu ai fișierele, sari peste pașii 10 și 11 și lucrează cu Club Demo.

11. Importă tabelele:

    ```sh
    npx tsx scripts/import-club-files.ts --week 2026-09-28
    ```

    **Vezi:** un rând `Stare de sănătate: …`, cinci rânduri `bloc … -> Liga 3: 25 jucători` (apoi U21: 21, U17: 22, U16: 21, U15: 26), un rând `Chestionare L3 (săptămâna 2026-09-28): …` și, la sfârșit, `Total jucători în evidență: 117`. `--week` este ziua de luni a săptămânii în care se așază grila de oboseală.

12. Pornește aplicația:

    ```sh
    npm run dev
    ```

    **Vezi:** un rând cu `http://localhost:3000`. Fereastra rămâne ocupată.

13. Deschide în browser `http://localhost:3000`.

    **Vezi:** pagina de autentificare.

14. Deschide fișierul `<<REPO>>/conturi-demo.local.md` și autentifică-te cu `preparator.demo@example.com` și parola din dreptul lui.

    **Vezi:** la prima autentificare, ecranul de confidențialitate; după acceptare, tabloul de bord al clubului demonstrativ.

### 3.2 În zilele următoare

1. Prima fereastră: `cd <<REPO>>`, apoi `npm run stack:start`. **Vezi:** `Postgres local pornit.`
2. A doua fereastră: `cd <<REPO>>`, apoi `npm run dev`. **Vezi:** `http://localhost:3000`.

Datele rămân între porniri. Oprirea: ⌃C în fiecare fereastră.

### 3.3 Alte comenzi utile

| Comandă | Ce face |
|---|---|
| `npm run stack:start -- --reset` | șterge baza de date locală și pornește una goală (apoi reiei de la pasul 6) |
| `npm run db:seed-demo -- --reset` | șterge clubul demonstrativ și îl reface |
| `npm run db:seed-library -- --club <slug>` | încarcă biblioteca de exerciții și șabloanele de programe într-un club (`--force` suprascrie) |
| `npm run db:types` | regenerează `packages/shared/src/database.types.ts` după o migrare |
| `node tools/e2e/shot.mjs <email> <cale> mobile\|desktop <fișier.png>` | se autentifică și face o captură de ecran (cere aplicația pornită și `npx playwright install chromium`) |

După o migrare nouă, repornește `npm run dev`: aplicația citește structura bazei de date o singură dată, la pornire.

---

## 4. Variabile de mediu

| Nume | La ce folosește | Obligatorie? | De unde vine pe Vercel |
|---|---|---|---|
| `DATABASE_URL` | conexiunea aplicației la Postgres (prin pooler) | da | integrarea Neon (Storage → Neon) o pune singură |
| `DATABASE_URL_UNPOOLED` | conexiune directă, folosită de migrări la build | pe Vercel, da | integrarea Neon |
| `BLOB_READ_WRITE_TOKEN` sau `BLOB_STORE_ID` | depozitul de fișiere | pe Vercel, da (fără ea încărcările răspund 503); local nu | conectarea depozitului Blob la proiect |
| `CRON_SECRET` | secretul cerut de `/api/cron`; fără el ruta răspunde mereu 401 | da, pentru sarcinile programate | o adaugi de mână (șir aleator lung); Vercel o trimite singur la fiecare rulare |
| `SETUP_SECRET` | activează `/api/setup`; cel puțin 24 de caractere | doar temporar, la inițializare | o adaugi de mână și o ștergi după |
| `NEXT_PUBLIC_SITE_URL` | adresa publică din linkurile de invitație și din e-mailuri | nu pe Vercel (se folosește adresa de producție a proiectului); recomandată când treci pe domeniu propriu | de mână |
| `NEXT_PUBLIC_APP_NAME` | numele afișat înainte de autentificare și la instalarea ca aplicație; implicit „Vestiar” | nu | de mână |
| `RESEND_API_KEY` | trimiterea e-mailurilor prin Resend | nu (fără ea, notificările rămân doar în aplicație) | de mână, din contul Resend |
| `EMAIL_FROM` | expeditorul, de forma `Nume <adresa@domeniu>`; trebuie setată împreună cu cheia | nu | de mână |
| `DATABASE_POOL_MAX` | numărul maxim de conexiuni pe instanță; implicit 5 | nu | de mână |

Alte nume acceptate ca rezervă: `POSTGRES_URL` (în locul `DATABASE_URL`) și `POSTGRES_URL_NON_POOLING` (pentru migrări). `VERCEL`, `VERCEL_ENV` și `VERCEL_PROJECT_PRODUCTION_URL` sunt puse de Vercel.

Doar local: `LOCAL_FILES_DIR` (alt folder pentru fișiere), `DEMO_EMAIL_DOMAIN` și `DEMO_PASSWORD` (pentru scripturile de seed), `BASE_URL` (pentru `tools/e2e/shot.mjs`). Modelul este `apps/web/.env.example`.

---

## 5. Publicare

Proiectul Vercel `viitorul-cluj` este legat de repo-ul GitHub `zavaleanurares-cmyk/viitorul-cluj`. Baza de date este proiectul Neon „neon-purple-ladder” (AWS `eu-central-1`, Frankfurt).

### 5.1 Publicarea unei schimbări

1. Schimbarea ajunge pe ramura `main` (push sau pull request acceptat).
2. Vercel pornește singur un build. Build-ul face, în ordine: aplică migrările noi din `db/migrations` (`scripts/migrate.mjs`), apoi `next build`.
3. Urmărești build-ul în Vercel → proiectul `viitorul-cluj` → **Deployments**. **Vezi:** starea **Ready**.

De știut:

- Migrările se aplică **doar la build-urile de producție**. Build-urile de previzualizare (alte ramuri) nu aplică migrări: o ramură al cărei cod cere o migrare nouă poate să nu funcționeze în previzualizare. La ce bază de date se conectează previzualizările depinde de cum este legată integrarea Neon de proiect — de verificat în Vercel → Settings → Environment Variables.
- O migrare greșită oprește build-ul, iar versiunea veche rămâne în funcțiune. Fiecare migrare rulează într-o tranzacție: ori se aplică toată, ori deloc.
- Migrările existente nu se editează. O schimbare de schemă este un fișier nou în `db/migrations`, cu nume crescător.
- Adresele de previzualizare cer autentificare cu contul Vercel; adresa de producție este publică.

### 5.2 O instalare nouă pe Vercel, de la zero

1. În Vercel: **Add New → Project**, alegi repo-ul din GitHub. La **Root Directory** alegi `apps/web`. **Vezi:** Vercel recunoaște Next.js.
2. În proiect: **Storage → Create Database → Neon**, planul Free, regiunea Frankfurt (`eu-central-1`), apoi îl conectezi la proiect. **Vezi:** în **Settings → Environment Variables** apar `DATABASE_URL` și `DATABASE_URL_UNPOOLED`.
3. **Storage → Create → Blob**, acces **Private**, regiunea **`fra1`**, apoi îl conectezi la proiect. Nici accesul, nici regiunea nu se mai pot schimba după creare. **Vezi:** apare o variabilă `BLOB_…`.
4. **Settings → Environment Variables → Add**: `CRON_SECRET`, cu un șir aleator lung.
5. La fel: `SETUP_SECRET`, cu un șir aleator de cel puțin 24 de caractere. Notează-l.
6. **Deployments →** ultimul build **→ Redeploy**. **Vezi:** în jurnalul build-ului, rândurile migrărilor și `Migrări aplicate.`, apoi starea **Ready**.
7. Deschide în browser `https://<<ADRESA>>/api/setup?pas=stare&s=<<SETUP_SECRET>>`. **Vezi:** un text JSON cu `"clubs": []`. Dacă vezi `Not found`, secretul lipsește, este prea scurt sau nu se potrivește.
8. Deschide `https://<<ADRESA>>/api/setup?pas=club&s=<<SETUP_SECRET>>`. **Vezi:** JSON cu `"clubName": "Viitorul Cluj"` și lista conturilor de staff cu parolele lor. **Parolele apar o singură dată: salvează-le acum.**
9. Deschide `https://<<ADRESA>>/api/setup?pas=demo&s=<<SETUP_SECRET>>`. **Vezi:** după o așteptare care poate trece de un minut, JSON cu `"clubName": "Club Demo"` și conturile lui. Salvează parolele.
10. Șterge variabila `SETUP_SECRET` din Vercel și fă din nou **Redeploy**. **Vezi:** adresa de la pasul 7 răspunde `Not found`.
11. Autentifică-te ca preparator și importă tabelele clubului din **Importuri** (`/import`): întâi starea de sănătate, apoi chestionarul săptămânal.

### 5.3 Regenerarea parolelor conturilor demo

Repeți pașii 5–10 de mai sus. `?pas=club` și `?pas=demo` nu șterg nimic: creează ce lipsește și dau **parole noi** conturilor demo existente. (`?pas=demo&reset=1` șterge și reface clubul demonstrativ.)

### 5.4 Un club nou

Nu există încă un ecran pentru crearea unui club. Clubul se creează de un programator, o singură dată:

1. Un script scurt, după modelul `scripts/seed-club.ts`, apelează funcția `setup_club` din baza de date (slug, nume, nume scurt, lista grupelor). Funcția creează clubul, cele cinci stări implicite și testele fizice implicite. Apoi creează primul cont de preparator (`ensureAccount` din `packages/seed`).
2. `npm run db:seed-library -- --club <slug>` încarcă biblioteca de exerciții și șabloanele de programe.
3. Restul îl face preparatorul din **Administrare**: sigla și culorile, grupele, stările, conturile, pragurile de alertă.

Scripturile lucrează pe baza de date din `DATABASE_URL`; pentru producție, valoarea se ia din Vercel și nu se salvează în fișiere din repo.

---

## 6. Operare

### 6.1 Sarcinile programate

`/api/cron` rulează de două ori pe zi, la 7:00 și 17:00 UTC (`apps/web/vercel.json`). La fiecare rulare: recalculează alertele zilnice, creează mementourile de chestionar, trimite e-mailul-rezumat (dacă e-mailul este configurat) și face curățenie (sesiuni și linkuri expirate, notificări citite mai vechi de 90 de zile). Pașii sunt independenți și pot fi repetați fără efecte duble.

- Mementoul pleacă la **prima rulare de după ora setată** a clubului sau a grupei, nu la ora exactă: planul gratuit Vercel permite doar rulări zilnice. Detalii și trecerea la rulare orară: [`DECIZII.md`](DECIZII.md), secțiunea 2.
- Rulările se văd în Vercel → proiect → **Settings → Cron Jobs** și în **Logs**, filtrat pe `/api/cron`.
- Rulare de mână (pregătește comanda într-un editor de text):

  ```sh
  curl -H "Authorization: Bearer <<CRON_SECRET>>" https://viitorul-cluj.vercel.app/api/cron
  ```

  **Vezi:** JSON care începe cu `{"ok":true`. `401` înseamnă secret greșit sau lipsă.

### 6.2 Copii de siguranță

- **Baza de date.** Proiectul Neon păstrează un istoric de restaurare de **6 ore** (valoarea `history_retention_seconds = 21600`, citită din proiect la 7 octombrie 2026). Înseamnă că baza poate fi readusă la orice moment din ultimele 6 ore, din consola Neon. **Nu există copii de siguranță mai vechi de atât.** Ce alte opțiuni oferă planul Free (instantanee, export) — de verificat în consola Neon.
- **Fișierele** din Vercel Blob nu au copie de siguranță.
- Recomandare înainte de folosirea cu date reale: un export periodic al bazei de date (`pg_dump`), făcut de cine administrează proiectul, sau trecerea pe un plan Neon cu istoric mai lung. Trecută ca punct deschis în [`DECIZII.md`](DECIZII.md).

### 6.3 E-mail

Trimiterea este scrisă (`apps/web/src/lib/email.ts`, prin Resend), dar neconfigurată. Până atunci notificările apar doar în aplicație, iar linkurile de invitație se copiază de mână din **Administrare → Conturi**.

1. Clubul își face cont la Resend și verifică acolo un domeniu al lui (înregistrări DNS).
2. În Vercel → **Settings → Environment Variables** adaugi `RESEND_API_KEY` și `EMAIL_FROM` (o adresă de pe domeniul verificat).
3. **Redeploy**.
4. Verificare: din **Administrare → Conturi**, trimite un link de acces unui cont cu adresă reală. **Vezi:** mesajul ajunge; fereastra nu mai cere copierea linkului.

Fiecare utilizator primește e-mailuri doar dacă are pornite notificările pe e-mail în profil. Conturile demo le au oprite.

### 6.4 Unde se văd erorile

- **Erori ale aplicației:** Vercel → proiect → **Logs** (filtrează pe „Error”). Erorile sarcinilor programate încep cu `[cron]`, cele de e-mail cu `[e-mail]`, cele de fișiere cu `[fișiere]`.
- **Build eșuat:** Vercel → **Deployments** → build-ul roșu → jurnalul. O migrare greșită apare cu numele fișierului și `EROARE`.
- **Cine ce a făcut în aplicație:** Administrare → Jurnal (doar preparatorul).
- **Baza de date:** consola Neon → proiectul „neon-purple-ladder”.

---

## 7. Verificare și teste

Toate se rulează din rădăcina proiectului.

| Comandă | Ce acoperă | Ce îi trebuie |
|---|---|---|
| `npm run test:rls` | accesul pe roluri, direct pe baza de date: ce vede și ce poate modifica fiecare rol, inclusiv încercări de acces neautorizat (alt club, altă grupă, alt jucător, fără autentificare). 162 de verificări. | baza locală pornită și migrată. Își creează două cluburi temporare și le șterge la sfârșit. |
| `npm test` | parserele de import: stări și zone din text liber, potrivirea numelor, maparea generică de coloane și cele două tabele reale ale clubului | pentru ultimele două teste, fișierele `data/private/stare-de-sanatate.csv` și `fatigue-l3.csv`. **Dacă lipsesc, testele pe tabelele reale sunt sărite fără eroare.** |
| `npm run typecheck` | tipurile TypeScript în `apps/web` și `packages/shared` | — |
| `npm run lint` | regulile ESLint în `apps/web` | — |

Rulează `npm run test:rls` după orice migrare care atinge politici sau funcții. Un rând cu `✗` înseamnă o regulă de acces stricată: nu publica.

Nu există teste automate de interfață. Fiecare modul a fost verificat în browser cu Playwright, pe telefon (390 px) și pe laptop (1280 px), cu conturile demo, inclusiv cu roluri care nu ar trebui să vadă pagina.

---

## 8. Ce urmează

Lista completă, cu efectul fiecărui punct, este în [`DECIZII.md`](DECIZII.md), secțiunea 6. Pe scurt, înainte de folosirea cu date reale:

1. conturi reale în locul celor demo și parole schimbate;
2. validarea juridică a textelor de consimțământ și pașii din [`GDPR.md`](GDPR.md), secțiunea 9;
3. un domeniu propriu și configurarea e-mailului;
4. verificarea importurilor pe fișiere reale K-Sport și pe listele nominale;
5. clipurile de exerciții ([`docs/surse-exercitii.md`](docs/surse-exercitii.md), secțiunea 5);
6. o soluție de copii de siguranță.

Aplicațiile native: [`NATIVE.md`](NATIVE.md).

## 9. Credite

Ilustrațiile exercițiilor din biblioteca de bază: [Exercise data by RepDB (repdb.co)](https://repdb.co), sub RepDB Free Tier License v1.0. Imaginile din `apps/web/public/exercitii/` nu fac parte din licența codului și nu pot fi redistribuite separat de aplicație.
