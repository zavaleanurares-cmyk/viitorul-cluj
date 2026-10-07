# Jucători și medical — decizii

Modulul acoperă: `/disponibilitate`, `/jucatori`, `/jucatori/[id]` (Sumar), `/jucatori/[id]/medical`,
`/jucatori/[id]/documente`, `/cazuri`, `/cazuri/[id]`. Cod: `apps/web/src/components/players/`,
texte: `messages/ro/players.ts`, `messages/ro/partner.ts`.

## Ce am păstrat și ce am schimbat din runda anterioară

- Păstrat (verificat în browser): tabloul de disponibilitate, lista de jucători, dialogul de stare, formularul de
  jucător, acțiunile pentru stare / profil / contacte / antropometrie / consimțământ / accidentări / tratamente / trimiteri.
- Rescris: fluxul de documente. Varianta veche scria întâi rândul și apoi urca fișierul, cu linkuri semnate.
  Acum: browserul urcă fișierul cu `uploadFile`, apoi acțiunea `saveDocument` / `saveCaseDocument` scrie rândul.
  Deschiderea se face direct prin `fileUrl` (ruta verifică dreptul și jurnalizează).
- Scris de la zero: paginile Sumar, Medical, Documente, Cazuri și cazul partenerului, cu componentele lor.
- Scos: `signedDocumentUrl`, `openDocument`, `registerDocument`, `listPartnerNotesForPlayer` (cu `null` întorcea
  notele tuturor jucătorilor vizibili).

## Permisiuni

- Nicio regulă de acces nu este rescrisă în interfață; secțiunile care nu se aplică rolului doar nu se afișează.
  Toate interogările rulează cu clientul utilizatorului (RLS).
- Jucător invizibil pentru apelant (ex. antrenor pe altă grupă) → `notFound()` și în antet, și în fiecare pagină.
- Directorul sportiv pe `/medical` sau `/documente` este trimis la Sumar (nu la `/tablou`), fără nicio interogare medicală.
- Directorul vede pe Sumar doar: stare, zonă, revenire, restricții, observație, istoricul stărilor, date de profil.
  Nu vede viza medicală pe Sumar. În lista de jucători avertizarea de viză rămâne vizibilă tuturor rolurilor, cum cere
  specificația (data vizei este în rândul `players`, pe care RLS i-l dă oricum).
- Istoricul grupelor se afișează doar celor cu acces medical (așa îl dă RLS).
- Jurnalizare la citire: `fisa` (Sumar), `medical`, `documente`; pe cazul partenerului: `medical`.

## Documente

- Acțiunea care scrie rândul nu are încredere în calea primită din browser: calea trebuie să fie
  `<player_id>/<uuid>-<nume>`, în directorul jucătorului respectiv, cu extensie permisă, iar fișierul trebuie să
  existe în depozit. Fără verificarea prefixului, un rând cu calea altui fișier ar deschide accesul la el.
- Tipul MIME se stabilește după extensie, nu după ce raportează browserul (HEIC și ZIP vin des greșit).
- Dacă rândul nu se poate scrie, preparatorul nu rămâne cu fișier orfan (se șterge). La partener fișierul rămâne
  orfan: fără rând nu are drept de ștergere (`file_access`). Caz rar; de curățat periodic din `/api/cron`.
- Ștergere: întâi fișierul, apoi rândul. Partenerul își poate șterge doar documentele lui.
- „Deschide" = filă nouă, „Descarcă" = `?download=1`. În local, progresul sare de la 0 la 100 (încărcarea trece
  prin server); în producție `uploadFile` raportează procente reale.

## Accidentări și stare

- O accidentare este „activă" până i se completează revenirea reală.
- La adăugare, „Actualizează și starea jucătorului la ACC" este bifat implicit (dacă clubul are starea cu codul
  `ACC` și nu s-a completat revenirea reală). Copiază zona, data estimată și diagnosticul (ca observație).
- La completarea revenirii reale se oferă „Marchează jucătorul APT". Este bifat implicit doar dacă jucătorul nu
  este deja apt și nu mai are altă accidentare activă.
- Salvarea accidentării și schimbarea stării sunt două scrieri separate, nu o tranzacție. Dacă a doua eșuează,
  accidentarea rămâne salvată și utilizatorul vede eroarea. Pentru atomicitate ar trebui un RPC (`save_injury`).
- „Zile indisponibile în sezon" = reuniunea perioadelor de accidentare din sezon (două accidentări suprapuse nu se
  numără de două ori). Se calculează din accidentări, nu din istoricul stărilor (ALT MOTIV nu intră).
- Recidivele se numără doar dacă accidentarea de origine este a aceluiași jucător.
- Return-to-play: etapele 0–5 din `RTP_STAGES`, afișate ca trepte numerotate + numele etapei.
- Pentru stările cu disponibilitate completă (APT), zona, revenirea și restricțiile se șterg la salvare.

## Partener medical

- Pe pagina unui caz se arată doar accidentarea trimiterii (sau toate, dacă trimiterea nu indică una) și
  documentele ei plus cele încărcate de partener, chiar dacă RLS ar da mai mult prin altă trimitere activă.
- Trimiterea nu se șterge, doar se închide / redeschide. O trimitere activă identică (același partener, aceeași
  accidentare) este refuzată.
- Partenerul nu vede fotografia jucătorului (`file_access` nu i-o dă); se afișează inițialele.

## Alte decizii

- Numele nu este cheie: la adăugare / modificare apare doar o avertizare dacă există același nume complet sau
  de afișare în aceeași grupă. Numele de afișare propus = primul cuvânt, cu majuscule.
- „Reînnoită azi" pune expirarea vizei la azi + `medical_visa_validity_months`. Pragul de avertizare în listă este
  `alerts.visa_days_before` (implicit 30).
- Acordul pe hârtie se poate înregistra pentru minori și pentru jucătorii fără dată de naștere. Poate fi marcat
  ca retras. Data semnării se salvează ca `accepted_at`.
- Tabloul: bară de 8 px în culoarea stării; pe „Toate" rândurile sunt grupate pe grupe, altfel pe
  indisponibili / parțial / apți. Filtrele stau în URL (`?grupa=…&filtru=nu-apti|verificare`).
- Tipărire: tabel alb-negru cu starea scrisă în clar. Pagina adaugă un `<style>` de tipărire care scoate grila
  meniului lateral (altfel foaia landscape rămânea îngustă).
- `addMonths`, `dayOf`, `visaState`, `daysLost`, `daysUnavailable` stau local în `components/players/domain.ts`
  (nu am modificat `packages/shared`).

## Nefăcut / de știut

- **Antrenorul nu vede trimiterile și notele partenerului.** `partner_notes_select` îi dă notele, dar
  `referrals_select` nu îi dă trimiterile, iar nota are doar `referral_id` — fără trimitere nu poate fi legată de
  jucător. Soluția este o politică în plus (nu am aplicat-o: schimbare de schemă pe baza comună):
  `create policy referrals_select_medical on public.referrals for select to authenticated using (private.can_read_player_medical(player_id));`
  Apoi `ReferralsPanel` se poate afișa și antrenorului, în citire.
- Pagina inexistentă întoarce HTTP 200 cu conținutul „Pagina nu există" (din cauza `loading.tsx` comun, răspunsul
  începe înainte de `notFound()`). Datele nu apar; doar codul de stare nu este 404.
- Fotografia jucătorului se afișează, dar încărcarea ei nu este în acest modul (jucătorul o schimbă din Profil).
- Modificarea unui document (titlu, tip) nu există; se șterge și se încarcă din nou.
- Export PDF al fișei: modulul Rapoarte.
