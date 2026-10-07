# MASTER PROMPT — Platformă medicală și de pregătire fizică pentru Viitorul Cluj

## 0. Rolul tău

Ești inginerul principal al acestui proiect. Construiești de la zero o aplicație web completă, funcțională și gata de folosit de către un club de fotbal, apoi scrii documentația pentru versiunile native iOS și Android. Lucrezi autonom, de la început până la sfârșit. Unde o informație lipsește, iei decizia cea mai rezonabilă, o notezi în `DECIZII.md` și mergi mai departe; nu te oprești să întrebi.

## 1. Obiectiv

O platformă în care clubul ține evidența stării medicale și fizice a fiecărui jucător, iar preparatorul fizic prescrie și urmărește programe de prevenție, recuperare și planuri individuale. Fiecare jucător are contul lui și vede doar pagina lui.

Primul client este **Viitorul Cluj**: 115 jucători în evidență, în 5 grupe — Liga 3 (25), U21 (21), U17 (22), U16 (21), U15 (26). Aplicația este însă **generică și multi-club**: nume, siglă, culori, grupe și roluri sunt date de configurare, nu sunt scrise în cod.

## 2. Livrabile

1. **Aplicația web** — responsive, mobile-first (jucătorii o vor folosi aproape exclusiv de pe telefon), instalabilă ca PWA.
2. **`NATIVE.md`** — ghid complet pentru construirea aplicațiilor native iOS și Android în paralel, pe același backend (detalii la secțiunea 9).
3. **`README.md`** — instalare, variabile de mediu, deploy, conturi demo.
4. **`DECIZII.md`** — toate presupunerile și deciziile luate pe parcurs, plus ce a rămas de făcut.
5. **`GDPR.md`** — ce date se colectează, cine le vede, pe ce temei, cum se șterg/exportă.

## 3. Roluri și permisiuni

Conturile se creează **doar prin invitație** (fără înregistrare publică). Permisiunile se aplică la nivel de bază de date (Row Level Security), nu doar în interfață.

| Rol | Ce vede | Ce poate modifica |
|---|---|---|
| **Patron** | Tot clubul, privire de ansamblu: disponibilitate pe grupe, număr de accidentați, tendințe, rapoarte | Nimic (doar citire) |
| **Director sportiv** | La fel ca patronul + fișa sumară a fiecărui jucător | Nimic (doar citire) |
| **Preparator fizic** | Absolut tot („god view"), toate grupele | Tot: jucători, stare medicală, exerciții, programe, planuri, importuri, conturi, grupe |
| **Antrenor** | **Doar grupa/grupele lui**: tabloul de disponibilitate (nume, stare, zonă accidentată, dată estimată de revenire, restricții de antrenament) + fișa medicală completă a jucătorilor din grupă, chestionarele și datele lor fizice | Nimic (doar citire) |
| **Jucător** | Doar pagina lui | Chestionarele lui, bifarea exercițiilor, datele de profil |
| **Partener medical extern** (ex. clinică) | Doar jucătorii trimiși explicit către el | Note și documente pe cazurile respective |

Reguli ferme:
- Antrenorul vede fișa medicală completă (diagnostice, istoric, documente), dar **numai pentru grupa/grupele lui** și **numai în citire**. Nu are niciun acces la jucătorii altor grupe.
- Un utilizator poate avea mai multe grupe (antrenor la două grupe) și un jucător poate fi mutat între grupe fără să-și piardă istoricul.
- Rolul „Partener medical extern" există în sistem, dar poate rămâne nefolosit.
- Fiecare acces la date medicale și fiecare modificare se scrie într-un **jurnal de audit** (cine, ce, când).

## 4. Module funcționale

### 4.1 Jucători și grupe
- Structură: Club → Grupe (la Viitorul Cluj: Liga 3, U21, U17, U16, U15; lista este configurabilă) → Jucători.
- **Identitate:** fiecare jucător are un ID unic intern. Numele **nu** este cheie: în evidența clubului apar frecvent doar nume de familie, iar același nume există în mai multe grupe (ex. CHIS, CORJENCO, KIS, POP, DAMIAN, MATEI). Profilul are separat *nume complet* și *nume de afișare* (cel scurt, folosit de staff).
- Profil jucător: nume complet, nume de afișare, dată naștere, post, picior de bază, grupă, număr, fotografie, contact, contact părinte/tutore (pentru minori).
- Date antropometrice cu istoric: înălțime, greutate, procent de grăsime etc.

### 4.2 Stare medicală (panoul central)
- Stări — vocabularul folosit deja de club: **APT** (verde) / **OBOSEALĂ** (galben) / **READAPTARE LA EFORT** (portocaliu) / **ACC** – accidentat (roșu) / **ALT MOTIV** (gri; ex. răceală). Lista de stări este configurabilă pe club.
- Fiecare stare are un câmp de **observații** în text liber (ex. „Ușor răcit", „Revine de luni în antrenament") și, opțional, o dată de revenire.
- Zona accidentată: selecție pe harta corpului + câmp de **detaliu** în text liber (ex. „ligament", „metatarsiene") + bifă „incert / de confirmat" (clubul notează uneori „Genunchi/Coapsă?").
- Fiecare accidentare este o înregistrare separată: zonă (selectată pe o **hartă a corpului generată prin cod** — SVG, față/spate, stânga/dreapta), tip, mecanism (contact / fără contact, antrenament / meci), dată, diagnostic, severitate, dată estimată de revenire, dată reală de revenire, etapă de return-to-play, note, documente atașate (RMN, ecografii, scrisori medicale).
- **Tabloul de disponibilitate** pe grupă: listă cu nume, stare, zonă — ce vede antrenorul dimineața.
- **Viza medicală**: dată de expirare per jucător, cu perioadă de valabilitate configurabilă și alertă înainte de expirare.

