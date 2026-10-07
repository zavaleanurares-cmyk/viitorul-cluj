# Decizii, presupuneri și ce a rămas de făcut

Document pentru club. Spune ce s-a hotărât în locul vostru pe parcursul construcției, unde s-a abătut aplicația de la specificație (`docs/cerinte.md`) și ce aveți de făcut înainte de folosirea cu date reale. Detaliile tehnice sunt în `docs/decizii/`, câte un fișier pe modul. Stare la 7 octombrie 2026.

## 1. Pe scurt

1. **Stackul este altul decât în specificație**, la cererea clientului: Postgres pe Neon, autentificare proprie, fișiere în Vercel Blob, găzduire pe Vercel — în loc de Supabase. Cost zero; permisiunile au rămas impuse în baza de date.
2. **Aplicația este publicată** la https://viitorul-cluj.vercel.app, cu două cluburi: „Viitorul Cluj” (datele reale) și „Club Demo” (date inventate).
3. **Cele două tabele ale clubului sunt importate**: 115 jucători în 5 grupe, cu stările lor, plus chestionarele grupei Liga 3. În evidență sunt 117 jucători, pentru că grila de oboseală conține doi jucători care lipsesc din tabelul de stare. Opt jucători sunt marcați „de verificat”.
4. **Săptămâna grilei de oboseală este o presupunere**: fișierul nu o spune, așa că a fost importată ca 28 septembrie – 4 octombrie 2026.
5. **Listele nominale (TFB) și un export K-Sport nu au fost primite.** Importatoarele există și au fost testate pe fișiere-mostră generate; trebuie reverificate pe fișiere reale.
6. **Biblioteca are 95 de exerciții și 10 programe, cu texte, dar niciun clip.** Nicio sursă liberă nu acoperă recuperarea cu video; recomandarea este ca clubul să-și filmeze clipurile.
7. **Mementoul de chestionar nu pleacă la ora exactă**, ci la prima dintre cele două rulări zilnice de după ora setată (limită a planului gratuit Vercel).
8. **E-mailul nu este configurat.** Notificările apar doar în aplicație, iar linkurile de invitație se copiază de mână.
9. **Înainte de date reale:** conturi reale, validarea juridică a textelor de consimțământ, acordurile părinților, domeniu și e-mail, o soluție de copii de siguranță (acum există doar un istoric de 6 ore).
10. **Nu există autentificare în doi pași.** Este cea mai importantă îmbunătățire de securitate rămasă.

## 2. Abateri de la specificație

| Ce cerea specificația | Ce s-a făcut | De ce |
|---|---|---|
| Supabase (Postgres, Auth, Storage, RLS), găzduire pe Netlify sau Vercel | Postgres pe **Neon** (plan Free, Frankfurt), **autentificare proprie**, fișiere în **Vercel Blob** (depozit privat), găzduire pe **Vercel** (funcții la Frankfurt) | Vezi mai jos |
| Memento automat la o oră configurabilă | Memento la prima rulare de după ora setată; două rulări pe zi, la 7:00 și 17:00 UTC (10:00 și 20:00 vara, 9:00 și 19:00 iarna) | Planul gratuit Vercel permite doar sarcini programate zilnice. Limita exactă nu a putut fi confirmată din documentația Vercel — de reverificat. Cardul „Chestionarul de azi” apare oricum când jucătorul deschide aplicația. Pe un plan plătit se trece la rulare orară schimbând o linie în `apps/web/vercel.json`. |
| Clipuri de execuție dintr-o sursă liberă | Niciun clip. Preparatorul poate încărca un clip sau lipi un link YouTube/Vimeo la fiecare exercițiu. | Sursele libere (wger, free-exercise-db) sunt orientate spre sală, nu spre recuperare; cele comerciale nu permit scoaterea clipurilor. Cercetarea și lista exercițiilor de filmat: `docs/surse-exercitii.md`. |
| Documente medicale cu linkuri semnate, cu expirare | Documentele nu au niciun link care să funcționeze fără sesiune. Fiecare deschidere trece prin aplicație, care verifică dreptul și jurnalizează. | Mai strict decât cerința. Linkuri semnate (5 minute) se folosesc doar pentru clipurile de exerciții, care nu sunt date personale. |
| Patronul vede „tot clubul, privire de ansamblu” | Patronul vede **doar cifre**, fără niciun nume | Acces minim necesar (secțiunea 5 a specificației). Vezi secțiunea 5 de mai jos. |
| Notificări pe e-mail | Scrise, dar inactive până la configurare. E-mailul este un rezumat neutru („Alertă nouă (3)”), fără nume și fără stări. | Lipsesc cheia Resend și un domeniu al clubului. Fără date medicale în e-mail, din prudență. |
| Fișierul de import este trimis și prelucrat | Fișierul este citit în browser; la server ajung doar rândurile interpretate | Tabelul clubului nu este stocat nicăieri în aplicație. |
| Jurnal de audit pentru fiecare acces și modificare | Se jurnalizează modificările, vizualizările de fișă (o dată la 5 minute pe persoană, jucător și secțiune), descărcările, exporturile, autentificările. **Nu** se jurnalizează bifele exercițiilor, notificările, alertele și fiecare rând de date GPS. | Volumul ar face jurnalul greu de citit; importul GPS apare ca o singură înregistrare. |

