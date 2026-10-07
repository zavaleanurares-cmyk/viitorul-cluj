# Decizii — modulul „Jucător”

Rute: `/azi`, `/chestionar`, `/plan`, `/exercitii/[id]`, `/profil` (+ `/profil/export`). Componente: `components/player/`. Texte: `messages/ro/player.ts`.

## Punct de plecare

- Codul parțial din runda întreruptă a fost păstrat aproape integral: l-am citit, l-am rulat pe conturile demo și am reparat ce nu mergea sau arăta rău (lista de mai jos, „Ce am schimbat”).
- După trecerea de pe Supabase: încărcarea fotografiei (`uploadFile` → `PUT /api/files/avatars/…` → RPC `set_my_photo`) și exportul (`export_player_data`) funcționează pe noul stack; am înlocuit `signedUrl` (rămas doar pentru compatibilitate) cu `fileUrl`.

## Decizii de produs

- **`/azi`**: ordinea este stare → chestionar → exerciții → efort (RPE). Chestionarul se completează dimineața, RPE după antrenament, de aceea RPE stă la sfârșit.
- **Bifa**: un singur tap, optimist (`useOptimistic`); dacă salvarea eșuează, bifa revine singură și apare mesajul „Nu s-a salvat. Atinge din nou bifa.” sub exercițiu + toast. Cât timp se salvează, bifa are un inel care se rotește și nu acceptă al doilea tap.
- **Debifarea** păstrează rândul din `exercise_completions` cu `done = false` (nu îl șterge), ca să nu se piardă comentariul și durerea notate.
- **Comentariu / durere**: într-un `Dialog` separat de bifă (butonul cu pictograma de mesaj). Salvarea lor nu schimbă bifa; bifarea nu le șterge. Durerea cere intensitate 1–10. Alerta către preparator o ridică triggerul din baza de date.
- **Detaliile exercițiului**: link către `/exercitii/[id]?inapoi=…` (nu expandare în loc) — lista rămâne scurtă, iar clipul are tot ecranul. `inapoi` acceptă doar căi interne.
- **Acțiunile de bifare** nu au încredere în browser: verifică pe server că exercițiul este al jucătorului (planul lui, respectiv un program alocat lui) și citesc bifa existentă din baza de date. Fereastra de bifare (azi + ultimele 2 zile) este verificată și în acțiune, și de RLS.
- **RPE**: doar pentru azi (RLS permite și ieri; nu am oferit asta în interfață, ca ecranul să rămână simplu). Tipuri: antrenament și meci, câte o înregistrare pe tip pe zi; a doua salvare corectează. Durata are butoane rapide (45 / 60 / 75 / 90 / 120).
- **Chestionar**: data vine de pe server (`ctx.today`), niciodată din browser. Zona dureroasă este pliată; fluxul fără durere = 2 atingeri + „Salvează”. Întrebările suplimentare active pe grupă sunt obligatorii (mai puțin „Ore dormite”, opțional). Bara cu butonul de salvare este fixă deasupra navigației pe telefon.
- **`/plan`**: săptămâna luni–duminică, ziua în `?zi=`. Pentru zilele viitoare lista este doar de citit, fără bife și fără progres; pentru zilele mai vechi de 2 zile se vede ce a fost bifat, fără editare.
- **`/profil`** are file în URL (`?sectiune=`): jucător — „Fișa mea”, „Evoluție”, „Cont”, „Datele mele”; staff — „Cont”, „Datele mele”. „Evoluția mea” stă aici (`?sectiune=evolutie&zile=28`), nu am făcut rută separată `/evolutie`.
- **Telefonul jucătorului** se editează într-un singur loc (datele de contact) și este copiat și pe cont (`update_my_profile`); în fila „Cont” jucătorul nu are câmp de telefon.
- **Datele părintelui** apar și se salvează doar pentru minori; la adulți rămân neatinse.
- **Fotografia**: redimensionată în browser la max. 512 px, JPEG; calea `<player_id>/foto-<timp>.jpg`. La schimbare sau ștergere, fișierul vechi este șters din depozit.
- **Cereri GDPR**: doar se înregistrează în `data_requests`; le rezolvă preparatorul. „Retrage acordul” NU setează singur `consents.withdrawn_at` (altfel utilizatorul ar fi blocat imediat pe ecranul de consimțământ, înainte ca clubul să apuce să răspundă). O singură cerere deschisă de fiecare fel; „Cere corectarea” cere un mesaj.
- **Exportul** este un link către `/profil/export` (handler de rută care apelează RPC-ul și întoarce JSON ca atașament), ca descărcarea să meargă și pe telefon. Conturile fără fișă de jucător primesc profilul și consimțămintele.
- **Încărcarea pe 28 de zile** se arată pe săptămâni (4 bare), nu pe zile: 28 de bare nu se pot citi pe telefon.
- **Aderența** = exerciții bifate / exerciții programate în ultimele 28 de zile, pe programe + planuri personalizate.
- **Teste fizice**: ultimul rezultat, cel anterior și media grupei; media lipsește când grupa are sub 3 jucători cu rezultate (regula din RPC).

## Ce am schimbat față de codul găsit

- `fileUrl` în loc de `signedUrl` (exercițiu, fotografie).
- Rândul de exercițiu: fără coloana separată pentru săgeată (numele se rupea pe 3–4 rânduri la 390 px); săgeata este acum lipită de doză.
- „Evoluție”: pagina avea 6 px de derulare orizontală pe telefon. Cauza este tabelul `sr-only` din `components/charts` (un `<table>` nu respectă lățimea de 1 px). Am rezolvat local, punând graficele într-un container `relative overflow-hidden`. **Defectul rămâne în componenta comună** și va apărea la oricine folosește graficele pe telefon.
- „Evoluție”: cele trei cifre de sus nu mai folosesc `Stat` (eticheta „Chestionare” nu încăpea); etichetele de pe axa graficului săptămânal se suprapuneau.
- Mesajele de eroare rămâneau pe ecran după ce jucătorul corecta răspunsul (chestionar, RPE, comentariu). Acum dispar la primul răspuns nou.
- Zilele viitoare din `/plan` afișau „0 din 7 făcute”; eticheta „Gata pe azi” apărea și pe zile trecute (acum „Toate făcute”).
- Cardul „Chestionar completat” de pe `/azi` se rupea urât pe telefon.

## Interogări scrise local (nu există în `@club/shared`)

`components/player/queries.ts`: `listRpe`, `getContact`, `listMyRequests`, `getMyConsent`, `getPlayerAdherence`, `getPlayerTests`, `canTickOn`, `isIsoDate`. Bune de mutat în `@club/shared` când se construiește aplicația nativă.

## Observații pentru alte module

- `getPlayerDay` (shared) citește toate bifele jucătorului, fără filtru de dată; la un jucător cu un sezon de istoric merită restrâns.
- Paginile `/tablou`, `/wellness`, `/planuri`, `/administrare`, `/notificari` erau încă `Stub` fără verificare de rol la data testelor: un jucător care le deschide vede „Această secțiune este în lucru”, nu este redirecționat. `/jucatori` și `/disponibilitate` redirecționează corect.
- Bara de jos a antrenorului are 5 intrări și „Disponibilitate” atinge marginea la 390 px (componenta de shell).

## Rămas nefăcut

- Fără mod offline (coadă de bife salvate local); la conexiune căzută jucătorul vede eroarea și reîncearcă.
- Dacă încărcarea fotografiei reușește, dar legarea de fișă eșuează, fișierul rămâne orfan în depozit.
- `/evolutie` ca rută separată.
- RPE pentru ziua de ieri; tipul „altceva”.