### 4.3 Istoric medical
- Cronologie completă per jucător: accidentări, recidive (legate între ele), tratamente, zile pierdute, documente.
- Statistici: zile indisponibile pe sezon, accidentări pe zone, recidive.

### 4.4 Bibliotecă de exerciții
- Fiecare exercițiu: nume (RO), descriere pas cu pas, **clip de execuție**, zonă vizată, categorie (prevenție / recuperare / kinetoterapie / mobilitate / forță / activare), echipament, nivel, contraindicații, sursă și licență a materialului video.
- Preparatorul poate **adăuga, edita, dezactiva** exerciții și poate încărca propriile clipuri sau lipi un link (YouTube/Vimeo).
- Căutare și filtre după zonă, categorie, echipament.
- **Sursa video — sarcină de cercetare pentru tine:** caută o bibliotecă pe care o putem folosi legal, cu prioritate pe recuperare fizică și kinetoterapie. Puncte de plecare:
  - *wger* (open-source, API public, conținut sub licențe Creative Commons, o parte cu video) — verifică licența per element și păstrează atribuirea;
  - *free-exercise-db* (domeniu public, dar doar imagini, fără video) — bun pentru date de bază;
  - *ExerciseDB* (API cu video/GIF) — verifică termenii de utilizare;
  - biblioteci comerciale dedicate recuperării: *Physitrack*, *ExRx.net API*, *Hyperhuman* — doar le documentezi ca opțiuni plătite, nu le integrezi fără licență.
- Nu copia conținut din aplicații comerciale (Hevy etc.) și nu descărca clipuri fără drept de utilizare. Dacă nicio sursă liberă nu acoperă bine recuperarea, populează biblioteca cu ce este liber, lasă câmpul video gol la rest și notează în `DECIZII.md` lista de exerciții pentru care clubul trebuie să filmeze sau să licențieze clipuri.

### 4.5 Programe de prevenție
- Program = set de exerciții cu serii, repetări/durată, pauză, tempo, observații.
- Șabloane reutilizabile (ex. prevenție ischiogambieri, gleznă, adductori, genunchi/LIA, core, încălzire tip FIFA 11+).
- Alocare către: un jucător, o grupă, un post sau o selecție manuală; cu frecvență (zile pe săptămână) și perioadă.
- Jucătorul bifează fiecare exercițiu făcut și poate lăsa un comentariu sau semnala durere.
- Preparatorul vede **aderența**: cine a făcut programul și cine nu.

### 4.6 Plan personalizat zilnic
- Preparatorul creează pentru fiecare jucător planul zilei: exerciții din bibliotecă, parametri, note. Poate adăuga, modifica sau copia planul de pe o zi pe alta, zilnic.
- Vedere calendar (zi / săptămână) pentru jucător și pentru preparator.
- Legătură opțională cu o accidentare (plan de recuperare pe etape).

### 4.7 Chestionar zilnic de oboseală (wellness)
- Reproduce chestionarul pe care clubul îl ține acum în tabel. Completat de jucător în sub 30 de secunde, de pe telefon, o dată pe zi, cu **3 câmpuri de bază**:
  1. **Oboseală** — scală 1–10;
  2. **Încărcătură musculară** — scală 1–10;
  3. **Zonă dureroasă** — opțional: zonă pe harta corpului + intensitate.
