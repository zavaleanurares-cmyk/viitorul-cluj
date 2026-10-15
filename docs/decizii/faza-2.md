# Faza 2 — Lot, Program, Azi, prezența offline, centrul meciului, importul din listele federației

Cod: `apps/web/src/app/(app)/lot/`, `apps/web/src/app/(app)/program/`, `apps/web/src/app/(app)/azi/`, componentele din `components/squad`, `components/schedule`, `components/match`, `components/today`; texte în `messages/ro/{squad,schedule,today,match}.ts`; migrări `db/migrations/20261015100000…20261015100900_lr_*.sql`; test de acces `scripts/test-rls-lot.ts`.

## Modelul de date

- **Un singur „eveniment”** (`events` + `event_teams` + `event_series`): antrenament, meci, rezervare de teren, ședință, altceva. Meciul este un eveniment cu un rând în `matches` (cheia este `event_id`). Orele se țin ca `timestamptz`; seriile se generează în fusul clubului (`Europe/Bucharest` implicit), deci trecerea la ora de vară nu mută antrenamentele.
- **Echipele rămân tabelul `groups`** din Vestiar (în interfață: „echipe”), cu câmpuri noi: sezon, program, ani de naștere, gen, jucători pe teren, durata reprizei, culoare. Nu am introdus `team_memberships`: un jucător are o singură echipă (`players.group_id`). Jucătorii „împrumutați” la altă echipă se pot convoca la meci (vezi mai jos), fără a-și schimba echipa.
- **Conturi în mai multe cluburi** (`memberships`): profilul ține contextul curent (club + rol); `switch_membership` îl schimbă. Echipele antrenorului (`staff_groups`) rămân la schimbare; `my_group_ids` le filtrează pe clubul curent.
  - Schimbarea rolului dintr-un profil închide rolul vechi. Dezactivarea rolului curent mută contul pe următorul rol activ sau, dacă nu are, dezactivează contul.
  - Administrarea nu poate prelua un cont care are roluri active în alt club (mesaj explicit).
- **Roluri noi**: administrator, secretariat, contabil, părinte. Biroul = administrator, secretariat, director sportiv, preparator fizic (`private.is_office`).
- **Părinții** (`guardians` + `guardian_players`) au fost completați din `player_contacts`. Un părinte se poate lega doar de copii din clubul lui.

## Decizii

- **Amânate**: CNP-ul jucătorului, `team_memberships`, înscrierile și tot ce ține de bani (taxe, plăți). Operatorul de plăți se alege mai târziu; faza de bani pornește de la `guardian_players.is_billing`.
- **Pagina GDPR** (export, anonimizare) rămâne doar la preparatorul fizic, ca în Vestiar.
- **Starea medicală** (disponibil / accidentat, zona, revenirea) o schimbă doar preparatorul fizic. Este impus și în baza de date (`players_status_guard`), pentru că directorul sportiv și biroul pot modifica acum fișa de lot.
- **Patronul** nu vede rânduri individuale de prezență, loturi de meci, suspendări sau fișa staff-ului. Vede doar cifrele din Tablou.
- **Ce programează antrenorul**: antrenamentele, ședințele și meciurile amicale încă nejucate ale echipelor lui. Le poate și modifica sau anula. Meciurile din competiții (venite din listele federației), rezervările de teren și evenimentele comune cu alte echipe rămân la birou. Regula e impusă în `save_event` / `set_event_state` (`private.coach_manages_event`), iar interfața ascunde ce nu poate face.
- **Notele de meci** stau în `match_ratings`, vizibile doar staff-ului (nu jucătorului, nu părintelui).
- **Eligibilitatea la meci** (viză medicală, accidentare, suspendare) se verifică pentru fiecare jucător trimis în lot, inclusiv pentru cei din altă echipă. Detaliul accidentării se vede doar de cine conduce meciul, de preparator și de director.
- **Suspendări**:
  - Amicalele nu suspendă.
  - Roșu sau două galbene în același meci înseamnă o suspendare.
  - Galbenele se cumulează pe competiție și suspendă la fiecare multiplu al pragului.
  - Etapa se consideră ispășită când jucătorul lipsește din lotul unui meci al echipei lui, din aceeași competiție.
  - Redeschiderea unui meci anulează și suspendările generate, și etapele ispășite în el.
- **Minutele jucate** se opresc la durata regulamentară (2 × repriza); o schimbare în prelungiri nu dă minute în plus.

## Prezența offline

- Ecranul `/program/<id>/prezenta` se poate deschide fără semnal. Service worker-ul păstrează doar aceste pagini (fără diagnostic), iar pagina „Azi” a antrenorului le pregătește dinainte.
- Paginile păstrate se șterg la orice ieșire din cont: meniul, profilul, consimțământul sau o sesiune expirată. Ecranele de autentificare trimit „clear-pages” la deschidere.
- Salvarea trece printr-o coadă în IndexedDB, **pe utilizator**: pe un telefon folosit de doi oameni, prezența unuia nu pleacă cu sesiunea celuilalt.
- **Se trimit doar rândurile atinse de antrenor**, fiecare cu ora atingerii, plus rândurile încă negăsite pe server, cu ora deschiderii paginii. `save_attendance` păstrează varianta cea mai nouă pe fiecare rând, deci o listă deschisă de mult nu șterge o corectură făcută între timp de birou. Verificat cap-coadă cu Playwright.
- După 5 refuzuri ale serverului (nu lipsă de semnal), coada nu mai reîncearcă singură. Ecranul și „Azi” arată eroarea și butonul „Trimite acum”.

## Ce nu acoperă încă

- **Centrul meciului cere semnal**: evenimentele de meci nu trec prin coada offline. La teren fără semnal se notează pe hârtie și se introduc după.
- **Paginile de Performanță** (moștenite din Vestiar) și ecranul de consimțământ folosesc încă rândurile cu bordură stânga. Le refacem în faza în care trecem Performanța pe noul sistem vizual.
- **Importul din listele federației** lucrează pe tabel lipit sau fișier (CSV/Excel), cu mapare de coloane. Nu citește direct site-urile FRF/AJF.
- **Invitația părintelui**:
  - Un cont nou primește link de activare.
  - Un cont existent primește doar rolul de părinte, fără link nou.
  - Un e-mail de invitație va veni odată cu operatorul de e-mail.
