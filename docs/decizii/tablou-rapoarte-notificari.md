# Decizii — tablouri de bord, rapoarte, notificări, sarcini programate

## Tabloul de bord (`/tablou`)

- **Patron și director sportiv**: pagina afișează exclusiv rezultatul RPC-ului `club_overview()` (agregate). Nu se face nicio altă interogare pentru aceste roluri, deci în HTML nu are cum să ajungă un nume sau un diagnostic.
- **Preparator**: întâi „De făcut azi” (alerte, chestionare, reveniri, vize, aderență, de verificat, GDPR), apoi aceleași cifre de ansamblu. La încărcare se apelează `refresh_daily_alerts`.
- **Antrenorul** nu are capabilitatea `viewOverview`: `requireCapability` îl trimite la `/disponibilitate`. (RPC-ul l-ar lăsa să vadă agregatele grupelor lui; nu i le arătăm, conform cerinței.)
- **Bara de disponibilitate** (club și grupe) este HTML, nu grafic Recharts: bară stivuită orizontală în culorile `AVAILABILITY_COLORS`, cu spațiu de 2 px între segmente și cifrele scrise sub ea (pătrat de culoare + text). `components/charts` nu a fost modificat.
- **Tendința pe 12 săptămâni**: `StackedBarsChart` cu numărul de jucători pe fiecare stare (nu doar procentul), plus o propoziție cu procentul curent și diferența față de prima săptămână. Săptămânile fără istoric (total 0) nu se desenează; sub două săptămâni cu date apare un text explicativ (cazul Viitorul Cluj, unde istoricul începe la import).
- **Accidentări pe luni**: lunile sezonului fără accidentări apar cu zero. Dacă în sezon nu există nicio accidentare, cele două grafice sunt înlocuite de un singur card cu mesaj.
- **Reveniri apropiate**: jucători cu `status_return_on` ≤ azi + 7 zile **și** o stare care nu este „disponibil complet” (o dată de revenire rămasă pe un jucător deja APT nu este o revenire de urmărit).
- **Chestionare lipsă azi**: se numără toți jucătorii activi ai grupei, nu doar cei cu cont (la Viitorul Cluj nimeni nu are încă un cont; chestionarele pot fi introduse și de staff).
- **Aderența pe 7 zile**: calculată cu `assignmentAdherence` din `components/planning/adherence.ts` (nerescris), pornind fereastra de la `max(începutul alocării, azi − 6)`. „Sub 50%” numără doar jucătorii care au avut cel puțin o zi programată în fereastră.
- **Alerte**: primele 8, restul cu `?alerte=toate` (starea stă în URL). Nu există aici buton de „rezolvat” — alertele se închid din ecranele modulului de chestionare / din fișa jucătorului.
- **De verificat**: jucătorii duc la `/disponibilitate?grupa=toate&filtru=verificare`; chestionarele la `/wellness` (modulul de chestionare decide cum le filtrează).
- Culorile de serie din „accidentări pe zone / luni” sunt cele implicite ale `BarsChart` (o singură serie → o singură culoare).

## Rapoarte (`/rapoarte`)

