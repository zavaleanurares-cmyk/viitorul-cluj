# Exerciții, programe și planuri — decizii

Modul pentru preparatorul fizic: `/biblioteca`, `/programe`, `/planuri`, `/jucatori/[id]/plan`.
Componente: `apps/web/src/components/planning/`. Texte: `messages/ro/library.ts`, `messages/ro/planning.ts`.

## Ce am preluat din runda întreruptă și ce am reparat

- Păstrat: formularul de exercițiu, selectorul de exerciții, editorul de itemi, interogările, schemele, textele.
- `/biblioteca` nu se deschidea deloc: pagina (server) apela `exerciseMeta()` dintr-un fișier `"use client"`. Funcția stă acum în `planning/format.ts`.
- Clipuri, după trecerea de la Supabase la depozitul propriu: pagina exercițiului folosește `fileUrl`; ștergerea trece prin `deleteFiles` (cu verificarea dreptului), nu direct prin `removeFiles`; încărcarea arată progresul (`onProgress`).
- Fișierele `.mov` pot veni din browser fără tip: se trimite tipul stabilit de server după extensie (altfel ruta de încărcare răspunde 415).
- Modul „Fișier” fără fișier ales (sau „Link” fără link) salva în tăcere un exercițiu fără clip. Acum se cere fișierul / linkul sau trecerea pe „Fără clip”.
- După înlocuirea clipului, formularul cerea o dată vechiul fișier, deja șters (404 în consolă). Reparat.

## Decizii

**Bibliotecă**
- Calea clipului o generează serverul (`prepareClipUpload`: `<club_id>/<uuid>-<nume-sigur>`), nu browserul; tipul și mărimea sunt verificate și acolo, și în ruta de încărcare.
- Un fișier încărcat aparține unui singur exercițiu (serverul refuză aceeași cale la două exerciții), ca ștergerea unuia să nu lase alt exercițiu fără clip.
- Ștergerea unui exercițiu este permisă doar dacă nu apare în niciun program sau plan; verificarea se face pe server (în schemă, ștergerea ar șterge în cascadă itemii din programe și planuri). Altfel se oferă dezactivarea.
- Filtre în URL: `q`, `zona`, `categorie`, `echipament`, `dezactivate=1`, `faraclip=1`.
- Sursa, licența și atribuirea sunt obligatorii când există clip sau imagine (verificat în formular și pe server). La alegerea unui fișier se propune „Clip propriu al clubului”.

**Programe**
- „Arhivare” (`programs.is_active`) pe lângă ștergere: un program cu alocări nu se poate șterge (s-ar pierde bifele jucătorilor), dar poate fi arhivat.
- „Oprește” pe o alocare: `is_active = false` și, dacă alocarea este în desfășurare, `end_date = azi`, ca aderența să se calculeze până în ziua opririi.
- Programul se poate aloca doar dacă are cel puțin un exercițiu salvat.
- Numărul de jucători afișat înainte de confirmare se calculează în browser din jucătorii activi, cu aceeași regulă ca RPC-ul `assign_program`.
- Editorul se reinițializează din datele serverului după fiecare salvare, ca itemii noi să primească `id` și salvările următoare să păstreze bifele.
- Editoarele nu sunt `<form>`: Enter în căutarea din selector nu salvează din greșeală.

**Aderență**
- Exerciții bifate / exerciții programate, de la începutul alocării până azi inclusiv (`adherence()` din shared). Se numără doar bifele din zilele programate și doar pentru exercițiile care mai sunt în program.
- Media alocării = total bifate / total programate pe toți jucătorii.
- Ziua de azi intră în calcul de dimineață: până bifează jucătorii, apare ca „nefăcut”.
- Banda arată ultimele 10 zile programate (8 în fișa jucătorului). Stare = culoare + simbol: ✓ integral, cerc pe jumătate parțial, ✕ deloc.
- Pe telefon, tabelul devine listă (nume și procent pe un rând, banda dedesubt), fără derulare orizontală.

**Planuri**
- URL: `?grupa=<id|toate>`, `?saptamana=<luni>`, `?zi=<data>` (vederea pe zi), `?filtru=indisponibili`.
- Un plan trebuie să aibă cel puțin un exercițiu sau o notă.
- Accidentarea legată trebuie să fie a aceluiași jucător (verificat pe server); etapa de revenire se salvează doar împreună cu o accidentare.
- „Pornește de la un program” adaugă exercițiile la cele existente (sau le înlocuiește, cu bifă). Exercițiile dezactivate ale programului sunt copiate și marcate „Dezactivat”.
- „Copiază planul de ieri” apare doar când ziua nu are încă plan — o singură atingere, fără riscul de a înlocui ceva.
- La copierea către alți jucători, ziua planului este preselectată; se pot alege și alte zile. RPC-ul nu copiază legătura cu accidentarea la alt jucător.
- Înainte de copiere se arată câte planuri se creează și câte planuri existente sunt înlocuite.
- Se pot crea planuri și pentru zile trecute (evidență retroactivă).

**Audit**
- Editorul de plan jurnalizează citirea (`log_medical_access`, secțiunea `medical`) doar când afișează accidentările jucătorului. Fila „Plan și programe” nu jurnalizează: arată bife și semnalări de durere, nu fișa medicală.

## Lipsuri în `packages/shared` (rezolvate local, în `planning/queries.ts`)

- Interogări pentru programe, alocări, bife pe alocare, celulele săptămânii și planul de editat.
- `fetchAll` (paginare pe 1000 de rânduri) pentru bife.

## Ce a rămas nefăcut

- Clipuri orfane: dacă fila este închisă între încărcare și salvare, fișierul rămâne în depozit fără exercițiu. Ar trebui o curățare periodică în `/api/cron` (fișiere din `exercise-media` fără rând în `exercises`).
- Același jucător poate primi același program de două ori (prin grupă și individual); nu avertizăm.
- Imaginea exercițiului este doar link (`image_url`), fără încărcare de fișier.
- Fără drag-and-drop la reordonare (cerință: butoane sus / jos).
- Vederea săptămânală arată doar planurile, nu și programele programate (acestea apar în fișa jucătorului și în editorul zilei).
- Alocările nu se pot modifica după creare (zile, perioadă): se opresc și se creează altele.
- `cn()` nu rezolvă conflictele de clase Tailwind. În editorul de itemi, câmpurile numerice cer `px-2` peste `px-3` din `Input`; efectul este doar o margine interioară ceva mai mare.
