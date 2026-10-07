# Protecția datelor în aplicație

Document pentru conducerea clubului și pentru responsabilul cu protecția datelor (DPO). Descrie ce face aplicația cu datele personale, cine le vede și ce are clubul de făcut în afara ei.

**Acest document nu este consultanță juridică.** Temeiurile juridice de la secțiunea 4 și textele de consimțământ din aplicație sunt propuneri de lucru. Înainte de folosirea cu date reale, ele trebuie validate de un jurist sau de DPO-ul clubului.

Fiecare afirmație tehnică trimite la locul din cod unde poate fi verificată. Căile sunt relative la rădăcina proiectului. Ultima verificare: 7 octombrie 2026.

**Trei lucruri de știut înainte de orice altceva**

1. Aplicația prelucrează date de sănătate, inclusiv ale minorilor. Pentru o parte dintre jucători, clubul ține date fără ca ei să aibă cont: acordul lor (sau al părinților) nu poate fi dat pe ecran și trebuie obținut pe hârtie (secțiunea 5).
2. Antrenorii văd fișa medicală completă a grupei lor. Este o alegere a clubului, justificată la secțiunea 3, pe care DPO-ul trebuie să o confirme.
3. Directorul sportiv vede ceva mai mult decât spune acum textul de consimțământ (secțiunea 10, punctul 1). Textul sau accesul trebuie aliniate înainte de lansare.

---

## 1. Ce date se colectează și despre cine

Persoanele vizate sunt jucătorii (inclusiv minori), părinții sau tutorii lor și membrii staffului care au cont.

| Categorie | Ce conține | Despre cine | Unde se păstrează |
|---|---|---|---|
| Identificare | nume complet, nume de afișare, data nașterii, grupă, post, picior de bază, număr, fotografie | jucători | tabelul `players`; fotografia în depozitul de fișiere, `avatars/` |
| Contact | telefon, e-mail; numele, telefonul și e-mailul părintelui sau al tutorelui | jucători, părinți | `player_contacts` (tabel separat, cu acces mai strict) |
| Conturi | nume, e-mail, telefon, rol, grupele antrenorului | toți utilizatorii | `profiles`, `staff_groups`, `app_auth.users` |
| **Sănătate** (categorie specială, art. 9 GDPR) | starea medicală curentă și istoricul ei, zona accidentată, observații, restricții de antrenament; accidentări (tip, mecanism, diagnostic, severitate, date de revenire, note); tratamente; data de expirare a vizei medicale; trimiteri către partenerul medical și notele lui | jucători | `players`, `status_history`, `injuries`, `injury_treatments`, `referrals`, `partner_notes` |
| Documente medicale | RMN, ecografii, radiografii, scrisori medicale, analize, acorduri semnate scanate | jucători | fișierele în depozit, `medical/`; evidența în `medical_documents` |
| Chestionare zilnice | oboseală, încărcătură musculară, zonă dureroasă și intensitate, notă; opțional somn, stres, dispoziție; efort perceput (RPE) și durata antrenamentului | jucători | `wellness_entries`, `rpe_entries` |
| Date fizice | înălțime, greutate, procent de grăsime; rezultate la teste; date GPS pe sesiune (distanțe, sprinturi, viteză, accelerări, puls) | jucători | `anthropometrics`, `fitness_test_results`, `physical_metrics` |
| Pregătire | planuri zilnice, programe alocate, exerciții bifate, comentarii, durere semnalată la exerciții | jucători | `daily_plans`, `program_assignments`, `exercise_completions` |
| Alerte și notificări | alerte către preparator (oboseală, durere, chestionar lipsă, viză), notificări în aplicație | jucători, staff | `alerts`, `notifications` |
| Consimțământ și cereri | cine a acceptat, când, ce versiune a textului, numele părintelui; cererile de corectare, ștergere, retragere | jucători, părinți, staff | `consents`, `data_requests` |
| Date tehnice | jurnal de audit (cine, ce, când); sesiuni (adresă IP, tipul browserului, momentul ultimei activități); încercări de autentificare (e-mail, IP, reușită sau nu) | toți utilizatorii | `audit_log`, `app_auth.sessions`, `app_auth.login_attempts` |

Datele unui jucător intră în aplicație pe patru căi: le scrie preparatorul, le importă preparatorul din tabelele clubului și din K-Sport, le completează jucătorul (chestionar, bife, contact) și le adaugă partenerul medical (note și documente pe cazul trimis).

Aplicația nu colectează CNP, serii de acte, date bancare sau localizare a telefonului și nu folosește instrumente de analiză ori publicitate ale terților.

Schema completă: `db/migrations/20261007000100_schema.sql`.

---

## 2. Cine vede ce

Permisiunile sunt impuse în baza de date, prin Row Level Security (RLS), nu doar în interfață: o cerere care ocolește ecranele primește tot numai rândurile permise rolului. Regulile sunt în `db/migrations/20261007000200_rls.sql`, cu corecțiile din `…000600_corectii.sql`.

Dovada este `scripts/test-rls.ts` (se rulează cu `npm run test:rls`). Scriptul creează două cluburi de test, intră pe rând cu fiecare rol și încearcă atât ce este permis, cât și ce este interzis. La 7 octombrie 2026 toate cele **162 de verificări** au trecut.