- Trei exporturi, toate rute GET cu parametri în URL: `rapoarte/jucator/[id]` (PDF), `rapoarte/grupa/[id]?saptamana=AAAA-LL-ZZ&format=pdf|xlsx`, `rapoarte/jucatori?grupa=<id>|toate` (Excel).
- **Acces**: doar preparatorul. Fără sesiune → redirecționare la autentificare; orice alt rol (inclusiv cont cu parola sau consimțământul neterminate) → 403 text. Datele se citesc cu clientul utilizatorului (RLS): un jucător sau o grupă din alt club → 404.
- **Jurnal**: fiecare descărcare scrie `log_event('EXPORT', …)` cu entitatea `fisa` / `raport_saptamanal` / `lista_jucatori`. `AUDIT_ENTITIES` (în `packages/shared`, nemodificat) are etichetă doar pentru `fisa`; celelalte două apar în jurnal cu numele tehnic până li se adaugă eticheta.
- **PDF**: `pdf-lib` + `@pdf-lib/fontkit`, cu un mic motor de paginare propriu (`components/reports/pdf.ts`): tabele cu text pe mai multe rânduri, antet de tabel repetat pe pagina următoare, subsol „Pagina X din Y”.
- **Font**: Atkinson Hyperlegible Next (același ca în aplicație; licență OFL, `fonts/OFL.txt`). Fișierele TTF statice (400 și 700) au fost generate o singură dată cu `fontTools` din WOFF2-ul variabil din `@fontsource-variable` (subseturile latin + latin-ext unite). Se încorporează cu `subset: true` — **fără subsetare pdf-lib scrie greșit lățimile glifelor** (spații late între litere), verificat vizual.
- **Fontul în build**: se citește cu `fs.readFile(path.join(process.cwd(), "src/components/reports/fonts/…"))` (cu o a doua cale de rezervă pentru pornirea din rădăcina monorepo-ului), iar `next.config.ts` are `outputFileTracingIncludes: { "/rapoarte/**": ["./src/components/reports/fonts/*.ttf"] }`. **Neverificat pe Vercel** (aici nu se rulează `next build`): la primul deploy trebuie descărcat un PDF; dacă fontul lipsește, ruta răspunde 500 cu mesaj în jurnalul funcției.
- Caracterele care nu există în font (emoji etc.) apar ca „?”; `ş/ţ` cu sedilă se transformă în `ș/ț`.
- **Fișa jucătorului** nu include datele de contact (telefon, e-mail, tutore) — nu sunt necesare într-un document medical care circulă; se pot adăuga ușor dacă clubul le vrea. Include jucătorii inactivi (se pot alege din listă, marcați „inactiv”). Istoricul stărilor: ultimele 25 de schimbări; antropometrie: ultimele 8 măsurători; teste: ultimul rezultat la fiecare test + media grupei (RPC `group_test_averages`, care ascunde mediile sub 3 jucători).
- **Raportul săptămânal** este pe orizontală (grila de chestionare are 9 coloane). „Disponibilitatea” este cea de **azi**, nu cea de la sfârșitul săptămânii alese (istoricul pe zile ar cere altă interogare; antetul secțiunii spune data). „Cine nu a completat” numără doar zilele deja trecute din săptămână. Aderența săptămânii folosește aceeași funcție `playerAdherence`, pe fereastra luni–duminică (până azi), pe toate alocările active ale jucătorului.
- **Excel**: `write-excel-file` (API-ul 4.x, `toBuffer()`), foi separate „Disponibilitate”, „Chestionare”, „Accidentări” și, în plus față de cerință, „Aderență”. Datele calendaristice sunt celule de tip dată.
- Săptămâna cerută trebuie să fie între un an în urmă și săptămâna viitoare; altfel 400.
- Refolosite din alte module (doar citire, fără modificări): `planning/adherence.ts`, `planning/queries.ts` (`listPlayerAssignments`, `listPlayerProgramCompletions`), `players/queries.ts` (`listInjuries`, `listStatusHistory`, `listAnthropometrics`), `players/domain.ts`.

## Notificări (`/notificari`)

- Lista ultimelor 100 de notificări, necitite sus. Fiecare notificare este un link simplu către `notificari/[id]` (rută GET): o marchează citită și redirecționează la `link`. Am ales o rută în loc de acțiune ca să meargă fără JavaScript și fără preîncărcare (un `<Link>` preîncărcat ar marca notificarea citită fără să fie deschisă).
- `link` se acceptă doar dacă este cale internă (`/…`, nu `//…`). Linkurile scrise de triggere (`/azi`, `/chestionar`, `/plan?zi=…`, `/profil`, `/disponibilitate`, `/jucatori/<id>`) duc toate la pagini existente (verificat în cod; `/chestionar` și `/profil` și prin click).
- Clopoțelul din antet nu a fost atins.

