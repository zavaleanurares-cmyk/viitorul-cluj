# Decizii — modulul „Administrare”

Rute: `/administrare`, `/administrare/conturi` (+ `/conturi/grupa`), `/administrare/grupe`, `/administrare/stari`, `/administrare/club`, `/administrare/audit` (+ `/audit/export`), `/administrare/gdpr` (+ `/gdpr/export/[id]`). Componente: `components/admin/`. Texte: `messages/ro/admin.ts`. Documentul pentru club: `GDPR.md`, la rădăcină.

Tot modulul este doar pentru rolul `physio`: `requireRole("physio")` în `administrare/layout.tsx` și în fiecare pagină, `run({ roles: ["physio"] })` în fiecare acțiune, verificare de rol în cele două rute de export.

## Abateri de la cerință (hotărâte de mine)

- **Profilurile nu se scriu cu `createServiceDb()`**, deși cerința o indica. Se scriu cu clientul preparatorului, sub RLS (`profiles_write` permite asta doar în clubul lui). Câștig: baza de date refuză alt club chiar dacă acțiunea ar avea un defect, iar jurnalul de audit arată cine a creat sau a șters contul (cu cheia de serviciu ar fi apărut „Sistem”). Modulul nu folosește deloc `createServiceDb()`.
- **Funcțiile de cont din `@club/db`** (`createUser`, `setUserEmail`, `setUserDisabled`, `deleteUser`, `createOneTimeToken`) nu trec prin RLS. Înaintea fiecărui apel, `targetProfile()` (`components/admin/server.ts`) citește contul cu identitatea preparatorului și compară explicit `club_id` cu `ctx.club.id`.
- **La anonimizare, contul jucătorului este dezactivat și își pierde adresa de e-mail** (`anonimizat-<id>@anonim.invalid`), nu doar dezactivat. Altfel adresa reală a jucătorului sau a părintelui ar fi rămas în `app_auth.users`. Contul apare în listă cu starea „Anonimizat” și poate fi doar șters.
- **Anonimizarea și ștergerea se pot face doar** pentru un jucător inactiv sau pornind de la o cerere a lui. Pentru un jucător activ fără cerere, întâi i se dezactivează fișa. Este o piedică voită împotriva greșelilor.
- **Stările implicite nu pot fi dezactivate**, nu doar codurile lor nu se schimbă: importul și starea dată unui jucător nou se bazează pe ele.
- **Dezlegarea contului de jucător îl și dezactivează** (fără fișă nu are ce să arate). Am adăugat și operațiunea inversă, „Leagă”, care îl reactivează.
- **Rolul unui cont de jucător nu se poate schimba** în rol de staff și invers; se creează un cont nou.
- **Pagina GDPR nu are file**: cele trei secțiuni (cereri, consimțăminte, păstrare) stau una sub alta, cu patru cifre sus. Ar fi fost al doilea rând de file sub cel al administrării.

## Migrarea `20261007130000_administrare_conturi_gdpr.sql`

A fost necesară din trei motive:

1. **`admin_accounts()`** — starea conturilor (parolă aleasă sau nu, dezactivat, ultima autentificare, link valabil). Tabelele `app_auth` nu pot fi citite de rolurile aplicației, iar `getUser()` ar fi însemnat câte o interogare pe cont. Funcția întoarce doar aceste câmpuri, doar pentru clubul preparatorului.
2. **`log_event`** accepta doar LOGIN / EXPORT / DOWNLOAD / CONSENT. Am adăugat INVITE, RESET, ANONYMIZE, ERASE (doar pentru preparator) și posibilitatea de a trece `entity_id` prin `p_details`.
3. **Ștergerea nu era reală.** Triggerul de audit păstrează valorile vechi în `details`, deci după anonimizare sau ștergere numele, diagnosticul și telefonul rămâneau în `audit_log`. Acum:
   - `private.scrub_player_traces` înlocuiește `details` cu lista câmpurilor atinse și șterge notificările care purtau numele jucătorului;
   - `anonymize_player` (redefinită) curăță în plus notele din antropometrie și teste, datele din alerte, acordurile și notificările contului;
   - `erase_player` (nouă) face ștergerea definitivă și întoarce id-ul contului de șters din `app_auth`.

După migrare am rulat `npm run db:types` (fișierul generat `packages/shared/src/database.types.ts` s-a schimbat) și `npm run test:rls`: 162 de verificări trecute.

## Fișier comun atins

