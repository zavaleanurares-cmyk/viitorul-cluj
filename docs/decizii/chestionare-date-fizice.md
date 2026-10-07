# Decizii — chestionare (vederea de staff) și date fizice

Modul: `/wellness`, `/fizic` (+ `sesiuni/[id]`, `sesiuni/nou`, `sesiuni/[id]/modifica`, `teste`, `teste/rezultate`), filele „Chestionare" și „Date fizice" din fișa jucătorului.

## Chestionare

- **Vederea implicită.** Fără parametri, pagina arată grila săptămânii pe ecran lat și lista zilei de azi pe telefon (ambele sunt randate, una e ascunsă din CSS — serverul nu știe lățimea ecranului). `?saptamana=<zi>` forțează grila pe orice ecran (prima coloană fixă, derulare orizontală); `?zi=<zi>` forțează lista zilei. `?grupa=`, `?interval=7|28`, `?alerte=club` completează starea din URL.
- **Celula grilei.** Două cifre (O = oboseală, Î = încărcătură) + zona dureroasă dedesubt, doar dacă există; rândul rămâne pe o singură linie când nimeni nu are durere. Punctul = necompletat; zilele din viitor rămân goale. Ultimul rând: media grupei pe zi.
- **Zona dureroasă la rândurile importate**: în grilă se afișează cuvântul din tabelul clubului (`raw.pain`: „hamstring", „Knee"), ca grila să arate ca tabelul lor; în fișa jucătorului apare zona de pe harta corpului, cu textul original dedesubt. La rândurile din aplicație: zona prescurtată + partea („Adductori dr.") + intensitatea.
- **Pragurile** vin din `ctx.settings.alerts`; `ScoreCell` colorează roșu de la prag în sus și galben pal cu două trepte sub prag (comportamentul componentei comune).
- **„De verificat".** Celula are fond portocaliu pal + pictogramă; sub grilă există un card cu nota de import și valorile originale (`raw`), cu butonul „Corectează". La salvare `needs_review = false`, `review_note = null`; `raw` rămâne (istoric).
- **Corectare / introducere de către preparator.** O singură fereastră (oboseală, încărcătură, zonă + parte, intensitate, notă; ștergere în doi pași). Un rând existent își păstrează `source` (aplicație / import); un rând nou are `source = 'staff'`. Scalele pot fi lăsate goale (apăsând din nou pe valoarea aleasă), pentru că importul clubului are zile doar cu oboseală; se cere măcar una dintre oboseală / încărcătură / durere. Nu se pot introduce chestionare pentru zile din viitor sau mai vechi de doi ani. Întrebările suplimentare (somn, stres, dispoziție) nu se editează din fereastră — se afișează doar.
- **Consecință a triggerului existent:** corectarea unui rând cu `source = 'import'` nu generează alerte (triggerul sare peste importuri); un rând introdus de preparator generează alerte ca unul din aplicație, inclusiv pentru zile trecute. Ștergerea unui chestionar nu șterge alertele deja create pentru acea zi (se închid cu „Marchează rezolvată").
- **Cine nu a completat azi**: jucătorii activi ai grupei fără chestionar azi, cu eticheta „fără cont" unde `players.user_id` lipsește. Lista se referă mereu la ziua curentă, indiferent de săptămâna afișată; pe telefon, în vederea zilei de azi, este ascunsă (lista zilei arată același lucru).
- **Rata de completare a săptămânii** = chestionare completate / (jucători activi × zilele scurse din săptămână, toate cele 7 pentru săptămânile trecute). Zilele libere nu sunt excluse (aplicația nu știe care sunt).
- **Alerte**: lista celor deschise pe grupa aleasă, cu link „Tot clubul"; sortate după severitate, apoi dată. Preparatorul le închide (`resolved_at`, `resolved_by`). `refresh_daily_alerts` se apelează la fiecare încărcare a paginii de către preparator, cum cere specificația.
- **Grafice pe grupă**: se termină în ultima zi a săptămânii afișate (sau azi, dacă săptămâna e cea curentă). La 28 de zile rata de completare este pe săptămâni (28 de bare nu se pot citi pe telefon).
- **RPE**: tabel jucător × zi cu sRPE însumat pe zi (detaliul „RPE × minute" în `title`), totalul săptămânii și media grupei.
- **Tipărire**: doar antetul și un tabel alb-negru cu trei coloane pe zi (O, Î, zonă), A4 pe lat; valorile peste prag sunt îngroșate și subliniate.
- **Fișa jucătorului**: interval 7 / 28 / 90 de zile (`?interval=`). Linia de prag din grafic este pragul de oboseală (dacă pragurile diferă, eticheta o spune). Zilele cu durere apar ca listă de etichete sub grafic și, când există intensitate, ca a treia serie pe aceeași scară 1–10. Raportul acut:cronic se afișează doar când `acuteChronicRatio` întoarce o valoare; textul îl prezintă ca reper orientativ, fără praguri de „risc".

## Date fizice

- **Grupa unei sesiuni.** Lista arată sesiunile cu `group_id` = grupa aleasă și, în plus, sesiunile importate fără grupă în care au valori jucători ai grupei (altfel ar fi de negăsit). „Câți jucători au date" numără rândurile vizibile utilizatorului.
- **Sinteza** acoperă mereu ultimele 8 săptămâni (independent de filtrul listei): media pe jucător și sesiune a distanței totale și a distanței la viteză mare, pe săptămâni, plus topul vitezei maxime (primii 8). Pe telefon sinteza vine după listă.
- **Filtrul listei**: `?zile=7|28|90` (implicit 28). Am renunțat la un interval liber de date — presetările acoperă folosirea zilnică și încap pe telefon.
- **Tabelul sesiunii**: coloanele complet goale nu se afișează; cheile din `extra` (coloanele păstrate la import) apar ca atare, după indicatorii standard. Maximul coloanei: îngroșat, pe fond gri (nu o culoare de stare). Media = media jucătorilor care au valoare.
- **Sesiune manuală**: `source = 'manual'`; tabel cu un câmp pe indicator pentru jucătorii activi ai grupei (acceptă virgulă sau punct). La modificare, un rând golit complet se șterge; dacă rândul are coloane „extra" din import, se golesc doar indicatorii standard. Sesiunile importate pot fi și ele modificate (sursa rămâne). Limite de bun-simț pe valori (ex. viteză ≤ 45 km/h) ca o greșeală de tastare să nu ajungă în bază.
- Salvarea unei sesiuni face mai multe scrieri fără tranzacție comună (clientul de date nu are tranzacții între apeluri). Dacă scrierea valorilor eșuează la o sesiune nouă, sesiunea goală este ștearsă.
- **Teste**: clasamentul folosește ultimul rezultat al fiecărui jucător activ; diferența față de testarea anterioară și față de medie ține cont de `lower_is_better` („mai bine / mai slab" scris în cuvinte). Media grupei vine din `group_test_averages` (apare de la 3 jucători cu rezultat); lipsa ei este tratată ca text, nu ca eroare.
- **Introducerea unei testări** este o pagină (`/fizic/teste/rezultate?grupa=&test=&data=`), nu o fereastră: valorile deja salvate pentru ziua aleasă se precompletează; un câmp golit șterge rezultatul din acea zi. Schimbarea testului / datei reîncarcă pagina (valorile nesalvate se pierd — scrie în indicație).
- **Definirea testelor**: nume, unitate, „mai mic = mai bine"; codul se generează din nume. Testele nu se șterg din interfață, doar se dezactivează (rezultatele rămân; în fișa jucătorului apar cu eticheta „test dezactivat").
- **Fișa jucătorului**: sesiuni pe 4 / 8 / 16 săptămâni (`?saptamani=`), trei grafice separate (o singură axă pe grafic), tabel cu indicatorii care au valori, teste cu evoluție (`Sparkline`), comparații și istoricul rezultatelor (preparatorul poate șterge un rezultat). Antropometria nu este duplicată: link către fila „Sumar".

## Ce am scris local în loc de `@club/shared`

- `components/wellness/queries.ts`: `listRpeFor` (RPE pentru mai mulți jucători), `listOpenAlerts`, `listPlayerAlerts`.
- `components/physical/queries.ts`: sesiuni, indicatori, teste, rezultate, `groupAverages`.
- Folosesc, fără să le modific, componente ale altor module: `components/players/{print-button,confirm-dialog,queries(getPlayerForRequest)}` și `components/planning/nav-select`.

## Fișier comun atins

- `components/charts/index.tsx`: marginea stângă a graficelor a trecut de la `-18` la `-4` (trei locuri). Cu `-18`, etichetele de patru cifre ale axei Y erau tăiate („1000" apărea „000") — vizibil la sRPE și la distanțe. Nimic altceva nu s-a schimbat în fișier.

## Nefăcut / limite cunoscute

- Importul din fișier (K-Sport, teste) — alt modul; aici există doar butonul către `/import?tip=fizic`.
- Preparatorul nu poate introduce sau corecta RPE în locul jucătorului (nu a fost cerut; RPE-ul este doar afișat).
- Activarea întrebărilor suplimentare pe grupă (`groups.wellness_config`) nu se face de aici (ține de administrare); coloanele apar în fișa jucătorului când există valori.
- Etichetele valorilor din graficele cu bare folosesc punct zecimal („32.9") — componenta comună nu formatează; nu am modificat-o pentru asta.
- Antetul lipicios al tabelului de chestionare din fișa jucătorului nu rămâne fix la derularea pe verticală (tabelul are propria derulare orizontală).
- Nu există export Excel/PDF din aceste ecrane (rapoartele sunt alt modul); grila are doar varianta de tipărit.