### Stackul, pe larg

Clientul a cerut întâi Vercel în loc de Netlify. Apoi: planul gratuit Supabase permite doar două proiecte active pe cont, iar contul clientului le avea deja ocupate cu alte produse; integrarea Supabase din Vercel Marketplace cerea și ea trecerea pe plan plătit. Clientul a ales explicit „altceva decât Supabase”, gratuit.

**Ce a rămas la fel.** Row Level Security. Fiecare interogare a aplicației se execută într-o tranzacție cu rolul `authenticated` și cu identitatea utilizatorului. Codul scrie interogările în aceeași sintaxă ca la Supabase (`db.from(...).select(...)`); ele sunt traduse în SQL în interiorul aplicației (`packages/db/src/rest.ts`).

| Câștigat | Pierdut față de Supabase |
|---|---|
| cost zero | autentificarea și stocarea fișierelor sunt cod al nostru, de întreținut |
| un singur furnizor de facturare (Neon este creat prin Vercel) | nu există actualizări în timp real (realtime) |
| fără limită de proiecte | nu există panou gata făcut de administrare a utilizatorilor (există ecranul Administrare → Conturi) |

**Drumul înapoi** este scurt pentru date și mai lung pentru conturi. Schema și politicile sunt Postgres standard; `app_auth.uid()` se înlocuiește cu `auth.uid()`. Rămân de rescris autentificarea (parolele ar trebui reinițializate) și de mutat fișierele în Supabase Storage.

**Efect asupra ghidului nativ:** `NATIVE.md` descrie aplicațiile mobile pe acest backend, nu pe Supabase.

## 3. Presupuneri despre datele clubului

S-au primit doar cele două Google Sheets: „STARE DE SANATATE” și „FATIGUE/STARE DE OBOSEALA/L3”.

**Tabelul de stare**

- 115 jucători: Liga 3 — 25, U21 — 21, U17 — 22, U16 — 21, U15 — 26. Grupa se deduce din rândurile de titlu („U21 NUME”, „U16”); primul bloc, fără titlu, este Liga 3.
- Stări: 99 APT, 4 OBOSEALĂ, 5 READAPTARE, 5 ACC, 2 ALT MOTIV. Textul liber se mapează pe una dintre cele cinci stări, iar textul original rămâne în observații („Se observa o stare de oboseala” → OBOSEALĂ; „Usor racit” → ALT MOTIV).
- **6 rânduri sunt marcate „de verificat”** și au fost importate cu ce s-a putut citi:

| Jucător | Grupă | Ce nu s-a putut citi |
|---|---|---|
| MARINCAS | Liga 3 | motivul absenței nu reiese din „REVINE DE LUNI IN ANTRENAMENT” |
| GLIGOR DENIS | U21 | zona „Ligament” nu este o zonă a corpului |
| CRACIUN MATEI | U21 | zona „Ligament” |
| FRICIU CODRUT | U21 | „5/10” trecut la zonă |
| BRANDUSAN | U17 | două zone posibile: „Genunchi/Coapsa?” |
| HORATIU | U16 | accidentat, fără zonă |

**Grila de oboseală (Liga 3)**

- **Săptămâna nu apare în fișier.** A fost importată ca săptămâna 28 septembrie – 4 octombrie 2026. Dacă este alta, se reimportă pe săptămâna corectă din ecranul Importuri.
- Au rezultat 21 de chestionare: 20 marți și unul miercuri. Atât conține grila. Un chestionar este marcat „de verificat”: „3/4” la încărcătură, importat ca 4.
- Zona dureroasă scrisă în engleză („hamstring”, „Knee”) este așezată pe harta corpului; în grila săptămânală se afișează cuvântul original, ca să arate ca tabelul clubului.
- **TELINA și HERCIU** apar în grilă, dar nu și în tabelul de stare. Au fost creați în Liga 3, cu starea APT, și marcați „de verificat”. De aici 117 jucători (Liga 3 are 27) și 101 APT.
- **DAMIAN** apare în grilă fără nicio valoare și există doar în U15. Rândul a fost sărit, nu potrivit cu jucătorul din altă grupă.

**Potrivirea numelor**

- Numele nu este cheie. Aplicația propune potriviri, iar preparatorul le confirmă; potrivirile confirmate se țin minte.
- La importul inițial, făcut fără un om în față, regula a fost prudentă: s-au acceptat doar potrivirile sigure din aceeași grupă („PATRICK” → KIS PATRICK, „DAVID P.” → DAVID POPTEAN). Restul au devenit jucători noi, „de verificat”.
- Numele complet este deocamdată egal cu numele din tabel. Numele complete și datele de naștere vin din listele nominale, care nu au fost primite. **Fără dată de naștere, aplicația nu știe cine este minor.**

**Ce nu a fost primit**

- **Listele nominale (evidența TFB)** și **un export-mostră K-Sport**. Importatoarele au fost testate pe fișiere-mostră generate de noi (antete în engleză și în italiană, CSV și XLSX).
- De știut: testele automate și importul local au rulat pe cele două tabele **transcrise** din Google Sheets, nu pe fișiere `.xlsx` descărcate direct. Dacă reimportați dintr-un fișier descărcat, verificați în previzualizare că blocurile și coloanele sunt recunoscute la fel.

## 4. Decizii pe module

### Jucător (`docs/decizii/jucator.md`)

- Ecranul „Azi” are ordinea: stare → chestionar → exerciții → efort (RPE). Chestionarul fără durere înseamnă două atingeri și „Salvează”; bifa unui exercițiu este o singură atingere.
- Jucătorul poate bifa pentru azi și pentru ultimele două zile. Chestionarul se completează doar pentru azi, iar data vine de la server, nu din telefon.
- Debifarea nu șterge comentariul sau durerea semnalată.
- „Retrage acordul” din profil doar înregistrează o cerere către preparator. Nu blochează singură contul, ca jucătorul să nu rămână pe dinafară înainte ca clubul să răspundă.
- Evoluția pe 28 de zile se arată pe săptămâni, nu pe zile, ca să poată fi citită pe telefon.

### Jucători și medical (`docs/decizii/jucatori-medical.md`)

