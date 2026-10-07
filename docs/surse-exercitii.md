# Surse pentru clipurile de exerciții — cercetare și recomandare

*Ultima verificare: 7 octombrie 2026. Documentul răspunde cerinței din `docs/cerinte.md`, secțiunea 4.4.*

## Pe scurt

- **Nicio sursă liberă nu acoperă recuperarea și kinetoterapia cu video.** Sursele deschise (wger, free-exercise-db) sunt orientate spre sală și forță; bibliotecile serioase de recuperare (Physitrack, Wibbi, Rehab My Patient) sunt comerciale și nu permit scoaterea clipurilor din platforma lor.
- **Biblioteca pornește fără niciun clip și fără nicio imagine externă**: 95 de exerciții și 10 programe, cu texte scrise de noi. Câmpurile `video_url`, `image_url`, `source`, `license`, `attribution` sunt goale la toate.
- **Soluția recomandată: clubul își filmează propriile clipuri.** Trei ședințe de câte 2–3 ore acoperă toată biblioteca; prima (recuperare și kinetoterapie, 34 de exerciții) este cea care contează.
- Până atunci, preparatorul poate lipi la un exercițiu un link YouTube/Vimeo (redare prin playerul oficial, fără descărcare).

Legendă pentru coloana „Cum am verificat”: **V** = citit pe pagina-sursă indicată; **S** = sursă secundară (nu pagina oficială); **N** = nu am putut verifica.

## 1. Tabel-sinteză

