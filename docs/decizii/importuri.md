# Importuri — decizii și presupuneri

Modul: `/import` (doar preparatorul fizic). Cod: `apps/web/src/app/(app)/import/`, `apps/web/src/components/imports/`, texte în `apps/web/src/messages/ro/imports.ts`, migrare `db/migrations/20261007110000_importuri_teste.sql`.

## Structură

- `/import` — alegerea tipului (5 cartonașe) + istoricul importurilor. `/import?tip=sanatate|chestionar|lista|fizic|teste` deschide asistentul pentru acel tip. `/import/[id]` — raportul unui import din istoric.
- Asistentul are 5 pași, cu starea în componenta client (`wizard.tsx`): fișier → previzualizare și mapare → potrivirea jucătorilor → confirmare → raport. Pasul de mapare rămâne montat (ascuns), ca alegerile să nu se piardă la „Înapoi”.
- **Fișierul nu ajunge pe server.** Se citește în browser (`read-excel-file/browser`, `papaparse`); la „Importă” pleacă doar rândurile deja interpretate și deciziile de potrivire, printr-o acțiune de server care apelează RPC-ul atomic al tipului.
- Interpretarea fișierelor, propunerile de potrivire și construirea payload-urilor sunt cele din `@club/shared` (aceleași ca în `scripts/import-club-files.ts`). Nimic din `packages/shared` nu a fost modificat. `components/imports/prepare.ts` doar leagă maparea aleasă de `build*Payload` și calculează rezumatul.

## Potrivirea jucătorilor

- Decizii luate fără întrebare (secțiuni pliate, care pot fi deschise și corectate):
  - potrivire **sigură** (`proposeMatch().confident`: memorată sau identică, fără concurent apropiat) → „Potrivite automat”;
  - nume **fără niciun candidat**, la importurile care creează jucători (stare de sănătate, listă nominală) → „Jucători noi”. Altfel, primul import (115 nume într-un club gol) ar cere 115 clicuri;
  - rând **fără valori și fără candidat** (grila săptămânală) → sărit.
- Tot restul stă sus, în „De rezolvat”, și cere o decizie explicită; nu se poate continua cu un nume nerezolvat.
- La chestionarul săptămânal un nume necunoscut **nu** se creează automat (cere decizie: creează / sari / potrivește); jucătorii fără valori în fișier nu pot fi creați (nu ar avea ce importa) — doar potriviți sau săriți.
- La date fizice și teste nu există „creează jucător nou” (cerință); cei nepotriviți se sar și apar în raport.
- „Confirmă cele N propuneri” acceptă în bloc **doar propunerile clare**: toate cuvintele numelui mai scurt se regăsesc întocmai în celălalt sau ca inițială („DAVID P.” → DAVID POPTEAN, „VINGAN” → VINGAN ALEX). Asemănările prin prescurtare („Popescu Test” → POP, „Necunoscut Ion” → IONESCU — propuse de `proposeMatch`, dar greșite) rămân de confirmat una câte una. Regula este locală (`matching.ts › isClearSuggestion`).
- Două nume diferite din fișier potrivite cu același jucător blochează continuarea (altfel al doilea rând l-ar suprascrie pe primul).
- Potrivirile se țin minte de RPC-uri (`name_matches`). La date fizice și teste se țin minte **fără grupă**; grupa aleasă în ecran este doar indiciu pentru propuneri. Deciziile „sari peste” nu se memorează (tabelul nu are unde): la reimport, acel nume cere din nou o decizie.
- Lista de potrivire conține doar jucătorii activi, neanonimizați.

## Pe tipuri

