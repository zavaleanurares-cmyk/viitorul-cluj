# Faza 4 — Performanță și Club

Cod: Performanță în `apps/web/src/app/(app)/{performanta,fizic,lot/jucatori/[id]/(fisa),lot/vize,clipuri,evaluari}/` și `components/performance/`; Club în `apps/web/src/app/(app)/club/`, paginile familiei `(app)/{mesaje,contracte,tabere,magazin,noutati}/`, site-ul public `apps/web/src/app/c/[slug]/`, componente `components/{club,site}/`. Texte în `messages/ro/{performance,club,enrolment,camps,website,shop,supporters,site}.ts`. Migrări `db/migrations/20261015120000…20261015130700`. Teste de acces: `scripts/test-rls-lot.ts` (86) și `scripts/test-rls-perf.ts` (323); teste unitare în `packages/shared/test/` (50). Operatorul de plăți rămâne neales: taxele noi (tabere, magazin, înscriere) intră în registrul din faza 3 și se plătesc ca orice taxă.

## Date medicale

- **Detaliile medicale le citesc doar rolurile medicale.** Rolul Postgres `lr_health` (moștenește `authenticated`) primește coloanele `status_note`, `status_zone*`, `training_restrictions`, `review_note`; `private.db_role_for(uid)` îl dă kinetoterapeutului, antrenorului, directorului sportiv, jucătorului și partenerului medical. Biroul vede eticheta stării („Indisponibil"), nu nota.
- **Orice coloană nouă pe `players` are nevoie de grant explicit** către `authenticated`; `test-rls-lot` verifică.
- **Stratul REST** extinde `select *` doar la coloanele permise rolului (`deniedFor` din catalog), deci o pagină nu cade când un rol nu vede o coloană.

## Performanță

- **O singură fișă a jucătorului** (`/lot/jucatori/[id]`), cu file: stare, medical, wellness, fizic, plan, documente, evaluări, video. Rutele vechi redirecționează.
- **Vize medicale**: familia încarcă avizul, kinetoterapeutul sau biroul îl aprobă și setează expirarea; mementourile la 30 și 7 zile pleacă din sarcina programată.
- **Încărcare**: RPE după antrenament (cerut automat), raport acut:cronic pe zone. **Corp**: greutatea pe echipă, doar peste vârsta din setări (implicit 14 ani).
- **Teste**: baterii standard și ale clubului, percentile pe echipă. **Evaluări**: runde pe șabloane cu criterii pe 4 categorii; antrenorii notează, directorul publică; familia vede doar copilul ei, fără comentariile interne.
- **Video**: înregistrări încărcate sau linkuri (VEO, YouTube, Vimeo, doar https), marcaje pe cronologie; un clip (cel mult 10 minute) se trimite doar jucătorilor etichetați și familiilor lor.

## Club

- **Mesaje**: lista destinatarilor se vede înainte de trimitere, cu excluderi; programare; statistica citirilor. Antrenorul scrie doar echipelor lui; kinetoterapeutul trebuie să aleagă echipele; mesajele către tot staff-ul le trimite biroul. Pe e-mail pleacă doar un rezumat neutru.
- **Contracte**: modele cu versiuni (textul schimbat face versiune nouă), câmpuri completate automat, semnătură desenată în aplicație. Urma de audit păstrează trimiterea, deschiderea, semnarea (cu IP) și o amprentă sha256 a textului, numelui, momentului și semnăturii. Semnează părintele plătitor; un jucător semnează singur doar dacă e major. Tipul documentului se păstrează pe contract, deci un model reetichetat nu schimbă ce s-a semnat.
- **Înscrieri**: formularul public creează o cerere; biroul programează proba pe un antrenament al echipei (antrenorii sunt anunțați și o notează fără să vadă contactele familiei); „Înscrie" creează jucătorul, părintele plătitor, taxa lunii și, opțional, o taxă de înscriere. Dacă adresa părintelui există deja în club, biroul confirmă că e aceeași familie (oricine poate scrie o adresă pe site). Cererile închise se șterg după 12 luni.
- **Tabere**: locurile se confirmă pe loc, iar taxa intră în registrul familiei. Când tabăra e plină, înscrierea trece pe lista de așteptare și urcă singură când se eliberează un loc. Rândul taberei se blochează la numărare, deci nu apar suprarezervări. Copiii din afara clubului se înscriu de pe site, iar biroul confirmă și marchează plata. Notele pentru organizatori (alergii) le văd doar biroul și cine a înscris; se șterg la 30 de zile după tabără.
- **Magazin**: produse cu stoc pe mărimi, pachete (o mărime pe fiecare produs), comenzi care scad stocul pe loc și creează o taxă `equipment`. Anularea pune stocul la loc și anulează taxa neplătită; dacă s-a plătit, contabilul e anunțat pentru restituire. Mărimea copilului (aleasă la înscriere) e preselectată.
- **Site public** (`/c/<slug>`): un singur editor pentru site și aplicație (blocuri: paragraf, subtitlu, imagine, citat, listă), cu previzualizare. Publicarea în aplicație anunță o singură dată familiile echipelor alese. Setările au explicații și jurnal de modificări; politica de confidențialitate are versiuni și pornește de la un text model care trebuie verificat. Loturile publice arată doar jucătorii majori.
- **Galerii**: o fotografie e publică doar dacă albumul e publicat, biroul a verificat-o și toți copiii etichetați au acord foto. Acordul se pornește semnând documentul „Fotografii și video" și se retrage din contul familiei; retragerea ascunde imediat fotografiile.
- **Suporteri**: Formularul 230 se completează pe site și se descarcă ca PDF. **CNP-ul și adresa nu ajung în baza de date și nu se scriu în jurnale**; se păstrează doar numele și, cu acord, contactul. Biroul urmărește campania (cerut, primit semnat, depus) și exportă lista. Sponsorii au evidență internă (sumă, perioadă, stare); pe site apare sigla doar după contract și cu bifa de afișare.

## Formulare publice

- Trec prin funcții `security definer` dedicate, apelabile de `anon`. Au limită pe IP (amprentat cu sha256, nu stocat în clar) și o limită zilnică pe club (înscrieri 500, tabere 1000, 230: 2000).
- Au și o capcană pentru roboți (câmp ascuns plus timp minim de completare).
- Captcha nu există încă; dacă apar abuzuri, se adaugă Turnstile.
- Fișierele publice se servesc doar prin `/c/<slug>/media/…`, după `site_public_file`. Sigla clubului e singurul fișier „branding" public.

## Revizia de securitate

O revizie independentă a părții Club a găsit nouă probleme. Toate sunt rezolvate în `20261015130700_lr_club_revizie.sql` și au teste noi:

1. **Minori care semnau documente.** Un jucător minor putea semna singur un document, inclusiv acordul foto.
2. **Fotografii publice fără verificare.** O fotografie neetichetată devenea publică imediat ce intra într-un album publicat.
3. **Suprarezervări la tabere**, când două familii se înscriau în același timp.
4. **Imagini din ciorne.** Imaginile ciornelor se puteau citi din aplicație dacă se ghicea calea.
5. **Mesaje către tot clubul.** Kinetoterapeutul putea scrie tuturor fără să aleagă echipele.
6. **Nume rămase după ștergere (GDPR).** Numele copilului șters rămânea în comenzi, în lista destinatarilor și în notificările noi.
7. **Secțiuni oprite tot publice.** Secțiunile oprite din setări erau încă servite public.
8. **Formule executabile în CSV.** Exportul 230 putea executa formule venite de pe site.
9. **Funcții interne apelabile direct.**

Tot la verificarea finală am mai rezolvat două probleme:

- **Clubul nu se putea șterge**: cheia pachetelor din magazin bloca ștergerea.
- **Suspendările demo nu aveau cartonașele lor**: acum le au.

## Verificări

- Toate migrările rulează pe o bază nouă (UTF-8) și toate cele 4 suite de acces trec acolo: 652 de verificări.
- Build de producție.
- Parcurgerea tuturor paginilor din meniu, pentru fiecare rol, pe build-ul de producție.
- Fluxuri cap-coadă cu Playwright: semnarea contractului și PDF-ul, înscrierea de la formular la jucător, invitația și contractul, tabăra de pe site, comanda din magazin, Formularul 230.