| Rol | Ce vede | Ce poate modifica | Verificări din `test-rls.ts` (exemple) |
|---|---|---|---|
| **Patron** | Doar cifre de ansamblu pe club și pe grupe (funcția `club_overview`): câți jucători, câți disponibili, câte accidentări. Niciun rând individual, niciun nume. | Nimic | „nu vede niciun jucător”; „privirea de ansamblu nu conține nume”; „nu vede jurnalul de audit”; „patronul NU poate citi documente” |
| **Director sportiv** | Fișa sumară a fiecărui jucător din club: rândul din `players` (nume, data nașterii, grupă, post, starea curentă cu zonă, observații, data estimată de revenire, restricții, data expirării vizei), istoricul stărilor, fotografia. **Nu vede** accidentările, diagnosticele, tratamentele, documentele, chestionarele, datele fizice, planurile, datele de contact. | Nimic | „vede toți jucătorii clubului lui”; „nu vede injuries / medical_documents / wellness_entries…”; „nu poate exporta datele unui jucător”; „directorul NU poate citi documente” |
| **Preparator fizic** | Tot, pentru toate grupele clubului lui, inclusiv conturile, jurnalul de audit și cererile GDPR. Nimic din alt club. | Tot, în clubul lui. Jurnalul de audit nu îl poate modifica nici el. | „NU vede jucătorul din alt club”; „NU poate modifica alt club”; „NU poate scrie direct în jurnalul de audit”; „NU poate șterge din jurnalul de audit” |
| **Antrenor** | Doar grupele la care este alocat: tabloul de disponibilitate și fișa medicală completă (secțiunea 3). | Nimic | „vede doar jucătorii din G1”; „NU vede jucătorul din G2 (cerut direct după id)”; „NU vede datele de contact (nici în grupa lui)”; „NU poate modifica starea unui jucător din grupa lui” |
| **Jucător** | Doar datele lui: fișa, accidentările și documentele lui, chestionarele, planurile, programele, notificările. | Chestionarul zilei (doar azi), efortul perceput (azi și ieri), bifele exercițiilor (azi și ultimele 2 zile), datele de contact, fotografia, numele și telefonul contului. Nu își poate schimba starea medicală, accidentările sau rolul. | „vede doar fișa lui”; „NU vede alți jucători (cerut după id)”; „NU poate completa retroactiv”; „NU își poate schimba starea medicală”; „NU poate exporta datele altuia” |
| **Partener medical** | Doar jucătorii trimiși explicit către el, cât timp trimiterea este activă: rândul jucătorului din `players`, accidentarea trimisă (sau toate, dacă trimiterea nu indică una), tratamentele ei, documentele cazului. **Nu vede** chestionarele, datele fizice, datele de contact. | Adaugă note și documente pe cazurile lui; își poate șterge propriile note și documente. | „vede doar jucătorul trimis către el”; „NU vede chestionarele”; „după închiderea trimiterii nu mai vede nimic”; „partenerul NU poate suprascrie un document existent al jucătorului” |

Reguli valabile pentru toate rolurile:

- Fără autentificare nu se vede nimic. Rolul `anon` nu are niciun drept pe niciun tabel („anon nu citește …”, „fără autentificare nu există acces la fișiere”).
- Un cont dezactivat nu mai vede nimic, chiar dacă ar avea încă o sesiune deschisă: funcțiile `private.my_role()` și `private.my_club()` cer `profiles.is_active` („un cont dezactivat nu mai vede nimic”). La dezactivare, aplicația îi șterge și sesiunile.
- Un utilizator își vede doar propriul cont. Numai preparatorul vede lista conturilor clubului („nu vede alte conturi”).
- Nimeni nu își poate schimba singur rolul sau grupele („NU își poate schimba rolul”, „NU își poate adăuga singur o grupă”).
- Fișierele urmează aceleași reguli ca rândurile din tabele (`file_access`, în `…000500_files.sql`): un document medical poate fi citit doar de cine vede rândul lui din `medical_documents`.

Administrarea (conturi, grupe, stări, setările clubului, jurnal, GDPR) este doar a preparatorului. Verificat în browser la 7 octombrie 2026: antrenorul, directorul, patronul, jucătorul și partenerul medical sunt redirecționați de pe toate paginile `/administrare/*`, iar acțiunile de server răspund „Nu ai dreptul să faci această operațiune”. Un preparator care trimite de mână identificatorul unui cont din alt club primește „Contul nu există sau nu aparține clubului tău”.

---

## 3. Accesul antrenorilor la fișa medicală completă a grupei lor

Este punctul cel mai sensibil al aplicației și merită o decizie explicită a clubului.

### Ce văd

Pentru jucătorii din grupele la care sunt alocați, antrenorii văd:

- starea curentă, zona, observațiile, data estimată de revenire, restricțiile de antrenament;
- accidentările cu diagnostic, tip, mecanism, severitate, etapă de revenire, note și tratamente;
- documentele medicale (le pot deschide și descărca);
- trimiterile către partenerul medical și notele acestuia;
- chestionarele zilnice, efortul perceput, măsurătorile, testele și datele GPS;
- istoricul stărilor și al grupelor.

Regula este funcția `private.can_read_player_medical` din `…000200_rls.sql`: antrenor + jucătorul este acum într-una dintre grupele lui.

### Limitele impuse

- **Doar grupele lui.** Un antrenor nu ajunge la un jucător din altă grupă nici dacă îi cere fișa direct după identificator („NU vede jucătorul din G2 (cerut direct după id)”, „NU vede accidentarea din G2 cerută după id”, „antrenorul NU poate citi documentul din altă grupă”).
- **Accesul urmează grupa curentă.** Când jucătorul este mutat în altă grupă, vechiul antrenor îl pierde imediat, cu tot cu istoric („după mutarea în G1…”).
- **Doar citire.** Antrenorul nu poate adăuga, modifica sau șterge nimic („NU poate modifica o accidentare”, „antrenorul NU poate încărca documente”, „antrenorul NU poate șterge documente”).
- **Fără date de contact.** Telefonul, e-mailul și datele părinților nu îi sunt vizibile („NU vede datele de contact (nici în grupa lui)”).
- **Fără planuri și programe individuale** și fără jurnalul de audit, alerte sau conturi.
- **Fiecare accesare este jurnalizată.** Deschiderea fișei, a secțiunii medicale, a chestionarelor, a datelor fizice sau a documentelor scrie o intrare „Vizualizare” în jurnalul de audit, cu cine, ce jucător, ce secțiune și când (`log_medical_access`, în `…000400_rpc.sql`; „citirea fișei se jurnalizează”). Descărcarea unui document se jurnalizează separat. Preparatorul le vede în Administrare → Jurnal, filtrul „Accesări ale fișelor medicale”.
- **Regulile de confidențialitate.** La prima intrare, antrenorul acceptă un text prin care se obligă să folosească datele doar pentru activitatea clubului, să nu le copieze și să nu le transmită (`consentText("staff", …)` în `packages/shared/src/consent.ts`).