| Sursă | Ce oferă | Licență | Video? | Acoperă recuperarea? | Se poate folosi? | Cum am verificat |
|---|---|---|---|---|---|---|
| **wger** (wger.de) | Bază de exerciții întreținută de comunitate, API REST public; imagini și, la o parte dintre exerciții, clipuri | Cod: AGPL-3.0-or-later. Date: „Creative Commons (see individual entries)”, adică licența se citește la fiecare element | Da, la o parte (număr neverificat) | Slab — profil de sală/forță (neverificat pe date) | **Da, element cu element**, doar unde licența este CC-BY-SA / CC-BY / CC0, cu atribuire completă. De verificat manual înainte | V: [README](https://cdn.jsdelivr.net/gh/wger-project/wger@master/README.md), [documentație](https://wger.readthedocs.io/), [API](https://wger.readthedocs.io/en/latest/api/api.html). N: conținutul API-ului |
| **free-exercise-db** (yuhonas) | Peste 800 de exerciții în JSON, instrucțiuni în engleză, fotografii la fiecare exercițiu | Unlicense (domeniu public), conform depozitului | Nu | Slab — majoritar forță; are și întinderi | Da, pentru imagini și date de bază; proveniența fotografiilor nu este documentată | V: [depozit](https://github.com/yuhonas/free-exercise-db) |
| **ExerciseDB** (exercisedb.dev / AscendAPI, RapidAPI) | API cu GIF-uri (v1 gratuit, ~1 500 de exerciții) și variantă plătită cu video | Cod: AGPL-3.0. Media: proprietare, sub termeni de utilizare | GIF / video (plătit) | Nu | **Nu** în varianta gratuită (declarată „doar pentru explorare”); varianta plătită doar cu contract | V: [depozit](https://github.com/exercisedb/exercisedb-api), [site](https://exercisedb.dev/). N: textul termenilor |
| **ExerciseDB.io** (pachet descărcabil) | Set de date cu GIF-uri, cumpărat o singură dată | Licență comercială perpetuă, fără redistribuire | GIF | Nu | Doar cumpărat | V: [FAQ](https://exercisedb.io/faq) |
| **Physitrack** (include PhysioTools) | Peste 18 000 de exerciții filmate, platformă de prescriere pentru kinetoterapeuți | Proprietară | Da | **Da** | **Nu în aplicația noastră**: conținutul nu poate fi folosit în afara platformei fără acord scris. Se poate folosi ca unealtă separată | V: [prețuri](https://www.physitrack.com/pricing), [răspuns oficial](https://support.physitrack.com/article/2075-can-i-use-physitrack-content-outside-the-platform) |
| **ExRx.net** | Bibliotecă mare de exerciții, API și licențiere de conținut | Proprietară, pe bază de contract | Da | Parțial | Doar cu licență; preț la cerere | N: paginile [API FAQ](https://exrx.net/Store/Other/APIFAQ) și [Licensing](https://exrx.net/Store/Other/Licensing) nu pot fi citite automat |
| **Hyperhuman** | Clipuri HD prin API, cu player încorporabil și livrare sub marcă proprie | Proprietară, abonament | Da | Neclar — fitness, mobilitate, „recovery”; kinetoterapie neconfirmată | Da, plătit: planul cu API costă 191 USD/lună | V: [prețuri](https://studio.hyperhuman.cc/pricing), [API](https://hyperhuman.cc/exercise-video-api), [licențiere](https://hyperhuman.cc/fitness-content-licensing) |
| **Rehab My Patient** | Peste 5 500 de exerciții cu video HD, platformă de prescriere | Proprietară | Da | **Da** | Nu în aplicația noastră (fără API sau licențiere de conținut menționate) | V: [site](https://www.rehabmypatient.com/) |
| **Wibbi** (fost Physiotec) | Peste 20 000 de exerciții, platformă de prescriere, aplicație sub marcă proprie | Proprietară | Da | **Da** | Doar în platforma lor; preț la cerere | V: [site](https://wibbi.com/rehabilitation/) |
| **FIFA 11+** | Manual și clipuri ale programului de încălzire | „Publicație oficială a FIFA”, editată de F-MARC; nicio licență deschisă | Da (ale FIFA) | Prevenție, nu recuperare | **Nu se copiază și nu se încorporează.** Structura programului se poate descrie cu cuvintele noastre (așa am făcut) | V: [termenii FIFA](https://inside.fifa.com/terms-of-service), [manual, copie pe un site terț](https://www.footballwest.com.au/sites/fw/files/2020-12/FIFA-11Ref-low-res.pdf) |
| **Wikimedia Commons** | Fișiere media sub licențe libere, fiecare cu licența lui | CC-BY / CC-BY-SA / domeniu public, per fișier | Foarte puține | Nu | Teoretic da, practic nu avem ce lua | V: [Physical therapy](https://commons.wikipedia.com/wiki/Category:Physical_therapy), [Videos of exercise](https://commons.wikipedia.com/wiki/Category:Videos_of_exercise) |
| **NHS** (nhs.uk) | Texte medicale și clipuri de exerciții | Texte: Open Government Licence v3.0. Imaginile și clipurile cu persoane identificabile sunt **excluse** | Da, dar excluse | Da (public larg) | Nu pentru clipuri | V: [termeni](https://www.nhs.uk/our-policies/terms-and-conditions/) |
| **RepDB** (set gratuit) | 250 de exerciții cu ilustrații 512 px (două poziții) | Licență proprie: folosire comercială în aplicație, cu atribuire vizibilă; fără redistribuire | Nu (animațiile sunt plătite) | Nu; are întinderi | Opțional, doar ca ilustrații | V: [depozit](https://github.com/RepDB/exercise-dataset) |
| **YouTube / Vimeo** (link lipit de preparator) | Orice clip public, redat prin playerul oficial | Rămâne a autorului; e permisă doar încorporarea | Da | Da, dacă preparatorul alege clipuri bune | **Da, numai încorporat**, niciodată descărcat | V: [ajutor YouTube](https://support.google.com/youtube/answer/171780?hl=en) |

## 2. Detalii pe surse

### wger

Verificat pe paginile proiectului:

- README-ul din ramura principală: „Application Code: AGPL-3.0-or-later / Exercise/Ingredient Data: Creative Commons (see individual entries) / Documentation: CC-BY-SA-4.0”. Documentația precizează că datele *inițiale* de exerciții sunt sub CC-BY-SA 3.0. Concluzia practică: **nu există o licență unică pentru tot conținutul**; contează licența fiecărui exercițiu, a fiecărei imagini și a fiecărui clip.
- Documentația API: listele publice (exerciții, ingrediente) se citesc fără autentificare; limitele de trafic privesc doar câteva rute sensibile.
- Clipurile se găzduiesc pe instanță, ca imaginile; există o comandă de sincronizare (`download-exercise-videos`) — [pagina „videos”](https://wger.readthedocs.io/en/latest/videos.html).

Din surse secundare (un [aviz de securitate](https://osv.dev/vulnerability/PYSEC-2026-3419) și o [descriere a codului](https://deepwiki.com/wger-project/wger/5.3-exercise-media), nu codul-sursă citit direct): modelele `Exercise`, `ExerciseImage`, `ExerciseVideo` și `Translation` au aceleași câmpuri de licență — `license`, `license_author`, `license_title`, `license_object_url`, `license_author_url`, `license_derivative_source_url`. Clipurile acceptate sunt MP4/WebM/Ogg, de cel mult 100 MB.

**API-ul public nu a putut fi interogat din mediul în care am lucrat**: `https://wger.de/api/v2/` este exclus prin `robots.txt` pentru unealta de citire automată, iar adresele `…/video/` și `…/exerciseinfo/` nu au putut fi deschise. Rămân deci **neverificate**: câte exerciții au clip, ce licență are fiecare clip, câte exerciții de recuperare există și dacă există traduceri de exerciții în română. Pentru română am putut verifica doar interfața aplicației: [22 % tradusă](https://hosted.weblate.org/projects/wger) — textele exercițiilor nu se traduc acolo.

Presupunere (din profilul proiectului, neverificată pe date): wger este un jurnal de antrenament de sală, deci clipurile existente acoperă exerciții de forță, nu kinetoterapie.

### free-exercise-db

Depozitul se declară sub Unlicense (domeniu public): peste 800 de exerciții cu `name`, `level`, `equipment`, `primaryMuscles`, `instructions` (engleză), `category`, `images`. Imaginile sunt căi relative (`Nume_Exercitiu/0.jpg`), cu prefixul `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/`. Nu are video. Datele provin din `wrkout/exercises.json`, tot sub Unlicense.

Rezervă: licența este declarația întreținătorilor; **originea fotografiilor nu este documentată** în depozit. Nu am putut deschide fișierele individuale ca să potrivesc exerciții, așa că nu am adăugat nicio imagine în bibliotecă.

### ExerciseDB

Sub acest nume circulă mai multe produse, pe care le-am găsit pe site-uri diferite (nu am verificat dacă au același proprietar):

- **exercisedb.dev / AscendAPI**: API v1 gratuit („1,500 exercises with GIFs”) și variantă plătită. Codul este AGPL-3.0, dar README-ul avertizează că rutele gratuite sunt „for exploration only and not recommended for production integration”. Termenii de utilizare stau pe o pagină care nu a putut fi citită automat.
- **exercisedb.io**: pachet cumpărat o singură dată, cu licență perpetuă; permite afișarea GIF-urilor în aplicația proprie, interzice redistribuirea fișierelor.
- Un depozit care redistribuie un set asemănător [notează](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md) că GIF-urile aparțin firmei Gym visual. E un indiciu, nu o dovadă pentru ExerciseDB, dar întărește concluzia: **media nu sunt libere**.

Concluzie: nu folosim ExerciseDB. Oricum, conținutul este de sală, nu de recuperare.

### Opțiuni comerciale dedicate recuperării (doar documentare)

- **Physitrack** — peste 18 000 de exerciții filmate. Pagina de prețuri afișează 18,99 USD/lună per practician (227,88 USD/an); un articol din centrul de ajutor dă 22,95 EUR/lună pentru zona euro. Cele două pagini nu se potrivesc, deci prețul se confirmă la ofertare. Planul Enterprise (de la 20 de practicieni) menționează „Integrated UI in your own app”. Regula oficială: conținutul **nu poate fi descărcat și folosit pe alt site** fără acord scris prealabil. PhysioTools aparține Physitrack [din 2020](https://www.physitrack.com/physiotools-landing).
- **Rehab My Patient** — peste 5 500 de exerciții cu video HD; de la 11,42 GBP/lună (individual). Nu menționează API sau licențiere de conținut.
- **Wibbi** — peste 20 000 de exerciții, aplicație sub marcă proprie, integrări cu sisteme medicale. Prețul nu apare pe pagina citită.
- **Hyperhuman** — singura opțiune găsită gândită pentru încorporare într-o aplicație proprie: clipuri HD prin API, redate din adrese semnate. Planuri: Content 95 USD/lună, Platform 191 USD/lună (cu API), Ultra 383 USD/lună. Conținutul este de fitness; acoperirea kinetoterapiei trebuie cerută explicit înainte de orice decizie.
- **ExRx.net** — are pagini dedicate pentru API și pentru licențierea conținutului, dar nu le-am putut citi. Se cere ofertă direct.

Modelul comun al platformelor de kinetoterapie: kinetoterapeutul prescrie, iar jucătorul vede clipurile **în aplicația lor**. Dacă stafful medical vrea o asemenea unealtă, ea funcționează în paralel cu aplicația noastră, nu în interiorul ei.

### FIFA 11+

Manualele găsite (11+ pentru arbitri, 11+ Kids) poartă mențiunea „Official publication of the Fédération Internationale de Football Association (FIFA)”, cu editor FIFA Medical Assessment and Research Centre (F-MARC). Nu am găsit nicio licență deschisă. Termenii FIFA (versiunea din 27 ianuarie 2026) acordă doar o licență limitată, pentru uz privat și necomercial, și interzic reproducerea, distribuirea și includerea platformelor FIFA în cadrul altui site. Linkurile sunt permise dacă sunt atribuite corect și nu sugerează o asociere cu FIFA.

**Nu am găsit o adresă oficială stabilă** pentru manual sau pentru clipuri: copiile care apar în căutări stau pe site-uri terțe (federații regionale, clinici), iar pe pagina citită de pe [f-marc.com](https://www.f-marc.com/fifa-11/) nu apare cine administrează site-ul.

Ce facem: programul „Încălzire de tip 11+” din bibliotecă urmează structura publicată în literatura științifică (trei părți: alergare, forță–echilibru–sărituri, alergare în viteză), cu exerciții descrise în cuvintele noastre. Nu folosim numele „FIFA”, sigla sau imaginile din manual și nu încorporăm clipurile.

### Alte surse libere

- **Wikimedia Commons**: categoria „Physical therapy” are 239 de fișiere, aproape toate fotografii; „Videos of exercise” are 12 clipuri (burpee, kettlebell). Nimic util pentru recuperarea fotbaliștilor.
- **NHS**: textele sunt sub Open Government Licence v3.0, dar imaginile și clipurile cu persoane identificabile sunt excluse expres. Clipurile de exerciții ale spitalelor NHS stau pe YouTube, sub drepturi rezervate.
- **RepDB**: ilustrații statice, cu atribuire vizibilă obligatorie („Exercise data by RepDB (repdb.co)”) și fără dreptul de a le prelucra liber. Există și un depozit mai vechi al aceluiași proiect sub CC BY-NC, deci termenii trebuie recitiți înainte de folosire. Nu rezolvă problema clipurilor.

## 3. Recomandare

**Ce folosim acum**

1. Biblioteca proprie, doar text: 95 de exerciții și 10 programe, fără media externă.
2. Clipuri filmate de club, încărcate din aplicație (vezi secțiunile 5 și 6). Este singura cale care acoperă recuperarea, nu costă nimic și nu depinde de licența nimănui.
3. Ca soluție de moment: linkuri YouTube/Vimeo lipite de preparator, redate prin playerul oficial.

**Ce nu folosim**

- GIF-urile și clipurile ExerciseDB; orice conținut din Physitrack, Rehab My Patient, Wibbi, Hevy sau alte aplicații comerciale.
- Materialele FIFA 11+ (manual, imagini, clipuri).
- Clipuri descărcate de pe YouTube și reîncărcate în aplicație.

**Opțional, mai târziu**

- **wger**, pentru exercițiile de forță: cineva cu acces normal la internet deschide `https://wger.de/api/v2/video/?format=json&limit=100`, alege doar clipurile cu licență CC-BY-SA, CC-BY sau CC0 care corespund *exact* unui exercițiu din bibliotecă și completează atribuirea după regulile de mai jos. Câștigul estimat este mic.
- **free-exercise-db**, pentru o imagine statică la exercițiile de forță fără clip.
- **O platformă plătită de kinetoterapie**, dacă stafful medical vrea o bibliotecă mare gata făcută — ca unealtă separată.

**Ce are clubul de făcut**

1. Să stabilească cine filmează și cine demonstrează (recomandat: un jucător major sau un membru al staffului).
2. Să filmeze întâi prioritatea 1 și să încarce clipurile.
3. Să obțină acord scris de la orice persoană care apare în clipuri; pentru minori, de la părinți.
4. Să decidă dacă vrea ofertă de la o platformă plătită.

## 4. Reguli de atribuire în aplicație

Aplicația are câmpurile `source`, `license`, `attribution` la fiecare exercițiu și afișează atribuirea sub clip.

**Regulă generală:** un exercițiu cu `video_url` sau `image_url` are obligatoriu toate cele trei câmpuri completate. Dacă licența nu poate fi stabilită, materialul nu se încarcă.

| Tip de material | `source` | `license` | `attribution` |
|---|---|---|---|
| Clip filmat de club | `Filmare proprie` | `Toate drepturile rezervate — uz intern` | Clubul și anul, de exemplu: `© Viitorul Cluj, 2026` |
| Link YouTube/Vimeo | Adresa clipului | `Licența standard a platformei — doar încorporare` | Numele canalului și titlul clipului |
| wger (CC-BY-SA, CC-BY) | Adresa exercițiului sau a clipului pe wger.de (`license_object_url`, dacă există) | Numele scurt și versiunea, de exemplu `CC-BY-SA 4.0` | Titlu, autor (`license_author`), sursă, licență, cu link spre textul licenței; dacă este o lucrare derivată, și sursa originală (`license_derivative_source_url`) |
| free-exercise-db | Adresa imaginii din depozit | `Unlicense (domeniu public)` | `free-exercise-db (github.com/yuhonas/free-exercise-db)` — nu e obligatorie, dar o păstrăm pentru trasabilitate |

Pentru materialele Creative Commons:

- Atribuirea are patru elemente: **titlu, autor, sursă, licență**. Exemplu de text sub clip: „«Titlul clipului», de Nume Autor, wger.de, licență CC-BY-SA 4.0”.
- **Nu se șterg** numele autorului sau mențiunile de licență din fișier.
- Dacă modificăm clipul (tăiere, text suprapus), menționăm modificarea. La CC-BY-SA, **clipul modificat** se distribuie sub aceeași licență; obligația privește clipul, nu aplicația.
- Nu folosim materiale cu „NC” (necomercial) sau „ND” (fără opere derivate).
- Lista tuturor materialelor externe, cu licențele lor, trebuie să poată fi extrasă din aplicație.

Pentru linkurile YouTube: clipul se redă numai prin playerul încorporat (autorul poate dezactiva încorporarea, iar atunci clipul nu va porni). Recomand domeniul `youtube-nocookie.com`, care nu personalizează reclamele — util fiindcă o parte dintre jucători sunt minori.

## 5. Exercițiile din bibliotecă fără clip

Generată din `db/seed/library.json`. **Toate cele 95 de exerciții sunt fără clip.**

### Prioritatea 1 — recuperare și kinetoterapie (34 de exerciții)

**Recuperare (21)**

1. Izometrie de ischiogambieri cu călcâiul în sol (`izometrie-ischiogambieri-calcai-in-sol`)
2. Pod izometric cu genunchii aproape întinși (`pod-izometric-ischiogambieri`)
3. Pod fesier pe un picior (`pod-fesier-pe-un-picior`)
4. Flexii de genunchi cu alunecare (slider curl) (`slider-curl-ischiogambieri`)
5. Scufundătorul („diver”) (`diver`)
6. Strângerea mingii între genunchi (izometric) (`strangere-minge-izometric-adductori`)
7. Adducție cu bandă, în picioare (`adductie-cu-banda-in-picioare`)
8. Eversie de gleznă cu bandă (`eversie-glezna-cu-banda`)
9. Inversie de gleznă cu bandă (`inversie-glezna-cu-banda`)
10. Dorsiflexie de gleznă cu bandă (`dorsiflexie-glezna-cu-banda`)
11. Ridicări pe vârfuri pe două picioare (`ridicari-pe-varfuri-doua-picioare`)
12. Coborâri excentrice pe treaptă, cu genunchiul întins (`coborari-excentrice-pe-treapta`)
13. Coborâri excentrice pe treaptă, cu genunchiul îndoit (`coborari-excentrice-genunchi-indoit`)
14. Izometrie de gambă, pe vârfuri (`izometrie-gamba-pe-varfuri`)
15. Genuflexiune izometrică la perete („scaunul”) (`genuflexiune-la-perete`)
16. Coborâre de pe treaptă (step-down) (`step-down`)
17. Spanish squat (genuflexiune cu bandă în spatele genunchilor) (`spanish-squat`)
18. Automasaj cu rulou: cvadriceps (`rulou-cvadriceps`)
19. Automasaj cu rulou: ischiogambieri (`rulou-ischiogambieri`)
20. Automasaj cu rulou: gambă (`rulou-gamba`)
21. Automasaj cu rulou: partea laterală a coapsei și fesieri (`rulou-banda-iliotibiala-fesieri`)

**Kinetoterapie (13)**

1. Adducție culcat pe o parte (`adductie-decubit-lateral`)
2. Pompe de gleznă (`pompe-de-glezna`)
3. Alfabetul cu glezna (`alfabetul-cu-glezna`)
4. Contracție izometrică de cvadriceps (`contractie-izometrica-cvadriceps`)
5. Ridicarea piciorului întins (`ridicarea-piciorului-intins`)
6. Alunecarea călcâiului (`alunecarea-calcaiului`)
7. Extensie terminală de genunchi cu bandă (`extensie-terminala-genunchi-cu-banda`)
8. Scoica (`scoica`)
9. Abducție culcat pe o parte (`abductie-decubit-lateral`)
10. Extensii lombare din culcat (McKenzie) (`extensii-mckenzie`)
11. Bascularea bazinului, culcat pe spate (`bascularea-bazinului`)
12. Pendulări ale brațului (`pendulari-de-brat`)
13. Rotație externă a umărului, culcat pe o parte (`rotatie-externa-umar-culcat-lateral`)


### Prioritatea 2 — prevenție (25 de exerciții)

**Prevenție (25)**

1. Nordic (coborâre excentrică pentru ischiogambieri) (`nordic-hamstring`)
2. Copenhagen — nivelul 1 (sprijin pe genunchi, izometric) (`copenhagen-nivel-1`)
3. Copenhagen — nivelul 2 (sprijin pe genunchi, dinamic) (`copenhagen-nivel-2`)
4. Copenhagen — nivelul 3 (sprijin pe gleznă) (`copenhagen-nivel-3`)
5. Echilibru pe un picior, pe sol (`echilibru-unipodal-sol`)
6. Echilibru pe un picior, pe placă instabilă (`echilibru-unipodal-placa`)
7. Săritură cu aterizare controlată pe două picioare (`saritura-cu-aterizare-controlata`)
8. Aterizare pe un picior (`aterizare-unipodala`)
9. Sărituri laterale de pe un picior pe altul (`sarituri-laterale-unipodale`)
10. Fandări în mers (`fandari-in-mers`)
11. Planșă (`plansa`)
12. Planșă cu ridicarea alternativă a picioarelor (`plansa-cu-ridicare-de-picior`)
13. Planșă laterală (`plansa-laterala`)
14. Planșă laterală cu ridicări de bazin (`plansa-laterala-cu-ridicari-de-bazin`)
15. Dead bug (braț și picior opus, culcat pe spate) (`dead-bug`)
16. Bird dog (braț și picior opus, din patrupedie) (`bird-dog`)
17. Pallof press (împingere antirotație cu bandă) (`pallof-press`)
18. Rotație externă a umărului cu bandă (`rotatie-externa-umar-cu-banda`)
19. Y-T-W culcat pe burtă (`ytw`)
20. Flotări „plus” pentru scapulă (`flotari-plus`)
21. Sărituri verticale (`sarituri-verticale`)
22. Alergare cu schimbări de direcție (`alergare-cu-schimbari-de-directie`)
23. Tracțiuni spre față cu bandă (face pull) (`tractiuni-spre-fata-cu-banda`)
24. Planșă pe brațe întinse cu atingerea umerilor (`plansa-cu-atingerea-umerilor`)
25. Genuflexiune cu ridicare pe vârfuri (`genuflexiune-cu-ridicare-pe-varfuri`)


### Prioritatea 3 — mobilitate, activare, forță (36 de exerciții)

**Mobilitate (13)**

1. Întinderea ischiogambierilor, culcat pe spate (`intindere-ischiogambieri-culcat`)
2. Întinderea adductorilor, în sprijin pe genunchi (`intindere-adductori-in-genunchi`)
3. Întinderea gambei la perete (`intindere-gamba-la-perete`)
4. Întinderea solearului la perete (`intindere-solear-la-perete`)
5. Pisica și vaca (cat-cow) (`cat-cow`)
6. Genunchi la piept (`genunchi-la-piept`)
7. Întinderea flexorilor șoldului, în genunchi (`intindere-flexori-sold`)
8. Mobilitatea șoldului 90/90 (`mobilitate-90-90`)
9. Rotație toracică din patrupedie (`rotatie-toracica-patrupedie`)
10. Mobilitatea gleznei la perete (genunchi la perete) (`dorsiflexie-glezna-la-perete`)
11. Fandare cu rotație și întindere (world's greatest stretch) (`worlds-greatest-stretch`)
12. Întinderea piriformului (cifra 4) (`intindere-piriform`)
13. Întinderea cvadricepsului, culcat pe o parte (`intindere-cvadriceps-culcat-lateral`)

**Activare (16)**

1. Podul fesier (`podul-fesier`)
2. Mers lateral cu minibandă (`mers-lateral-cu-mini-banda`)
3. Ridicări laterale de genunchi din patrupedie („fire hydrant”) (`fire-hydrant`)
4. A-skip (pas săltat cu genunchiul sus) (`a-skip`)
5. Mers pe călcâie (`mers-pe-calcaie`)
6. Mers pe vârfuri (`mers-pe-varfuri`)
7. Fandare cu rotația trunchiului (`fandare-cu-rotatie`)
8. Pași laterali adăugați (`pasi-laterali`)
9. Alergare ușoară în linie dreaptă (`alergare-usoara`)
10. Deschideri de șold din mers (`deschideri-de-sold`)
11. Închideri de șold din mers (`inchideri-de-sold`)
12. Alergare cu pași laterali în jurul partenerului (`alergare-in-jurul-partenerului`)
13. Alergare cu săritură și contact umăr la umăr (`alergare-cu-contact-de-umar`)
14. Alergare rapidă înainte și înapoi (`alergare-rapida-inainte-inapoi`)
15. Alergare în tempo, pe lățimea terenului (`alergare-cu-accelerare`)
16. Pași săriți (alergare cu salturi) (`pasi-sariti`)

**Forță (7)**

1. Îndreptare românească pe un picior (`indreptare-romaneasca-pe-un-picior`)
2. Fandare laterală (`fandare-laterala`)
3. Ridicări pe vârfuri pe un picior (`ridicari-pe-varfuri-un-picior`)
4. Genuflexiune pe un picior, la cutie (`genuflexiune-pe-un-picior-la-cutie`)
5. Fandare înainte (`fandare-inainte`)
6. Genuflexiune cu greutatea corpului (`genuflexiune`)
7. Hip thrust (împingeri de bazin cu spatele pe bancă) (`hip-thrust`)

### Efort de filmare

Un exercițiu durează 3–4 minute cu tot cu așezarea echipamentului și o dublă.

| Ședință | Conținut | Durată estimată | Ce trebuie pregătit |
|---|---|---|---|
| 1 | Prioritatea 1 (34 de exerciții) | 2–2,5 ore | Saltea, benzi elastice, treaptă sau cutie, bancă, minge, discuri de alunecare, rulou, ganteră ușoară |
| 2 | Prioritatea 2 (25 de exerciții) | 1,5–2 ore | Saltea, bancă, bandă, placă de echilibru, cutie; un coleg pentru Nordic și Copenhagen |
| 3 | Prioritatea 3 (36 de exerciții) | 2–2,5 ore | Jumătate în sală (saltea, rulou, minibandă, bară, gantere), jumătate pe teren (conuri, un coleg) |

În total, 6–7 ore de filmare, cu un demonstrant și un telefon pe trepied. Tăierea și încărcarea mai cer 1–2 minute pe clip, adică încă 2–3 ore. Dacă timpul e scurt, prima ședință singură acoperă ce folosește zilnic stafful medical.

### Mini-ghid de filmare

- **Cadru:** telefon pe trepied, în format orizontal, la înălțimea șoldului. Tot corpul în cadru, cu puțin spațiu deasupra capului și sub tălpi. Fundal simplu.
- **Unghi:** din lateral la cele mai multe exerciții; din față când contează alinierea genunchilor (genuflexiuni, aterizări, echilibru). Dacă e nevoie de ambele unghiuri, se filmează pe rând, în același clip.
- **Durată:** 10–20 de secunde, adică 2–4 repetări lente și curate. La mențineri ajung 8–10 secunde.
- **Lumină:** naturală sau lumina sălii, din fața ori din lateralul demonstrantului, niciodată din spatele lui.
- **Sunet:** fără muzică și fără comentariu; clipul se poate încărca fără sunet.
- **Persoane:** demonstrantul poartă echipament simplu. **Fără fețe de minori dacă nu există acordul scris al părinților**; cel mai simplu este ca demonstrantul să fie major. Nimeni altcineva în cadru.
- **Format:** MP4, 1080p sau 720p, **sub 100 MB** (limita de încărcare a aplicației). Un clip de 15 secunde are de obicei 15–30 MB.
- **Unde se încarcă:** Exerciții → exercițiul → Modifică → Clip. La `Sursă`, `Licență` și `Atribuire` se completează valorile din secțiunea 4, rândul „Clip filmat de club”.
- **Un clip pe exercițiu.** Variantele mai ușoare sau mai grele rămân în descriere.

## 6. Ce nu am putut verifica

1. **Conținutul API-ului wger**: numărul de clipuri, licența fiecăruia, acoperirea recuperării, traducerile de exerciții în română. Adresa este exclusă prin `robots.txt` pentru unealta folosită.
2. **Codul-sursă wger** pentru câmpurile de licență: denumirile vin din surse secundare.
3. **Textul fișierului de licență din free-exercise-db** și proveniența fotografiilor; fișierele individuale nu au putut fi deschise.
4. **Termenii de utilizare ExerciseDB** (pagina nu se poate citi automat) și condițiile de pe RapidAPI.
5. **ExRx.net**: paginile de API și de licențiere sunt excluse prin `robots.txt`.
6. **Prețul exact Physitrack pentru România** și condițiile planului Enterprise; prețul Wibbi; existența unui API la Rehab My Patient.
7. **O adresă oficială FIFA** pentru manualul sau clipurile 11+ și mențiunea de copyright din manualul pentru seniori.
8. **Acoperirea kinetoterapiei la Hyperhuman**.
9. **Termenii API YouTube** în detaliu: am citit doar pagina de ajutor despre încorporare.

Prețurile sunt cele afișate la data verificării și se pot schimba.