## Sarcini programate (`/api/cron`)

- GET cu `Authorization: Bearer <CRON_SECRET>` (comparație în timp constant); altfel 401. Fără `CRON_SECRET` setat, ruta răspunde mereu 401.
- Pași, fiecare independent (o eroare într-unul nu îi oprește pe ceilalți; răspunsul devine 500 și spune care): `refresh_daily_alerts` → `send_wellness_reminders` → e-mail-rezumat → curățenie.
- **E-mail**: un singur mesaj pe utilizator pe rulare, pentru notificările **necitite**, netrimise, din ultimele 24 h, doar dacă `profiles.email_notifications` este pornit și profilul are e-mail. Textul NU folosește titlul din baza de date (acela poate conține nume și stări, ex. „POPESCU: ACC”), ci un titlu neutru pe tip de notificare („Alertă nouă (3)”, „Plan nou”, „Stare actualizată în grupa ta”). Fără nume în salut. Cel mult 200 de e-mailuri pe rulare. Dacă e-mailul nu este configurat, pasul se sare și `emailed_at` rămâne gol.
- **Curățenie**: sesiuni expirate, linkuri de unică folosință expirate de peste 7 zile, încercări de autentificare mai vechi de 2 zile (aceleași reguli ca în `packages/db/src/auth.ts`, unde se fac „din când în când” la autentificare; nu există o funcție exportată, deci interogările sunt directe prin `getPool()`), notificări citite de peste 90 de zile.
- Push (tabelul `push_tokens`) nu se trimite de aici: ține de versiunea nativă.

### Limitarea planului Vercel Hobby

- Pe Hobby un cron poate rula **cel mult o dată pe zi**, iar ora este aproximativă (rularea pornește oricând în ora indicată). O expresie mai deasă face ca deploy-ul să eșueze. (Din ce știu despre documentația Vercel; pagina `vercel.com/docs/cron-jobs/usage-and-pricing` nu a putut fi deschisă din mediul de lucru — de reverificat înainte de lansare.)
- `vercel.json` are două intrări zilnice pe aceeași rută: `0 7 * * *` și `0 17 * * *` (UTC).
  - Am mutat rularea de dimineață de la 6:00 la **7:00 UTC**: 7:00 UTC = 10:00 vara / 9:00 iarna în România. La 6:00 UTC, iarna ar fi fost 8:00 — înainte de ora implicită de memento (9), deci mementoul nu ar mai fi plecat dimineața.
  - 17:00 UTC = 20:00 vara / 19:00 iarna: a doua șansă pentru memento și e-mailul cu notificările zilei.
- Consecință: „memento la oră configurabilă” devine, pe planul gratuit, **„memento la prima rulare de după ora configurată”**. O grupă cu `reminder_hour` 14 primește mementoul la rularea de seară. Jucătorul vede oricum cardul „Chestionarul de azi” pe `/azi` când deschide aplicația.
- Pe un plan plătit (Pro): se înlocuiesc cele două intrări cu una orară, `{ "path": "/api/cron", "schedule": "0 * * * *" }`. Codul nu trebuie schimbat: mementoul are cheie de deduplicare pe zi, alertele și e-mailurile sunt idempotente.

## Fișiere comune atinse

- `apps/web/next.config.ts`: adăugată cheia `outputFileTracingIncludes` (o singură intrare, pentru fonturile PDF).
- `apps/web/vercel.json`: adăugat `crons`.
- Nicio migrare nouă. Nimic modificat în `packages/*`, `components/ui`, `components/charts`, `lib`.

## Rămas pe dinafară

- Trimiterea reală de e-mail prin Resend nu a fost testată (fără cheie în mediul local); pasul a fost testat cu apelul către Resend interceptat.
- Raportul săptămânal nu reconstituie disponibilitatea istorică a săptămânii alese (vezi mai sus).
- Exportul PDF al tabloului patronului nu există (nu a fost cerut); pagina se poate tipări din browser.
- Rapoartele nu au grafice, doar tabele.