### De ce

Justificarea propusă de club:

- Antrenorul hotărăște zilnic cine se antrenează, cu ce încărcătură și cu ce restricții. O decizie luată fără să știe diagnosticul și etapa de recuperare poate agrava o accidentare.
- La grupele de juniori, antrenorul este adultul care stă zilnic cu jucătorii și primul care observă o problemă. Fără acces la istoric nu o poate raporta corect.
- Clubul are un singur preparator fizic pentru 5 grupe și peste 100 de jucători. El nu poate fi filtrul fiecărei decizii de antrenament.

### Temeiul propus și textul de consimțământ

Temeiul propus este consimțământul explicit al jucătorului sau, pentru minori, al părintelui ori al tutorelui (art. 6(1)(a) și art. 9(2)(a) GDPR). Textul afișat la prima intrare spune explicit cine vede datele. Formularea exactă, din `packages/shared/src/consent.ts`:

> „Cine le vede: preparatorul fizic al clubului (toate datele), **antrenorii grupei din care faci parte (fișa medicală completă, chestionarele și datele fizice — doar citire)**, directorul sportiv (fișa sumară: datele de bază, starea curentă și istoricul stărilor, zona accidentată, observațiile, restricțiile de antrenament, data estimată de revenire și viza medicală — fără diagnostice, documente sau chestionare), conducerea clubului (doar cifre de ansamblu, fără nume) și, dacă ești trimis la un control, partenerul medical al clubului (doar cazul respectiv).”

Varianta pentru părinți spune același lucru, cu „face parte jucătorul”.

### Ce trebuie cântărit

Consimțământul nu scutește de principiul reducerii la minimum a datelor (art. 5(1)(c) GDPR): accesul trebuie să fie necesar scopului, nu doar acceptat. În plus, într-un club, consimțământul unui jucător poate fi contestat ca nefiind liber, mai ales la minori. DPO-ul trebuie să confirme că accesul complet este proporționat.

### Alternative mai restrictive

Dacă DPO-ul consideră accesul excesiv, variantele de mai jos se pot aplica prin schimbări de politici în baza de date, fără rescrierea aplicației. Niciuna nu este implementată acum.

1. **Antrenorul vede doar tabloul de disponibilitate**: stare, zonă, dată de revenire, restricții. Fără diagnostice, documente și istoric. Este nivelul pe care îl are acum directorul sportiv, restrâns la grupă.
2. **Fișa medicală fără documente**: antrenorul vede accidentările și etapa de recuperare, dar nu poate deschide RMN-uri și scrisori medicale.
3. **Doar accidentările active**: istoricul medical vechi rămâne vizibil numai preparatorului.
4. **Chestionarele fără notele în text liber** sau doar ca medii pe grupă.
5. **Acord separat pentru accesul antrenorului**, distinct de acordul general, astfel încât un jucător să poată refuza doar acest acces.

---

## 4. Temeiuri juridice propuse

Toate rândurile de mai jos sunt **propuneri de validat** de către un jurist sau de DPO.

| Date | Temei propus | Observații |
|---|---|---|
| Date de sănătate, documente medicale, chestionare, date fizice legate de starea de sănătate | Consimțământ explicit: art. 6(1)(a) și art. 9(2)(a) GDPR. Pentru minori, consimțământul titularului răspunderii părintești. | Consimțământul trebuie să fie liber, specific, informat și să poată fi retras la fel de ușor cum a fost dat. Vezi „Ce trebuie cântărit” de la secțiunea 3. |
| Evidența sportivă: identificare, grupă, post, număr, prezență în lot | Executarea contractului sau a legitimării (art. 6(1)(b)) ori interesul legitim al clubului (art. 6(1)(f)) | Pentru interes legitim este nevoie de o analiză de echilibrare, păstrată în scris. |
| Viza medicală (data de expirare) | Obligație legală a clubului (art. 6(1)(c)), dacă regulamentele sportive aplicabile o cer; altfel, consimțământ | De confirmat ce regulament se aplică fiecărei grupe. |
| Datele de contact ale părinților | Interes legitim (art. 6(1)(f)) sau executarea contractului cu părintele | Folosite doar pentru a-i contacta în legătură cu jucătorul. |
| Conturile staffului, jurnalul de audit, sesiunile | Interes legitim (art. 6(1)(f)): securitatea datelor și obligația de responsabilitate, art. 5(2) și art. 32 GDPR | Staff-ul trebuie informat că accesările sunt jurnalizate; textul de confidențialitate o spune. |
| Trimiterea către partenerul medical | Consimțământ explicit; alternativ art. 9(2)(h), dacă partenerul este cadru medical supus secretului profesional | Clinica este, cel mai probabil, operator separat pentru actul medical. De clarificat în contractul cu ea. |

### Legislația română