- Scalele au etichete clare la capete (1 = deloc, 10 = maxim) și acceptă doar valori întregi.
- Întrebări suplimentare (calitatea somnului + ore dormite, stres, dispoziție) există ca opțiuni pe care preparatorul le poate activa pe grupă; implicit sunt **oprite**.
- **Vedere săptămânală pentru staff**, identică logic cu tabelul actual: jucători pe rânduri, zilele luni–duminică pe coloane, pentru fiecare zi oboseala, încărcătura musculară și zona dureroasă; celulele goale = necompletat.
- După antrenament/meci: **RPE** (1–10) × durată = încărcare internă (sRPE).
- Memento automat la o oră configurabilă; preparatorul vede cine nu a completat.
- **Alerte** către preparator la praguri configurabile: scor scăzut, scădere bruscă față de media personală, durere raportată, mai multe zile fără completare.
- Grafice per jucător și per grupă (evoluție pe 7 / 28 de zile).

### 4.8 Date fizice și import K-Sport
- Stocare per sesiune și per jucător: distanță totală, distanță la viteze mari, sprinturi, viteză maximă, accelerări/decelerări, încărcare etc.
- **Import din K-Sport** prin fișier exportat (CSV/XLSX): încărcare → previzualizare → **mapare de coloane** (salvabilă ca șablon) → potrivirea jucătorilor după nume, cu rezolvare manuală a celor nepotriviți → raport de import (rânduri importate / sărite / erori). Importul repetat al aceluiași fișier nu dublează datele.
- Formatul exact al exportului K-Sport nu este cunoscut: construiește importatorul generic, pe mapare, nu pe coloane fixe.
- Teste fizice (ex. sprint 10/30 m, săritură, Yo-Yo) cu istoric și comparație cu media grupei.

### 4.9 Import inițial
Cu același flux de previzualizare și mapare ca la 4.8. Structura reală a fișierelor clubului:
- **„STARE DE SANATATE"** — o singură foaie, cu grupele una sub alta (bloc L3, apoi „U21 NUME", „U17 NUME", „U16", „U15" ca rânduri de titlu, separate de rânduri goale). Coloane: nume / stare de sănătate / zonă accidentare. Importatorul detectează blocurile și atribuie grupa.
- **„FATIGUE/STARE DE OBOSEALA/L3"** — grilă săptămânală: nume, apoi oboseală 1–10 pe zile (luni–duminică), încărcătură musculară 1–10 pe zile, zonă dureroasă pe zile. Se importă ca istoric de chestionare.
- **Liste nominale pe grupe (evidența TFB)** — sursa pentru nume complete și date de naștere.

Reguli de import:
- **Potrivirea jucătorilor** între fișiere nu se face automat pe nume: scrierile diferă (ex. „PATRICK" / „KIS PATRICK", „DAVID P." / „DAVID POPTEAN") și unii jucători apar într-un singur fișier. Propui potriviri, iar preparatorul le confirmă sau le rezolvă manual într-un ecran dedicat; potrivirile confirmate se țin minte.
- **Valori neregulate** nu blochează importul: se importă ce se poate și rândul este marcat „de verificat". Exemple reale: „3/4" într-un câmp numeric, „5/10" trecut la zonă, „Genunchi/Coapsa?", stări scrise diferit („ACC" / „acc", „OBOSEALA" / „Se observa o stare de oboseala").
- Textul liber de la stare se mapează pe una dintre stările din 4.2, iar textul original se păstrează în observații.

### 4.10 Tablouri de bord și rapoarte
- Patron / director sportiv: disponibilitate pe club și pe grupe, accidentări active, zile pierdute, tendințe.
- Preparator: alertele zilei, chestionare lipsă, aderență la programe, reveniri apropiate, vize care expiră.
- Export PDF/Excel: fișa jucătorului, raport săptămânal pe grupă.

### 4.11 Notificări
- În aplicație și pe e-mail (push în versiunea nativă): chestionar necompletat, plan nou, schimbare de stare, viză care expiră.

## 5. Protecția datelor (obligatoriu, nu opțional)

