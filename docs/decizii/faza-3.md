# Faza 3 — Bani: taxe, încasări, plăți online, extrase, cheltuieli, referate, buget, prime

Cod: `apps/web/src/app/(app)/bani/`, `apps/web/src/app/(app)/plati/`, `apps/web/src/components/money/`, `apps/web/src/lib/payments/`, `apps/web/src/app/api/{plati,bani,cron}/`; logică comună în `packages/shared/src/{money,bank}.ts`; texte în `messages/ro/money.ts`; migrări `db/migrations/20261015110000…20261015111300_lr_bani_*.sql`; test de acces `scripts/test-rls-bani.ts` (81 de verificări), teste unitare `packages/shared/test/money.test.ts`.

## Modelul de date

- **Un singur registru**: datorii (`charges`) ← alocări (`allocations`) → plăți (`payments`). Soldurile nu se țin în tabele, ci se calculează în vederile `charge_balances` și `payment_balances` (`security_invoker`, deci respectă accesul cititorului).
- **Sumele sunt în bani** (`bigint`, 1 leu = 100). Rotunjirea TVA-ului se face pe rând, la fel în browser (`vatLine`) și în baza de date (`save_purchase_request`).
- **Alocarea** nu poate depăși nici plata, nici datoria. O verifică un trigger amânat care blochează rândurile plății și datoriei (`for update`), deci două alocări simultane nu trec amândouă.
- **Cine plătește**: părintele marcat `is_billing` pe copil (`private.billing_guardian`). Fiecare părinte are un **cod de plată** (`<prefix>-<n>`, de la 1001) pe care îl trece la transfer. Codul se recunoaște în extras indiferent de cratime, spații sau prefix.
- **Taxa lunară**: grila pe echipă (`fee_plans`), cu ajustări pe jucător (`fee_adjustments`: reducere, scutire, plan individual). O echipă cu taxa 0 (de ex. seniorii) nu e „fără taxă”: apare ca plătită.
- **Reducerea de frate** se aplică de la al doilea copil activ al aceluiași părinte plătitor. Frații scutiți sau încă neînscriși în luna respectivă nu se numără.
- **Cereri de plată ocazionale** (`charge_requests`): cantonament, echipament. Se emit pe echipe sau pe jucători aleși.

## Plăți online

- **Operatorul nu e ales încă.** Plățile trec printr-o interfață (`PaymentAdapter`: checkout, plată cu card salvat, rambursare, webhook, viramente). Stripe, Netopia sau EuPlatesc se adaugă ca un fișier nou în `lib/payments/`, fără schimbări în ecrane sau în baza de date.
- **Adaptorul de test** simulează operatorul: pagină de card, webhook semnat HMAC. Funcționează doar cu `PAYMENTS_TEST_MODE=1` sau în afara producției. În producție, fără operator, plata online e oprită, iar părintele vede doar IBAN-ul, codul și plata cash.
- `online_enabled` pornește **oprit** pentru cluburile noi. Se activează din Setări, după ce există un operator.
- **Webhook-urile sunt idempotente** (`provider_events`). O a doua confirmare pentru o plată deja reușită ajunge ca plată neasociată, nu se alocă de două ori. Evenimentul trebuie să vină de la operatorul care a creat plata.
- **Plata automată** cu cardul salvat:
  - Nu se reîncearcă cât timp o încercare e în curs.
  - După 2 eșecuri pe aceeași datorie se oprește, iar părintele primește o notificare.
- **Cron** (`/api/cron`): emiterea lunară (o dată pe lună, cluburile independent unul de altul), plata automată, reamintirile pentru restanțe.

## Documente

- **Chitanța** se emite doar pentru cash, cu serie (prefix + an) și număr consecutiv per serie (`private.next_counter`).
- **Pentru transfer și plata online** se dă o **dovadă de plată**, nu chitanță (operatorul sau banca emit propriul document).
- **Toate PDF-urile se generează pe server** (pdf-lib, font cu diacritice): chitanța, dovada, referatul. Suma apare și în litere, după DOOM 3.

## Extrase bancare

- **Fișierul nu pleacă din browser.** Se citesc rândurile, utilizatorul confirmă coloanele, iar serverul primește doar rândurile.
- **Fiecare rând are o amprentă**, deci reimportarea aceluiași extras nu dublează nimic.
- **Ce se potrivește automat**:
  - încasările cu codul familiei se asociază singure;
  - plățile se potrivesc cu o cheltuială plătită prin bancă, de aceeași sumă, din ±7 zile, care nu e deja legată de alt rând;
  - restul rămâne de rezolvat.
- **Rezolvarea unui rând** e atomică, cu blocare și reverificarea stării. Redeschiderea unui rând anulează plata creată din el, deci nu apar plăți duble.
- **Plata de la familie înregistrată din bancă** cere metoda „transfer”. Datele din viitor sunt refuzate.

## Cheltuieli, referate, buget, prime

- **Cheltuielile sunt doar în lei.** Au departament (cu subdepartamente), echipă sau jucător opțional și document atașat în dosarul `finance`.
- **Referatul de necesitate**:
  - Îl poate face orice membru al staff-ului și patronul.
  - Aprobatorii sunt rolurile din `finance_settings.approver_roles`, implicit administratorul și patronul.
  - **Doar administratorul** schimbă aprobatorii (`set_approver_roles`). Contabilul nu își poate da singur drept de aprobare.
  - **Separarea atribuțiilor**: nimeni nu își aprobă propriul referat, iar ultimul care l-a modificat nu îl poate aproba.
  - Respingerea cere motiv.
  - Specificația atașată trebuie să fie în dosarul autorului. Documentul final trebuie să fie în dosarul clubului.
- **Bugetul** e pe departament și lună. Raportul compară planul cu cheltuielile reale și cu încasările.
- **Primele** se calculează din reguli (victorie, egal, gol, fără gol primit, a jucat, titular), în fusul orar al clubului. Biroul le aprobă sau respinge rând cu rând.

## Cine vede ce

- **Gestionează banii**: administrator, secretariat, contabil.
- **Văd doar rezumatul** (fără rânduri pe familie): directorul sportiv și patronul.
- **Rambursări și setări sensibile**: administrator, contabil.
- **Antrenorul și preparatorul** văd doar referatele lor.
- **Părintele** vede doar datoriile copiilor lui și plățile lui.
- **Patronul** vede numele staff-ului (pentru referate și prime), nu și conturile familiilor.

## Ce nu acoperă încă

- **Adaptorul real de plăți.** Se scrie după alegerea operatorului (Stripe / Netopia / EuPlatesc): checkout, card salvat, webhook, rambursare, viramente.
- **Ecranul de viramente** (payouts) de la operator și reconcilierea lor cu extrasul.
- **Importul primelor** dintr-un fișier. Primele se calculează doar din reguli.
- **Jucătorii adulți care își plătesc singuri** sunt suportați în baza de date (rolul „jucător” are acces la plăți), dar nu au încă intrarea „Plăți” în meniu.
- **Emiterea pentru jucătorii noi** în mijlocul lunii se face manual, din Taxe. Emiterea automată rulează o dată pe lună.
- **Cheltuieli în valută** și TVA deductibil pe cheltuieli: nu.