- La adăugarea unei accidentări, „Actualizează și starea la ACC” este bifat implicit. La completarea revenirii reale se oferă „Marchează jucătorul APT”.
- O accidentare este activă până i se completează data reală de revenire.
- „Zile indisponibile în sezon” se calculează din accidentări, nu din istoricul stărilor: ALT MOTIV nu intră, iar două accidentări suprapuse nu se numără de două ori.
- Pentru starea APT, zona, data de revenire și restricțiile se șterg la salvare.
- „Reînnoită azi” pune expirarea vizei medicale la azi + 6 luni. Avertizarea apare cu 30 de zile înainte. Ambele valori se pot schimba din Administrare → Club.
- O trimitere către partenerul medical nu se șterge, doar se închide. Partenerul vede doar accidentarea trimisă și documentele ei.
- Acordul pe hârtie al părintelui se înregistrează în fișa jucătorului, cu data semnării.

### Exerciții, programe, planuri (`docs/decizii/exercitii-programe-planuri.md`)

- Sursa, licența și atribuirea sunt obligatorii când un exercițiu are clip sau imagine.
- Un exercițiu folosit într-un program sau plan nu se poate șterge, doar dezactiva. Un program cu alocări nu se poate șterge, doar arhiva.
- Aderența = exerciții bifate / exerciții programate, de la începutul alocării până azi inclusiv. Ziua de azi apare ca „nefăcut” până bifează jucătorii.
- Se pot crea planuri și pentru zile trecute (evidență retroactivă).
- La copierea unui plan către alți jucători nu se copiază legătura cu accidentarea.

### Chestionare și date fizice (`docs/decizii/chestionare-date-fizice.md`)

- Pe ecran lat se vede grila săptămânii; pe telefon, lista zilei de azi.
- Pragurile de alertă implicite: oboseală sau încărcătură de la 8 în sus, creștere de 3 puncte față de media personală, orice durere raportată, 3 zile fără completare. Se schimbă din Administrare → Club.
- Preparatorul poate introduce sau corecta un chestionar în locul jucătorului. Corectarea unui rând importat nu generează alerte.
- Rata de completare nu exclude zilele libere: aplicația nu știe care sunt.
- Raportul acut:cronic este prezentat ca reper orientativ, fără praguri de „risc”.
- Media grupei la un test fizic apare doar de la 3 jucători cu rezultat.
- Testele fizice implicite: sprint 10 m, sprint 30 m, săritură CMJ, Yo-Yo IR1, agilitate 5-0-5.

### Importuri (`docs/decizii/importuri.md`)

- Cinci tipuri: stare de sănătate, chestionar săptămânal, listă nominală, date fizice, teste fizice. Același flux: fișier → previzualizare și mapare → potrivirea jucătorilor → confirmare → raport.
- Se decid fără întrebare doar potrivirile sigure și, la importurile care creează jucători, numele fără niciun candidat. Tot restul cere o decizie explicită.
- La date fizice și teste nu se creează jucători noi; cei nepotriviți sunt săriți și apar în raport.
- Importul repetat al aceluiași fișier nu dublează datele. Cheia unei sesiuni fizice este club + dată + nume + sursă.
- Șabloanele de mapare se salvează pe textul antetelor, deci rezistă la reordonarea coloanelor. Există doar pentru date fizice.
- Lista nominală completează nume complet, dată de naștere, post, număr, picior. Nu atinge numele de afișare și nu șterge nimic.

### Tablouri, rapoarte, notificări (`docs/decizii/tablou-rapoarte-notificari.md`)

- Antrenorul nu are tablou de bord; pornește din tabloul de disponibilitate.
- „Chestionare lipsă azi” numără toți jucătorii activi, nu doar pe cei cu cont.
- Rapoartele (fișa jucătorului în PDF, raportul săptămânal în PDF sau Excel, lista jucătorilor în Excel) sunt doar pentru preparator, iar fiecare descărcare este jurnalizată.
- Fișa PDF nu include datele de contact: nu sunt necesare într-un document medical care circulă.
- În raportul săptămânal, disponibilitatea este cea de azi, nu cea din săptămâna aleasă.

### Administrare (`docs/decizii/administrare.md`)

