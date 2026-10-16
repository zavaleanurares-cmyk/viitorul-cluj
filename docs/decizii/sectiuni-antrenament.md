# Secțiuni de antrenament și planul antrenamentului

Echivalentul modulelor „Secțiuni antrenament” și „Program antrenament” din The Football Brain.

Cod:
- migrarea `db/migrations/20261016100000_lr_sectiuni_antrenament.sql`;
- componentele din `components/drills/` (schema, editorul, biblioteca, planul);
- paginile `program/sectiuni/` și `program/[id]/plan/`;
- textele din `messages/ro/drills.ts`;
- testul de acces `scripts/test-rls-sectiuni.ts` (27 de verificări).

## Secțiunile

- **Câmpurile sunt ale TFB:**
  - nume, grupa de vârstă, tip, categorie;
  - jucători și portari, intensitate (1–5);
  - repetări × efort + pauză, din care se calculează durata totală;
  - suprafața de joc, echipament;
  - organizare și indicații, criterii de reușită;
  - imagini și link video.

  Tipurile din TFB sunt sugestii, iar câmpul rămâne liber.
- **Schema se desenează în aplicație, pe teren întreg, jumătate (poarta sus) sau zonă liberă:**
  - jucători din echipa noastră (numerotați automat), adversari, jokeri;
  - portari, conuri, mingi, porți mici;
  - săgeți pentru pasă (punctată), alergare (plină) și conducere (ondulată).

  Funcționează cu mouse, deget și tastatură: Delete șterge, săgețile mută elementul ales, Ctrl/Cmd+Z anulează. Schema se salvează ca date (coordonate în metri), nu ca imagine. Așa rămâne clară la orice mărime și la tipărire și se poate modifica oricând.
- **Imaginile încărcate** (scheme din alte aplicații, fotografii) stau în depozitul privat `drills`, cel mult 6 pe secțiune.
- **Cine vede ce:**
  - o secțiune a clubului o vede tot staff-ul;
  - o secțiune privată o vede doar autorul și biroul;
  - jucătorii și părinții nu văd biblioteca.
- **Cine modifică:** doar autorul sau biroul modifică, arhivează sau șterge o secțiune. Ceilalți își pot face o copie (privată), pe care o adaptează.

## Planul antrenamentului

- Fiecare antrenament poate avea un plan: temă, obiective, detalii și secțiunile în ordine, fiecare cu minutele și indicațiile zilei.
- Secțiunile vin din bibliotecă (mai multe deodată) sau se scriu liber. Totalul planificat se compară cu durata antrenamentului, iar depășirea se semnalează.
- **Cine face planul:** antrenorul echipei sau biroul, prin `save_training_plan`. Restul staff-ului îl vede, pentru că și calendarul e comun.
- O secțiune ștearsă din bibliotecă își păstrează numele în planurile vechi.
- Planul se tipărește din pagina lui: fiecare secțiune apare cu schema și organizarea ei.
- Tipărirea nu mai rezervă loc pentru meniul lateral, în toată aplicația, deci se repară și fișa jucătorului tipărită.

## Ce nu s-a adus din TFB

- Cele 12 secțiuni existente în TFB au doar imagini găzduite de TFB, pe care exporturile nu le includ. Se refac din aplicație, cu schema desenată sau cu imaginile încărcate din nou.

## Notele de la antrenament

- După antrenament, cine îl conduce dă jucătorilor note de la 1 la 5 (Program › antrenament › „Notează jucătorii”). Ca în TFB, unde nota stă lângă prezență.
- Dacă prezența e făcută, apar doar cei prezenți. Altfel apare tot lotul.
- Notele stau separat de prezență, în `training_ratings`, ca notele de meci: le văd doar staff-ul care conduce antrenamentul și conducerea sportivă. Jucătorii și părinții nu le văd, deși își văd prezența.

## Raportul de activitate al antrenorilor

- Este echivalentul „Raport activitate” din TFB. Se găsește în Program › Activitate, pe săptămână, pe echipe și cu filtru de echipă. Se poate tipări.
- **Ce se urmărește:**
  - la antrenamente: prezența, planul și notele;
  - la meciuri: notele și raportul de meci.
- **Termenele:**
  - planul trebuie să existe înainte de începerea antrenamentului;
  - restul trebuie făcut după terminarea evenimentului.

  Până la termen, lucrul apare gri („încă nu e momentul”), ca să nu fie numărat ca lipsă.
- Fiecare verificare duce direct la ecranul unde se face lucrul care lipsește.
- **Cine îl vede:**
  - antrenorul își vede doar echipele lui;
  - biroul și conducerea sportivă văd tot clubul;
  - contabilul nu are acces, pentru că nu vede notele și raportul l-ar arăta greșit.
