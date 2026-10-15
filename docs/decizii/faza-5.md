# Faza 5 — Migrare, export, demo și finisare

Cod: migrarea în `packages/shared/src/import/tfb.ts` (citire, potrivire, plan), `apps/web/src/app/(app)/import/tfb/` (acțiuni și pagină), `components/imports/tfb-wizard.tsx`, funcția `import_tfb` din `db/migrations/20261015140000_lr_import_tfb.sql`. Exportul în `components/admin/club-export.ts` și `app/api/club/export/route.ts`. Demo-ul în `lib/demo.ts`, `app/(auth)/demo/`, `scripts/demo-build.ts`, `packages/seed/src/demo.ts`. Texte în `messages/ro/{tfb,auth,admin}.ts`. Teste: `packages/shared/test/tfb.test.ts` (6) și secțiunea „Migrarea din TFB" din `scripts/test-rls-bani.ts`. Plățile online rămân în afara fazei.

## Migrarea din The Football Brain

- **Fișiere, nu acces la cont.** TFB nu are API. Migrarea pornește de la exporturile pe care clubul le poate scoate singur:
  - lista jucătorilor (xlsx);
  - jucătorii pe echipe;
  - echipele și staff-ul;
  - utilizatorii aplicației (părinți);
  - grila plăților, câte un CSV pe an.

  Fișierele se citesc în browser și sunt recunoscute după antet. La server ajunge doar pachetul interpretat (aproximativ 600 KB pentru Viitorul).
- **CNP-ul nu se importă.** Coloana lipsește intenționat din export, iar Locker Room nu are un câmp pentru el.
- **Planul se face pe server, de fiecare dată.** Browserul trimite fișierele interpretate și deciziile de potrivire, nu planul. Serverul citește starea clubului, reface planul și îl scrie prin `import_tfb`, într-o singură tranzacție.
  - Funcția acceptă doar administratorul și preparatorul fizic, și doar în clubul lor.
  - Starea clubului se citește cu drepturi de serviciu, limitată la club, pentru că preparatorul nu vede registrul de bani, iar planul are nevoie de el.
- **Reluarea e sigură.** Taxa lunară e unică pe jucător și lună, iar legăturile părinte–copil nu se dublează. Jucătorii fără decizie în ecran (foștii jucători aduși la o rulare anterioară) se regăsesc după nume. Testat: a doua rulare pe aceleași fișiere nu scrie nimic nou.
- **Potrivirea jucătorilor existenți.** O potrivire e sigură în două cazuri: același nume (în orice ordine a cuvintelor), sau singurul candidat din echipa TFB legată de grupă. Restul cer o decizie în ecran, cu propuneri și cu lista completă.
- **Omonimii** (doi „Pop Bogdan") se despart după numărul matricol din grila plăților. Altfel plățile lor s-ar contopi.
- **Un jucător stă într-o singură grupă.** Echipa principală e cea care se potrivește cu anul nașterii, cu ELITE înaintea celorlalte. Cei 57 de jucători din mai multe echipe TFB sunt listați la verificare, iar reconcilierea pe echipe îi numără la „și în”.
- **Banii se reconciliază pe luna taxei.** Grila TFB (verde = plătit, roșu = restant) se compară cu ce a încasat Locker Room după import.
  - Raportul de încasări din TFB are sume mai mari pentru lunile vechi. Include jucători șterși din TFB, care nu apar în grilă, deci acea diferență nu poate fi recuperată din exporturi.
  - Pentru diferența completă trebuie cerut la TFB un export GDPR complet.
- **Ce nu se aduce:**
  - meciurile, prezențele și evaluările istorice (TFB nu le exportă);
  - contractele și documentele;
  - conturile staff-ului, pentru că TFB nu exportă adresele lor de e-mail (staff-ul se invită din Administrare › Conturi).
- **După import, taxele lunare se emit din Locker Room** cu sumele preluate din TFB. Planul echipei are taxa cea mai frecventă, iar excepțiile se pun pe jucător.

## Exportul datelor

- Exportul produce un ZIP cu câte un CSV pe tabel (separator `;`, UTF-8 cu BOM, protecție contra formulelor Excel) și un `CITESTE.txt`.
- Rulează cu identitatea celui care exportă, deci RLS și drepturile pe coloane rămân în vigoare.
- Tabelele fără `club_id` se leagă de club prin cheile străine.
- Arhivele mai mari de 4 MB trec prin Blob, cu un link semnat valabil 15 minute, și se șterg după 24 de ore.
- Fișierele încărcate (avize, contracte, poze) nu intră în arhivă.

## Demo

- Clubul `club-demo` se reface la build-ul de producție doar când se schimbă `DEMO_VERSION`. Build-ul nu cade niciodată din cauza demo-ului.
- `/demo` deschide o sesiune pe rolul ales, fără parolă. Se oprește cu `DEMO_LOGIN=off`.
- Conturile demo au acordul înregistrat la semănare, deci intră direct în aplicație.
- Din demo nu pleacă niciun e-mail (invitații, resetări, rezumate). Un fișier încărcat are cel mult 5 MB.
- O bandă albastră anunță clubul demo și duce la schimbarea rolului.

## Finisare

- `cn()` folosește `tailwind-merge`. Fără el, `className="w-20"` nu bătea `w-full` din componentă: ordinea din CSS decidea, nu cea din cod.
- Elementele de grilă au `min-width: 0` global. Un tabel lat sau un text trunchiat nu mai lărgesc pagina pe telefon (erau afectate `/bani`, `/bani/banca` și `/lot/echipe`).
- Revizia vizuală pe toate rolurile, pe ecran lat și pe telefon, a reparat:
  - coloane inegale (tablou, administrarea clubului, prime, rapoarte);
  - rânduri strivite pe telefon (prime, taxe, stări, părinți);
  - etichete care împingeau cifrele Stat pe rânduri diferite;
  - pastile cu înălțime fixă care se rupeau;
  - acțiunile din antet pe telefon.