- Conturile se creează doar de către preparator. Invitația este valabilă 7 zile, resetarea 24 de ore; un link nou îl anulează pe cel vechi.
- Un preparator nu își poate dezactiva sau șterge propriul cont și nu își poate schimba rolul dacă este ultimul.
- Un cont de jucător nu poate deveni cont de staff și invers.
- Cele cinci stări implicite nu pot fi dezactivate: importul se bazează pe ele. Se pot adăuga altele.
- Anonimizarea și ștergerea definitivă se pot face doar pentru un jucător inactiv sau pornind de la o cerere a lui. La anonimizare, contul își pierde și adresa de e-mail.
- După anonimizare sau ștergere, jurnalul de audit păstrează cine, ce și când, dar nu și valorile vechi.
- Perioada de păstrare implicită este de 36 de luni de la dezactivarea fișei. Aplicația listează jucătorii cu perioada expirată; nu șterge nimic singură.

## 5. Permisiuni și protecția datelor

Regulile sunt impuse în baza de date și verificate automat (secțiunea 7). Tabelul complet și temeiurile sunt în `GDPR.md`, secțiunile 2–4. Hotărârile care schimbă ce vede cineva:

- **Patronul vede doar cifre**: câți jucători, câți disponibili, câte accidentări, tendințe. Niciun nume, niciun diagnostic.
- **Directorul sportiv vede fișa sumară**: starea, zona, observația, data estimată de revenire, restricțiile, istoricul stărilor și datele de profil. Nu vede accidentări, diagnostice, documente, chestionare, date fizice, date de contact.
- **Antrenorul vede fișa medicală completă a grupelor lui**, doar în citire, inclusiv trimiterile către partenerul medical. Este cerința specificației; `GDPR.md`, secțiunea 3, o justifică și propune alternative mai restrictive. **Nu vede datele de contact** ale jucătorilor, nici în grupa lui.
- **Jucătorul nu își poate schimba starea medicală**, accidentările sau rolul.
- **Partenerul medical** nu vede chestionarele, datele fizice, datele de contact și nici fotografia. După închiderea trimiterii nu mai vede nimic.
- **Un cont dezactivat nu mai vede nimic**, chiar dacă are o sesiune deschisă.
- **Jurnalul de audit** îl vede doar preparatorul și nu poate fi modificat de nimeni.
- **Consimțământul** se cere la prima autentificare. Textul spune explicit că antrenorii văd fișa medicală completă. Pentru minori se cere acordul părintelui. Textele sunt propuneri de lucru, nu texte validate juridic.

De rezolvat: textul de consimțământ nu menționează că directorul sportiv vede și data nașterii și istoricul stărilor. Fie se completează textul, fie se restrânge accesul (`GDPR.md`, secțiunea 10, punctul 1).

## 6. Ce a rămas de făcut

### a) Acțiuni ale clubului, în afara aplicației

- **Clinica parteneră (Athletic Med):** contactarea și stabilirea colaborării. Rolul „Partener medical” este pregătit și are un cont demo.
- **Acordurile semnate ale părinților**, pe hârtie, pentru toți minorii, apoi înregistrate în fișa fiecărui jucător.
- **Clipurile de exerciții:** filmare sau licențiere. Trei ședințe de 2–3 ore acoperă toată biblioteca; prima (34 de exerciții de recuperare) este cea care contează. Lista și un mic ghid de filmare: `docs/surse-exercitii.md`, secțiunea 5.
- **Validarea juridică** a textelor de consimțământ și a temeiurilor, plus pașii din `GDPR.md`, secțiunea 9 (DPO, evaluare de impact, registru de prelucrări, acorduri cu furnizorii).
- **Un domeniu propriu** și un cont Resend pentru e-mail.
- **Fișierele reale:** listele nominale TFB și un export K-Sport.

### b) Înainte de folosirea cu date reale, în ordine