Aplicația prelucrează **date de sănătate** (categorie specială, art. 9 GDPR) și include **minori**.
- Consimțământ explicit la primul login; pentru minori, consimțământul părintelui/tutorelui, înregistrat cu dată.
- Acces minim necesar pe fiecare rol, impus în baza de date.
- Antrenorii văd fișa medicală completă a grupei lor: textul de consimțământ o spune explicit, iar `GDPR.md` documentează temeiul și justificarea acestui acces.
- Jurnal de audit, export al datelor proprii, ștergere/anonimizare la cerere, perioadă de retenție configurabilă.
- Documentele medicale se stochează privat, cu linkuri semnate și cu expirare; găzduire în UE.

## 6. Stack tehnic

- **Frontend:** Next.js (React) + TypeScript + Tailwind; PWA.
- **Backend:** Supabase (Postgres, Auth, Storage, Row Level Security), regiune UE.
- **Deploy:** Netlify sau Vercel.
- Tipurile și logica de acces la date stau într-un pachet comun, ca să poată fi refolosite de aplicația nativă.
- Interfață în **limba română** (ortografie DOOM 3), pregătită pentru traducere (i18n).

## 7. Design

Curat, sobru, lizibil pe teren, la soare, pe telefon. Butoane mari, puțin text, culori de stare consecvente (verde / galben / portocaliu / roșu) dublate mereu de text sau pictogramă. Temă configurabilă pe club (siglă + culori).

## 8. Date de intrare

Dacă primești fișierele de mai jos, le folosești pentru importul inițial; dacă nu, generezi date demo realiste și structura rămâne aceeași.
- „STARE DE SANATATE" — starea celor 115 jucători, pe grupe: https://docs.google.com/spreadsheets/d/1rT9vEBstNQ_GN4bAw0_8i-K2skeN2ARXSjq2fMvsDtU
- „FATIGUE/STARE DE OBOSEALA/L3" — chestionarul săptămânal al grupei Liga 3: https://docs.google.com/spreadsheets/d/1938Z2E39FUHNf4m_SvmV1vqxdRiNY4heBWuFeGHcmTA
- Liste nominale pe toate grupele (evidența TFB).
- Un export-mostră din K-Sport.

## 9. `NATIVE.md` — conținut cerut

Scris pentru cineva care **nu** este familiarizat cu Xcode, Expo sau terminalul: pași numerotați, câte o acțiune pe pas, căi complete de fișiere, ce trebuie să apară pe ecran după fiecare pas.
- Arhitectură: un singur cod **Expo / React Native** pentru iOS și Android, pe același backend Supabase, cu pachetul comun de tipuri.
- Ce ecrane se portează întâi (jucător: plan zilnic, chestionar, exerciții cu video) și ce rămâne doar pe web (administrare, importuri).
- Notificări push, funcționare offline pentru chestionar și plan, redare video.
- Conturi necesare (Apple Developer, Google Play Console), costuri, pașii de build și publicare, cerințele magazinelor pentru aplicații cu date de sănătate și cu utilizatori minori.
- Estimare de etape și ordine de lucru.

## 10. Ordinea de lucru

1. Schema bazei de date + RLS + roluri + conturi demo.
2. Jucători, grupe, stare medicală, tablou de disponibilitate.
3. Bibliotecă de exerciții (inclusiv cercetarea surselor video) + programe + plan zilnic.
4. Chestionar wellness + alerte.
5. Importuri (Excel inițial, K-Sport) + date fizice.
6. Tablouri de bord, rapoarte, notificări.
7. GDPR, audit, verificări finale.
8. Documentație: `README.md`, `NATIVE.md`, `GDPR.md`, `DECIZII.md`.

## 11. Gata înseamnă

- Există câte un cont demo pentru fiecare rol și fiecare vede exact ce are voie (testat, inclusiv încercări de acces neautorizat).
- Un antrenor nu poate ajunge, pe nicio cale, la datele unei alte grupe și nu poate modifica nimic.
- Cele două tabele ale clubului se importă cap-coadă: 115 jucători în 5 grupe, cu stările lor, plus istoricul de oboseală al grupei Liga 3.
- Un jucător poate completa chestionarul și bifa planul zilei de pe telefon, în sub un minut.
- Importul unui CSV/XLSX funcționează cap-coadă, cu raport.
- Aplicația este publicată pe un URL și documentația este completă.

## 12. În afara scopului (acțiuni ale clubului, nu ale tale)

- Contactarea clinicii partenere (Athletic Med) și stabilirea colaborării — tu doar pregătești rolul „Partener medical extern".
- Obținerea acordurilor semnate de la părinți.
- Licențierea sau filmarea clipurilor care lipsesc.