- **Stare de sănătate**: blocurile și grupele propuse vin din `parseHealthSheet` / `suggestGroupForBlock`; coloanele pot fi corectate. Avertismente neblocante dacă lipsește antetul „stare de sănătate” sau dacă peste jumătate din rânduri au starea goală ori nerecunoscută (fișier greșit).
- **Chestionar săptămânal**: săptămâna implicită este cea trecută; orice zi aleasă se aduce la luni. Coloanele cu zi dedusă sunt evidențiate și trebuie bifată confirmarea ca să se poată continua; o coloană modificată de mână nu mai este „dedusă”.
- **Listă nominală**: `import_roster` nu atinge numele de afișare al jucătorilor existenți (completează nume complet, dată, post, număr, picior; câmpurile goale nu șterg nimic). Grupă necunoscută în fișier → grupa implicită, cu observație în raport. Detaliul postului („Fundaș central”) nu se păstrează — payload-ul trimite doar codul (GK/DEF/MID/FWD).
- **Date fizice**: sursa implicită „K-Sport” (contează la idempotență: cheia sesiunii este club + dată + nume + sursă). Fără coloană de sesiune și fără nume completat, sesiunea are numele gol. Un câmp se folosește o singură dată: alegerea lui pe altă coloană o eliberează pe prima.
- **Șabloane** (`import_templates`, `kind = 'physical'`): se salvează pe **textul antetelor**, nu pe poziție, deci rezistă la reordonarea coloanelor; plus tipul sesiunii și sursa. Același nume = actualizare. La un fișier cu exact aceleași antete, șablonul este propus (nu aplicat singur).
- **Teste fizice**: RPC nou `import_tests` (atomic, idempotent pe test + jucător + dată, rând în `imports`, potriviri memorate). Valorile se citesc direct din celule cu două zecimale — `applyMapping` din shared rotunjește numerele la o zecimală, prea puțin pentru timpii de sprint.

## Raport

- Lista pe rânduri vine din `imports.report.rows` (scris de RPC). Rândurile care nu ajung la RPC (fără nume, fără dată, rânduri de total) și observațiile de pe rândurile importate (valoare necitibilă) sunt adăugate la raport de acțiunea de server, imediat după RPC, ca raportul să fie complet și când este redeschis. Adăugarea nu este în aceeași tranzacție cu importul: dacă ar eșua, datele rămân importate corect, iar raportul are doar rândurile RPC-ului.
- „Erori” = rânduri care nu s-au putut importa din cauza datelor; „Sărite” = decizie de potrivire, jucător nepotrivit, rând de total, chestionar existent în aplicație. În istoric, coloana „Sărite” le cuprinde pe amândouă.
- Raportul se descarcă CSV cu `;` și BOM (se deschide corect în Excel cu setări românești).

## Limite cunoscute / nefăcut

- Un import trimite cel mult ~900 KB de date (limita Server Actions este 1 MB; `next.config.ts` este fișier comun și nu l-am modificat). Aproximativ 2 000–2 500 de rânduri de date fizice; peste, ecranul cere împărțirea fișierului pe perioade. Schema de validare acceptă cel mult 5 000 de rânduri.
- `.xls` (formatul vechi) nu se citește: mesaj care cere salvarea ca `.xlsx`. Fișierele `.xlsx` protejate cu parolă nu se citesc.
- CSV: codificarea se detectează UTF-8, cu rezervă Windows-1250; separatorul îl detectează `papaparse`.
- Nu există „anulează importul” (ștergerea a ceea ce a scris un import). Reimportul corectează valorile, dar nu șterge rânduri.
- Șabloane doar pentru date fizice (cerința); lista nominală și testele se bazează pe propunerea automată.
- Importul generic de date fizice acceptă orice tabel cu o coloană de nume și măcar o coloană de valori — nu poate ști dacă fișierul chiar este un export GPS.
- Paginile `/wellness` și `/fizic`, către care trimit linkurile din raport, aparțin altor module.

## Observații pentru `@club/shared` (nu am modificat)

- `proposeMatch` propune („propus”) și potriviri prin prefix care pot fi greșite („POPESCU …” → „POP”, „… ION” → „IONESCU”), cu același scor (0,82) ca o potrivire parțială corectă. În ecran rămân decizii explicite, dar scorul ar merita diferențiat.
- `applyMapping` rotunjește orice câmp `number` la o zecimală.