1. **Conturi reale.** Creați conturile de staff cu adresele reale, apoi dezactivați sau ștergeți conturile demo ale clubului Viitorul Cluj. Parolele demo au fost predate separat; schimbați-le până atunci.
2. **Cei 8 jucători „de verificat”** și săptămâna grilei de oboseală (secțiunea 3).
3. **Listele nominale**, importate din ecranul Importuri: fără date de naștere nu se știe cine este minor și cui trebuie cerut acordul părintelui.
4. **Validarea GDPR** și alinierea textului de consimțământ cu accesul directorului sportiv.
5. **Domeniu și e-mail** (`README.md`, secțiunea 6.3). Fără e-mail, fiecare invitație se trimite de mână.
6. **Copii de siguranță.** Neon păstrează acum un istoric de restaurare de 6 ore; fișierele nu au copie. Hotărâți un export periodic sau un plan plătit.
7. **Un import K-Sport real**, verificat cap-coadă, apoi salvat ca șablon.
8. **Verificări în producție** care nu s-au putut face local: descărcarea unui PDF (fontul încorporat), încărcarea unui document și a unui clip în Vercel Blob, un e-mail real, o rulare a sarcinilor programate, regiunea depozitului Blob (`fra1`).
9. **Clipurile**, măcar pentru exercițiile de recuperare.

### c) Limite cunoscute și defecte minore

**Securitate și date**

- Nu există autentificare în doi pași. Un cont de preparator compromis expune tot clubul.
- Nu există antet `Content-Security-Policy` pentru pagini și nici listă a sesiunilor active. Sesiunea durează 30 de zile.
- Nimic nu se șterge automat la expirarea perioadei de păstrare; preparatorul trebuie să parcurgă lista.
- Rapoartele de import pot păstra nume și nu sunt curățate la anonimizare.
- La ștergerea unui cont de staff, jurnalul păstrează numele și e-mailul contului șters.
- După anonimizarea unui jucător cu cont rămâne un cont gol, de șters de mână.
- Aplicația nu împiedică introducerea datelor medicale pentru un jucător fără acord înregistrat; doar îl listează.
- Fișiere orfane: un clip sau un document încărcat, dar nesalvat (filă închisă la mijloc), rămâne în depozit. Ocupă spațiu; nu este vizibil nimănui.

**Importuri**

- Nu există „anulează importul”. Un reimport corectează valorile, dar nu șterge rânduri.
- Un import de date fizice foarte mare (câteva mii de rânduri; cel mult 5 000) trebuie împărțit pe perioade.
- Fișierele `.xls` vechi și cele protejate cu parolă nu se citesc; se salvează ca `.xlsx`.
- Deciziile „sari peste” nu se țin minte: la reimport, numele cere din nou o decizie.
- Propunerile de potrivire pot fi greșite la nume care încep la fel („POPESCU” → „POP”). De aceea se confirmă una câte una.
- Detaliul postului („Fundaș central”) din lista nominală nu se păstrează, doar categoria.
- La importul de date fizice, valorile numerice se rotunjesc la o zecimală (la teste se păstrează două).

**Planuri, programe, chestionare**

- O alocare de program nu se poate modifica după creare: se oprește și se creează alta.
- Același jucător poate primi același program de două ori (prin grupă și individual), fără avertizare.
- Vederea săptămânală a planurilor nu arată și programele alocate; ele apar în fișa jucătorului.
- Preparatorul nu poate introduce RPE în locul jucătorului. Jucătorul îl introduce doar pentru azi.
- Ștergerea unui chestionar nu închide alertele deja create pentru acea zi.
- Salvarea unei accidentări și schimbarea stării sunt două scrieri separate. Dacă a doua eșuează, accidentarea rămâne salvată și apare o eroare.
- Un document medical nu se poate redenumi; se șterge și se încarcă din nou.

**Rapoarte și interfață**