- **Legea nr. 190/2018** pune în aplicare GDPR în România. Pentru datele de sănătate cere garanții suplimentare, în special la prelucrările automate și la crearea de profiluri. Aplicația nu ia decizii automate cu efect asupra jucătorilor: alertele doar îl anunță pe preparator, iar decizia îi aparține.
- **Vârsta consimțământului digital.** Art. 8(1) GDPR stabilește 16 ani pentru serviciile societății informaționale oferite direct unui copil și permite statelor o vârstă mai mică, dar nu sub 13 ani. România nu a coborât pragul, deci se aplică **16 ani**. Surse consultate la 7 octombrie 2026: ghidul White & Case de implementare națională a GDPR pentru România (publicat la 1 ianuarie 2022: „16 years of age”), ghidul Bird & Bird „Children in the digital world – Romania” („In Romania, this is 16 years of age”) și textul art. 8 în limba română.
  - Nu am verificat textul oficial al Legii 190/2018; afirmația se sprijină pe cele două ghiduri. De confirmat de jurist.
  - În Parlament există o inițiativă numită „legea majoratului online”, adoptată de Senat, care ar cere acordul părinților pentru conturile minorilor sub 16 ani. **Stadiul ei actual nu a putut fi verificat.** De urmărit, pentru că poate schimba cerințele.
- **Ce face aplicația.** Tratează drept minor orice jucător **sub 18 ani** și cere acordul părintelui sau al tutorelui, indiferent de pragul de 16 ani. Este o alegere prudentă: sunt date de sănătate, iar minorii între 14 și 18 ani au, potrivit Codului civil, capacitate de exercițiu restrânsă. Dacă data nașterii lipsește din fișă, aplicația nu poate ști că jucătorul este minor și îi cere acordul propriu; pagina Administrare → GDPR numără acești jucători.

Surse:

- White & Case, GDPR Guide to National Implementation – Romania: https://www.whitecase.com/insight-our-thinking/gdpr-guide-national-implementation-romania
- Bird & Bird, Children in the digital world – Romania: https://childreninthedigitalworld.twobirds.com/home/romania
- Art. 8 GDPR, textul în limba română: https://gdpr-text.com/ro/read/article-8
- Despre inițiativa „majoratului online”: https://hotnews.ro/legea-majoratului-online-adoptata-de-senat-conturile-personale-pentru-minorii-sub-16-ani-vor-fi-posibile-doar-cu-acordul-parintilor-2080707

---

## 5. Consimțământul în aplicație

### La prima autentificare

1. Conturile se creează doar de către preparator (Administrare → Conturi). Nu există înregistrare publică.
2. Utilizatorul primește un link de invitație. Linkul poate fi folosit o singură dată și expiră după 7 zile.
3. Își alege parola.
4. Vede textul potrivit rolului și nu poate merge mai departe fără să-l accepte (`requireSession` în `apps/web/src/lib/auth.ts`):
   - **jucător adult**: „Acordul tău pentru prelucrarea datelor”;
   - **jucător minor**: „Acordul părintelui sau al tutorelui”, cu numele părintelui și calitatea lui (mamă, tată, tutore);
   - **staff**: „Confidențialitatea datelor medicale”.
5. Dacă refuză, este scos din cont. Nu poate folosi aplicația până nu acceptă.

Fluxul a fost verificat în browser la 7 octombrie 2026, pentru un antrenor și pentru un jucător minor: fără numele părintelui, ecranul răspunde „Scrie numele părintelui sau al tutorelui”.

### Ce se înregistrează

Un rând în tabelul `consents`, cu: contul care a acceptat, jucătorul, felul acordului (propriu, al părintelui pe ecran, al părintelui pe hârtie, confidențialitate staff), **versiunea textului** (acum `2026-10-v1`), numele și calitatea părintelui, data și ora. Acceptarea apare și în jurnalul de audit.

Prin aplicație, un acord nu poate fi modificat. I se poate adăuga doar data retragerii (`grant update (withdrawn_at)` în `…000200_rls.sql`).

Când textul se schimbă pe fond, se schimbă și versiunea (`CONSENT_VERSION`), iar adulții și staff-ul sunt întrebați din nou la următoarea intrare. La minori, acordul părintelui rămâne valabil indiferent de versiune (vezi secțiunea 10, punctul 3).

### Acordul părintelui

- **Pe ecran**: la prima intrare în contul jucătorului minor. Pentru minori, clubul trimite invitația la adresa de e-mail a părintelui; formularul de creare a contului o spune.
- **Pe hârtie**: preparatorul deschide fișa jucătorului și înregistrează acordul semnat, cu numele părintelui, data și, opțional, documentul scanat. Se păstrează și cine l-a înregistrat.

**Acordul pe ecran este o declarație, nu o dovadă de identitate.** Aplicația nu verifică dacă persoana care tastează numele părintelui este într-adevăr părintele. Pentru minori, recomandăm ca acordul semnat pe hârtie să fie regula, iar cel de pe ecran doar o confirmare.

### Jucătorii fără cont

Preparatorul poate ține date despre un jucător care nu are cont: așa arată datele importate din tabelele clubului. Pentru acești jucători nimeni nu a acceptat nimic pe ecran, deci clubul trebuie să aibă acordul pe hârtie înainte de a le introduce datele medicale.

Pagina Administrare → GDPR arată lista minorilor fără acordul părintelui înregistrat, cu legătură către fișa fiecăruia.

### Retragerea acordului

1. Utilizatorul cere retragerea din Profil → Datele mele. Cererea ajunge la preparator.
2. Preparatorul o înregistrează din Administrare → GDPR. Acordurile jucătorului primesc data retragerii.
3. La următoarea intrare, aplicația îi cere din nou acordul și nu merge mai departe fără el (verificat în browser).

**Retragerea nu oprește singură prelucrarea.** Staff-ul vede în continuare datele deja colectate și poate adăuga altele. Clubul trebuie să hotărască ce face cu ele (dezactivare, anonimizare sau ștergere) și să închidă cererea cu un răspuns scris.