- **`apps/web/src/lib/theme.ts`**: tema clubului nu se aplica deloc. `--color-brand` este declarată pe `:root` ca `var(--club-primary, #12305a)`; acolo `--club-primary` nu există, deci valoarea se rezolva la bleumarinul implicit și se moștenea așa. Club Demo, cu verde în baza de date, apărea bleumarin. `clubThemeStyle` setează acum și `--color-brand`, `--color-brand-ink`, `--color-accent` direct pe elementul cu tema. Fără asta, cerința „schimbi culoarea → se vede în navigație” nu putea fi îndeplinită.

## Alte decizii

- **Stare „Invitat”** = utilizatorul nu are parolă (`app_auth.users.password_hash` gol) sau `profiles.must_change_password`.
- **Linkuri**: invitația este valabilă 7 zile, resetarea trimisă de preparator 24 de ore. Un link nou îl anulează pe cel vechi. Linkul apare o singură dată, în fereastra de după creare; nu se poate reciti, se generează altul.
- **Butonul de acces** trimite invitație dacă parola nu a fost aleasă și link de resetare altfel.
- **Ultimul preparator**: un preparator nu își poate schimba rolul dacă nu mai există altul activ; nu își poate dezactiva sau șterge propriul cont niciodată.
- **Crearea în masă**: rândurile se procesează pe rând; unul greșit nu le oprește pe celelalte. Lista de linkuri se poate copia sau descărca CSV (generat în browser, nu trece din nou prin server).
- **E-mailul contului** se normalizează la litere mici.
- **Grupe**: dezactivarea este refuzată cât timp grupa are jucători activi; ștergerea este oferită doar pentru o grupă fără niciun jucător (activ sau plecat).
- **Stări**: codul se generează din etichetă (`CONVOCAT_LA_LOT`) și nu se mai schimbă; ștergerea este oferită doar pentru o stare care nu apare nici la jucători, nici în istoric.
- **Setările clubului**: se scrie obiectul complet, validat cu zod; cheile necunoscute formularului (eventual adăugate de alte module) se păstrează.
- **Sigla**: `branding/<club_id>/sigla-<timp>.<ext>`; acțiunea verifică forma căii, iar fișierul vechi este șters.
- **Avertizări de culoare**: contrast text/culoare sub 4,5:1 și culoare prea deschisă pe fond alb (sub 3:1, pentru pictograma activă din meniul de pe telefon). Am rescris local calculul de luminanță (`components/admin/color.ts`), pentru că `lib/theme.ts` nu îl exportă.
- **Jurnal**: filtrele stau în URL, într-un formular GET. Valorile se afișează cu etichete în română, iar câmpurile tehnice sunt ascunse. Exportul CSV folosește `;` și BOM (se deschide corect în Excel cu setări românești), cel mult 20 000 de rânduri, și se jurnalizează el însuși.
- **Etichetele acțiunilor și entităților noi** (INVITE, RESET, ANONYMIZE, ERASE, `auth`, `audit_log`) stau în `messages/ro/admin.ts`, pentru că `AUDIT_ACTIONS` și `AUDIT_ENTITIES` sunt în pachetul comun, pe care nu l-am modificat.
- **Retragerea acordului** setează `withdrawn_at` pe toate acordurile active ale jucătorului. Nu oprește prelucrarea de către staff (vezi `GDPR.md`, secțiunea 5).

## Ce a rămas nefăcut

- Autentificare în doi pași, antet `Content-Security-Policy`, listă de sesiuni active — în afara modulului; sunt trecute ca limite în `GDPR.md`.
- Ștergerea automată la expirarea perioadei de păstrare: aplicația doar listează.
- Rapoartele de import (`imports.report`) nu sunt curățate la anonimizare; pot conține nume.
- La ștergerea unui cont de staff, rândul de ștergere din jurnal păstrează numele și e-mailul contului.
- După anonimizarea unui jucător cu cont rămâne un cont gol, „Cont anonimizat”, de șters manual din Conturi.
- Filtrele jurnalului ocupă mult loc pe telefon (șase câmpuri înaintea listei).
- Cardul unei grupe arată și antrenorii cu contul dezactivat; în fereastra de editare sunt marcați „cont dezactivat”.
- Nu am testat trimiterea reală de e-mailuri (Resend nu este configurat local): am verificat doar ramura „linkul nu a fost trimis pe e-mail”.
- Nu am testat depozitul Vercel Blob: încărcarea siglei și ștergerea documentelor au fost verificate doar pe depozitul local de dezvoltare.