- Rapoartele au doar tabele, fără grafice. Tabloul patronului nu are export PDF; se poate tipări din browser.
- Graficele cu bare afișează valorile cu punct zecimal („32.9”).
- O adresă inexistentă arată „Pagina nu există”, dar cu codul tehnic 200 în loc de 404. Fără efect pentru utilizator.
- Filtrele jurnalului de audit ocupă mult loc pe telefon.
- Jucătorul nu are mod offline: fără conexiune vede eroarea și reîncearcă.

**Administrare**

- Un club nou nu se poate crea din interfață (`README.md`, secțiunea 5.4).

### d) Îmbunătățiri posibile

- Autentificare în doi pași, cel puțin pentru preparator.
- Rulare orară a sarcinilor programate (plan Vercel plătit), pentru memento la ora setată.
- Curățarea periodică a fișierelor orfane și ștergerea automată la expirarea perioadei de păstrare.
- Un ecran pentru crearea unui club nou.
- „Anulează importul”.
- Salvarea atomică a accidentării împreună cu starea.
- Disponibilitatea istorică în raportul săptămânal.
- Încărcarea imaginii unui exercițiu (acum doar link).
- Aplicațiile native, cu notificări push și mod offline (`NATIVE.md`).

## 7. Criteriile din secțiunea 11 a specificației

| Criteriu | Stare | Cum a fost verificat |
|---|---|---|
| Câte un cont demo pentru fiecare rol; fiecare vede exact ce are voie, inclusiv la încercări de acces neautorizat | **Îndeplinit** | `npm run test:rls`: 162 de verificări pe roluri, toate trecute, pe baza de date locală. În plus, fiecare modul a fost deschis în browser cu roluri care nu ar trebui să-l vadă. Contul de jucător demo este în Club Demo; Viitorul Cluj nu are încă jucători cu cont. Testul automat nu a fost rulat pe baza de date din producție (schema este aceeași, aplicată de aceleași migrări). |
| Un antrenor nu ajunge, pe nicio cale, la datele altei grupe și nu poate modifica nimic | **Îndeplinit** | Aceleași teste: jucător din altă grupă cerut direct după identificator, modificarea stării în grupa lui, documente, export. În browser: fișa unui jucător din altă grupă răspunde „nu există”. |
| Cele două tabele se importă cap-coadă: 115 jucători în 5 grupe, cu stările lor, plus istoricul de oboseală al Ligii 3 | **Îndeplinit, cu precizări** | Importate prin aceleași funcții ca ecranul de import și, separat, prin ecran, pe un club de test; `npm test` verifică cifrele. 115 jucători (25 / 21 / 22 / 21 / 26), 6 „de verificat”; 21 de chestionare. Precizări: 117 jucători în evidență, săptămâna este presupusă, fișierele folosite sunt transcrieri ale tabelelor (secțiunea 3). |
| Un jucător completează chestionarul și bifează planul zilei de pe telefon în sub un minut | **Îndeplinit ca proiectare; nemăsurat cu jucători reali** | Parcurs în browser la 390 px, cu conturile de jucător demo: chestionar din două atingeri și „Salvează”, bifă dintr-o atingere. Nu a fost cronometrat pe telefoane reale, la teren. |
| Importul unui CSV/XLSX funcționează cap-coadă, cu raport | **Îndeplinit pe fișiere-mostră** | Date fizice (CSV și XLSX, antete în engleză și italiană), teste fizice și listă nominală, importate prin ecran, cu raport și reimport fără dubluri. Niciun fișier real K-Sport sau TFB nu a fost disponibil. |
| Aplicația este publicată pe un URL și documentația este completă | **Îndeplinit, cu verificări rămase** | https://viitorul-cluj.vercel.app; proiectul Vercel are un build de producție reușit. `README.md`, `DECIZII.md`, `GDPR.md`, `NATIVE.md` există. Neverificate în producție: PDF-urile, încărcarea în Vercel Blob, e-mailul real, sarcinile programate (punctul 8 din secțiunea 6b). |