---

## 6. Drepturile persoanelor și cum se exercită

| Drept | Ce face jucătorul sau părintele | Ce face preparatorul |
|---|---|---|
| **Acces și portabilitate** (art. 15, 20) | Profil → Datele mele → descarcă un fișier JSON cu toate datele lui. Imediat, fără aprobare. | Administrare → GDPR → „Descarcă datele” pe o cerere sau pe un jucător plecat. Exportul se jurnalizează. |
| **Rectificare** (art. 16) | Își corectează singur datele de contact. Pentru rest: Profil → Datele mele → „Cere corectarea”, cu un mesaj. | Corectează în fișa jucătorului, apoi închide cererea cu un răspuns. |
| **Ștergere** (art. 17) | Profil → Datele mele → „Cere ștergerea”. | Administrare → GDPR → „Anonimizează” sau „Șterge definitiv”. Ambele cer tastarea numelui jucătorului. Dacă există un motiv legal de păstrare, respinge cererea și îl explică. |
| **Retragerea consimțământului** (art. 7(3)) | Profil → Datele mele → „Retrage acordul”. | „Înregistrează retragerea acordului”, apoi decide soarta datelor (secțiunea 5). |
| **Restricționare, opoziție** (art. 18, 21) | Nu există buton dedicat. Se cer prin mesajul unei cereri sau direct la club. | Dezactivează contul ori fișa și notează răspunsul. |

Detalii:

- **Exportul** este produs de funcția `export_player_data`. Conține fișa, contactul, istoricul de grupe și de stări, antropometria, accidentările cu tratamente, lista documentelor, chestionarele, RPE, datele fizice, testele, planurile, bifele și consimțămintele. **Fișierele documentelor nu sunt incluse**: apare doar lista lor. Jucătorul le poate deschide din fișa lui, iar la o cerere formală clubul trebuie să le trimită separat.
- **Cererile** stau în tabelul `data_requests`: cine a cerut, despre ce jucător, mesajul, data, cine a răspuns, când și ce a răspuns. Utilizatorul își vede răspunsul în Profil.
- **Termenul legal** de răspuns este de o lună (art. 12(3) GDPR). Aplicația arată cererile deschise pe pagina de pornire a administrării, dar nu trimite memento și nu calculează termenul.
- **Părinții nu au cont propriu.** Își exercită drepturile prin contul jucătorului sau direct la club.

---

## 7. Păstrarea datelor

### Perioada de păstrare

- Se stabilește în Administrare → Club → „Păstrarea datelor după plecare”. Valoarea implicită este de 36 de luni.
- Se numără de la dezactivarea fișei jucătorului.
- După expirare, jucătorul apare în Administrare → GDPR, la „Perioada de păstrare a expirat” (funcția `players_past_retention`).
- **Aplicația nu șterge nimic automat.** Preparatorul hotărăște, pentru fiecare jucător, dacă îl anonimizează sau îl șterge.

Perioada este decizia clubului și trebuie justificată în registrul de prelucrări, de exemplu prin termenul în care se pot formula pretenții legate de o accidentare.

### Cele trei operațiuni

| | Dezactivare | Anonimizare | Ștergere definitivă |
|---|---|---|---|
| Când | Jucătorul a plecat de la club | La expirarea perioadei sau la cerere | La cerere sau când nici cifrele nu mai sunt necesare |
| Ce dispare | Nimic. Jucătorul iese din listele curente. | Numele (devine „Anonimizat xxxx”), ziua și luna nașterii, numărul, fotografia, datele de contact, documentele medicale, acordurile, diagnosticele, notele în text liber, tratamentele, trimiterile și notele partenerului | Tot: fișa și toate datele legate de ea |
| Ce rămâne | Tot | Cifrele: chestionare, RPE, date fizice, teste, măsurători, zona și tipul accidentărilor, zilele de indisponibilitate, anul nașterii, grupa | Doar faptul ștergerii, în jurnalul de audit |
| Contul jucătorului | Rămâne; poate fi dezactivat separat | Dezactivat; adresa de e-mail este înlocuită cu una care nu identifică pe nimeni | Șters |
| Se poate anula | Da | Nu | Nu |

Anonimizarea și ștergerea au fost verificate pe Club Demo la 7 octombrie 2026, direct în baza de date:

- numele a fost înlocuit, datele de contact și documentele șterse (inclusiv fișierele din depozit);
- cele 41 de chestionare au rămas, fără note;
- contul a fost dezactivat, fără sesiuni și fără adresa de e-mail reală;
- în jurnalul de audit nu a rămas nicio valoare veche: nici numele, nici diagnosticul, nici telefonul.

**Jurnalul de audit la anonimizare și ștergere.** În mod normal, jurnalul păstrează valoarea veche și cea nouă a fiecărui câmp modificat. La anonimizare și la ștergere, aceste valori sunt înlocuite cu lista câmpurilor atinse: rămâne *cine* a făcut *ce* și *când*, nu și *ce scria acolo* (`private.scrub_player_traces`, în `db/migrations/20261007130000_administrare_conturi_gdpr.sql`). Se șterg și notificările care purtau numele jucătorului.

**Atenție: anonimizarea nu garantează că persoana nu mai poate fi recunoscută.** Într-o grupă mică, un jucător poate fi identificat după anul nașterii, grupă, perioada și zona unei accidentări. Dacă riscul contează, alegeți ștergerea definitivă.

### Ce nu acoperă ștergerea din aplicație

- **Copiile de siguranță ale bazei de date.** Furnizorul bazei de date (Neon) păstrează un istoric din care datele pot fi restaurate. Un jucător șters rămâne în acel istoric până la expirarea ferestrei de păstrare, care depinde de planul contractat. Clubul trebuie să o afle și să o treacă în registrul de prelucrări.
- **Depozitul de fișiere.** Potrivit documentației Vercel, modificările și ștergerile din Vercel Blob se propagă prin memoria-tampon a rețelei în cel mult 60 de secunde.
- **Rapoartele de import.** Păstrează rezumatul fiecărui import (tabelul `imports`), care poate conține nume de jucători din fișierul sursă. Nu sunt curățate la anonimizare.
- **Mesajele din cererile GDPR.** Textul scris de utilizator într-o cerere rămâne, ca dovadă că cererea a existat și a fost rezolvată.
- **Fișierele sursă** (tabelele Excel, exporturile K-Sport) și orice export sau document descărcat de staff pe dispozitivele proprii.

---

## 8. Securitate

### Permisiuni impuse în baza de date

- Fiecare tabel are Row Level Security activ. Implicit, totul este interzis (`…000200_rls.sql`).
- Aplicația rulează fiecare cerere a unui utilizator cu identitatea lui, deci regulile se aplică oricărei interogări (`packages/db/src/client.ts`, `withIdentity`).
- Clientul de date care ocolește RLS este folosit doar de scripturile de instalare și de sarcinile programate. Modulul de administrare nu îl folosește: profilurile, grupele și legătura cu jucătorul se scriu cu identitatea preparatorului, iar baza de date refuză alt club. Operațiunile de autentificare (crearea utilizatorului, e-mail, dezactivare, linkuri) nu trec prin RLS, de aceea fiecare verifică întâi, explicit, că acel cont aparține clubului preparatorului (`apps/web/src/components/admin/server.ts`, `targetProfile`).
- Tabelele de autentificare (schema `app_auth`) nu pot fi citite de niciun rol al aplicației. Preparatorul află despre un cont doar dacă parola a fost aleasă, dacă este dezactivat și când s-a autentificat ultima dată (funcția `admin_accounts`).

### Jurnalul de audit

Se jurnalizează:

- orice adăugare, modificare și ștergere în tabelele cu date personale sau de configurare, cu valoarea veche și cea nouă a câmpurilor schimbate (triggerul `private.audit`, în `…000300_triggers.sql`);
- fiecare vizualizare a fișei unui jucător de către staff, pe secțiuni. Aceeași persoană, același jucător și aceeași secțiune apar o singură dată la 5 minute. Jucătorul care își citește propria fișă nu este jurnalizat;
- descărcarea documentelor medicale, exporturile de date, autentificările, acceptarea consimțământului;
- invitațiile, linkurile de resetare, anonimizările și ștergerile definitive.

Jurnalul nu poate fi modificat sau șters de nimeni din aplicație, nici de preparator. Numai preparatorul îl vede (Administrare → Jurnal), cu filtre după perioadă, utilizator, jucător, acțiune și tip de înregistrare, și îl poate exporta în CSV.

Limite: bifele exercițiilor, notificările, alertele și rândurile de date GPS (se jurnalizează importul, nu fiecare rând) nu sunt jurnalizate. Jurnalul nu are o perioadă de păstrare proprie și crește continuu.

### Parole și sesiuni

Verificat în `packages/db/src/auth.ts`:

- **Parolele** nu se păstrează. Se păstrează doar un rezumat calculat cu **scrypt** (N = 32768, r = 8, p = 1), cu sare aleatoare de 16 octeți pentru fiecare parolă. Lungimea minimă este de 10 caractere. Nu există alte reguli de complexitate și nici verificare împotriva parolelor compromise.
- **Încercările de autentificare** sunt limitate: după 8 eșecuri pe aceeași adresă de e-mail sau 40 de pe aceeași adresă IP, în 15 minute, autentificarea este blocată temporar.
- **Sesiunea** este un cod aleator de 256 de biți. Stă într-un cookie `httpOnly` (invizibil pentru scripturile din pagină), `SameSite=Lax`, `Secure` în producție. În baza de date se păstrează doar amprenta lui SHA-256. Durează 30 de zile și se prelungește la folosire.
- La schimbarea parolei, celelalte sesiuni ale utilizatorului se închid. La dezactivarea contului se închid toate.
- **Linkurile de invitație și de resetare** sunt de unică folosință și expiră: invitația după 7 zile, resetarea după 24 de ore dacă o trimite preparatorul și după 2 ore dacă o cere utilizatorul. În baza de date stă doar amprenta lor. Linkul nu se consumă la simpla deschidere a paginii, ci la apăsarea butonului, ca să nu-l consume scanerele de e-mail. Verificat în browser: a doua folosire este refuzată.
- **Nu există autentificare în doi pași.**

### Documentele medicale

- Stau într-un depozit privat. Nu există adrese publice.
- Fiecare cerere trece prin aplicație, care verifică sesiunea și dreptul de citire la fiecare acces (`apps/web/src/app/api/files/[bucket]/[...path]/route.ts`).
- Fiecare descărcare se jurnalizează.
- Un document deja înregistrat nu poate fi suprascris printr-o încărcare nouă.
- Tipuri și mărimi acceptate: PDF, imagini, ZIP, cel mult 25 MB.

Specificația inițială cerea „linkuri semnate, cu expirare”. Soluția aleasă este mai strictă: documentele medicale nu au niciun link care să funcționeze fără sesiune, nici măcar temporar. Linkuri semnate, valabile 5 minute, se folosesc doar pentru clipurile de exerciții, care nu sunt date personale.

### E-mailuri

Aplicația trimite e-mailuri doar dacă este configurat serviciul Resend. Conținutul lor nu include date medicale: doar faptul că există ceva nou și un link (`apps/web/src/lib/email.ts`). Invitațiile conțin numele clubului și linkul de activare.

Fără e-mail configurat, preparatorul copiază linkul de invitație și îl trimite el. Dacă îl trimite pe WhatsApp sau pe alt canal, acel canal iese din controlul aplicației; linkul este valabil o singură dată tocmai de aceea.

### Antete de securitate

Aplicația trimite `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` și `Permissions-Policy` fără cameră, microfon și localizare (`apps/web/next.config.ts`). **Nu există încă o politică `Content-Security-Policy` pentru pagini**; există doar pe fișierele servite din depozit.

### Unde sunt găzduite datele

| Ce | Furnizor | Unde | Cum se verifică |
|---|---|---|---|
| Baza de date | Neon (Postgres) | AWS `eu-central-1`, Frankfurt | Este setarea proiectului Neon, nu este scrisă în cod. De confirmat în consola Neon. |
| Aplicația | Vercel | Funcțiile rulează în `fra1`, Frankfurt | `apps/web/vercel.json` → `"regions": ["fra1"]` |
| Fișierele | Vercel Blob | Regiunea aleasă la crearea depozitului | Vezi mai jos |
| E-mail (opțional) | Resend | De verificat în contul Resend | Prin e-mail trec doar adresa destinatarului, numele clubului și un link |

**Ce am aflat despre Vercel Blob** din documentația oficială, consultată la 7 octombrie 2026 (https://vercel.com/docs/vercel-blob):

- Fișierele sunt stocate pe Amazon S3: „Vercel Blob leverages Amazon S3 as its underlying storage infrastructure”.
- **Regiunea poate fi aleasă, dar numai la crearea depozitului**: „You can create Blob stores in any of the 19 regions… Region selection also helps meet data regulatory requirements.” și „You cannot change the region once the store is created.”
- Depozitul poate fi privat sau public, iar alegerea nu mai poate fi schimbată după creare. Aplicația scrie doar cu `access: "private"`. Într-un depozit privat, orice citire cere autentificare.
- Fișierele, inclusiv cele private, trec printr-o memorie-tampon a rețelei Vercel timp de până la o lună; ștergerile se propagă în cel mult 60 de secunde. Documentația nu spune în ce regiuni stau aceste copii.

**De făcut:**

- Depozitul Blob trebuie creat ca **privat**, în regiunea **`fra1` (Frankfurt)**. Dacă a fost creat în altă regiune, trebuie creat din nou și fișierele mutate.
- Întrebați Vercel, în scris, unde sunt ținute copiile temporare ale fișierelor private.

### Împuterniciții clubului

Clubul este operatorul datelor. Furnizorii de mai jos sunt împuterniciți (procesatori) și cu fiecare trebuie să existe un acord de prelucrare a datelor (DPA):

| Furnizor | Ce prelucrează |
|---|---|
| **Neon** | toată baza de date, inclusiv datele de sănătate |
| **Vercel** | rularea aplicației (toate datele trec prin funcțiile ei), fișierele din Vercel Blob (documente medicale, fotografii), jurnalele tehnice |
| **Amazon Web Services** | sub-împuternicit al Neon și al Vercel, pentru infrastructură |
| **Resend** (dacă este activat) | adresele de e-mail și conținutul mesajelor |

**Transferuri în afara SEE.** Neon, Vercel, Resend și AWS sunt companii din Statele Unite. Chiar dacă datele stau la Frankfurt, furnizorul poate avea acces la ele din afara Spațiului Economic European, de exemplu pentru suport. Clubul trebuie să verifice, pentru fiecare furnizor, mecanismul de transfer pe care îl oferă (certificarea în EU–US Data Privacy Framework sau clauzele contractuale standard) și lista de sub-împuterniciți, și să le treacă în registrul de prelucrări.

**Ce nu face aplicația:** datele nu sunt criptate la nivel de câmp. Protecția lor în repaus este cea oferită de furnizori, iar criptarea de către aceștia nu a fost verificată de noi: cereți-le confirmarea în scris.

---

## 9. Ce are clubul de făcut în afara aplicației

1. **Stabilirea operatorului.** Entitatea juridică a clubului este operatorul. Stabiliți cine răspunde intern de protecția datelor.
2. **Responsabil cu protecția datelor (DPO).** Analizați dacă desemnarea este obligatorie (art. 37 GDPR: prelucrare pe scară largă de categorii speciale). Pentru date de sănătate ale unui număr mare de minori, recomandarea este să existe unul, fie și extern.
3. **Evaluarea de impact (DPIA).** Foarte probabil obligatorie (art. 35 GDPR): date de sănătate, persoane vulnerabile (minori), monitorizare sistematică prin chestionare zilnice și GPS. Trebuie făcută înainte de lansare. Secțiunile 1–3 și 8 ale acestui document sunt materialul tehnic pentru ea.
4. **Registrul de prelucrări** (art. 30): scopuri, categorii de date, destinatari, termene de păstrare, împuterniciți, transferuri.
5. **Acordurile semnate ale părinților**, pe hârtie, pentru toți minorii, înainte de introducerea datelor lor medicale. Textul trebuie să fie același cu cel din aplicație și să menționeze accesul antrenorilor. Înregistrați fiecare acord în fișa jucătorului.
6. **Informarea** jucătorilor, a părinților și a staffului (art. 13): cine este operatorul, datele de contact ale DPO-ului, dreptul de a depune plângere la ANSPDCP. Textele din aplicație nu conțin aceste elemente (secțiunea 10, punctul 2).
7. **Validarea textelor de consimțământ** de către jurist sau DPO. După orice modificare de fond se schimbă `CONSENT_VERSION`, iar utilizatorii sunt întrebați din nou.
8. **Acordurile de prelucrare (DPA)** cu Neon, Vercel și Resend, și un contract cu partenerul medical care să lămurească cine este operator pentru ce.
9. **Configurarea găzduirii**: baza de date în `eu-central-1`, depozitul Blob privat în `fra1`, fereastra de păstrare a copiilor de siguranță cunoscută și notată.
10. **Procedura la incidente** (art. 33–34): cine este anunțat intern, cine notifică ANSPDCP în 72 de ore, cum sunt anunțate persoanele afectate. Aplicația ajută la investigație (jurnalul de audit, dezactivarea imediată a unui cont), dar nu detectează singură incidentele.
11. **Instruirea staffului.** Conturile sunt personale; nu se fac capturi de ecran cu fișe medicale; nu se descarcă documente pe dispozitive personale; telefonul se blochează. Antrenorii trebuie să știe că fiecare accesare este jurnalizată.
12. **Gestionarea conturilor.** La plecarea unui membru al staffului, contul se dezactivează în aceeași zi. Lista conturilor și a grupelor antrenorilor se revizuiește periodic. Clubul ar trebui să aibă cel puțin doi oameni care pot administra aplicația.
13. **Verificarea periodică a jurnalului**: accesările fișelor medicale, exporturile și descărcările de documente.
14. **Retenția.** O dată pe sezon, deschideți Administrare → GDPR și rezolvați lista jucătorilor cu perioada de păstrare expirată.
15. **Fișierele sursă** (tabelele Excel, exporturile K-Sport) rămân în afara aplicației și au nevoie de aceleași reguli de păstrare și ștergere.

---

## 10. Limite cunoscute și recomandări

Ce nu face aplicația acum sau face altfel decât ar fi ideal.

**De rezolvat înainte de folosirea cu date reale**

1. **Accesul directorului sportiv este mai larg decât „stare și zonă”.** Directorul vede fișa sumară a jucătorului: datele de bază (inclusiv data nașterii), starea curentă și istoricul stărilor, zona accidentată, observațiile în text liber de la stare, restricțiile de antrenament, data estimată de revenire și data expirării vizei medicale. Textul de consimțământ a fost corectat ca să spună exact asta. Observațiile în text liber pot conține informații medicale: dacă DPO-ul clubului consideră accesul excesiv, se poate restrânge din baza de date.
2. **Textele de consimțământ nu conțin toate informațiile cerute de art. 13 GDPR**: identitatea și datele de contact ale operatorului, DPO-ul, temeiul juridic, dreptul de a depune plângere la ANSPDCP, perioada de păstrare în cifre. Clubul le completează printr-o notă de informare separată sau cere includerea lor în text.
3. **Acordul părintelui nu este reverificat la schimbarea textului.** Pentru minori este suficient orice acord al părintelui neretras, indiferent de versiune. Dacă textul se schimbă pe fond, acordurile părinților trebuie reînnoite manual.
4. **Acordul părintelui pe ecran nu dovedește identitatea părintelui** (secțiunea 5).
5. **Aplicația nu împiedică introducerea datelor medicale pentru un jucător fără acord înregistrat.** Arată lista, dar nu blochează.
6. **Retragerea acordului nu blochează prelucrarea de către staff** (secțiunea 5).

**Securitate**

7. **Nu există autentificare în doi pași**, nici măcar pentru preparator, care are acces la tot. Este cea mai importantă îmbunătățire de făcut.
8. **Nu există criptare la nivel de câmp.**
9. Nu există politică de complexitate a parolelor dincolo de lungime, verificare împotriva parolelor compromise, expirare a sesiunii la inactivitate (sesiunea durează 30 de zile) sau o listă a sesiunilor active pe care utilizatorul să le poată închide.
10. Nu există antet `Content-Security-Policy` pentru pagini.
11. Aplicația nu alertează la comportament neobișnuit (multe fișe deschise într-un timp scurt, export în masă). Jurnalul le înregistrează, dar cineva trebuie să se uite.
12. **Preparatorul este un singur punct de încredere.** Poate vedea, exporta și șterge tot, iar acțiunile lui apar doar într-un jurnal pe care îl citește tot el. Recomandăm ca DPO-ul sau conducerea să primească periodic exportul jurnalului.

**Păstrare și ștergere**

13. **Nimic nu se șterge automat** la expirarea perioadei de păstrare.
14. Jurnalul de audit, sesiunile expirate și încercările de autentificare nu au o politică de păstrare configurabilă. Ultimele două se curăță ocazional, la autentificări.
15. Anonimizarea lasă date care, într-o grupă mică, pot permite reidentificarea (secțiunea 7).
16. Rapoartele de import pot păstra nume de jucători și nu sunt curățate la anonimizare.
17. Ștergerea din aplicație nu ajunge în copiile de siguranță ale furnizorului (secțiunea 7).
18. După anonimizarea unui jucător care avea cont, rămâne un cont gol, dezactivat („Cont anonimizat”), pe care preparatorul îl poate șterge din Administrare → Conturi.
19. La ștergerea unui cont de staff, rândul de ștergere din jurnalul de audit păstrează numele și adresa de e-mail a contului șters.

**Drepturi**

20. Exportul nu conține fișierele documentelor medicale, ci doar lista lor.
21. Nu există funcții dedicate pentru restricționarea prelucrării și pentru opoziție.
22. Părinții nu au cont propriu.
23. Termenul de o lună pentru răspunsul la cereri nu este urmărit de aplicație.

**Ce nu am putut verifica**

- Regiunea efectivă a bazei de date Neon și a depozitului Vercel Blob din producție: sunt setări ale conturilor, nu ale codului.
- Unde ține Vercel copiile temporare ale fișierelor private și dacă Neon și Vercel criptează datele în repaus.
- Conținutul e-mailurilor de notificare trimise de sarcinile programate, care aparțin altui modul. Regula din `lib/email.ts` este „fără date medicale”; recomandăm o verificare a mesajelor reale înainte de lansare.
- Textul oficial al Legii 190/2018 și stadiul inițiativei privind „majoratul online” (secțiunea 4).
