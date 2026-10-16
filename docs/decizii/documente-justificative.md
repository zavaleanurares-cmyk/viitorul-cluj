# Documente justificative (cheltuieli)

Echivalentul „Documente justificative” din TFB. Pagina din TFB nu a putut fi deschisă la implementare, așa că modulul urmează practica contabilă obișnuită pentru o asociație sportivă.

- **Documentele unei cheltuieli:** factura (câmpul existent) și oricâte documente justificative, fiecare cu tipul lui:
  - contract;
  - chitanță sau bon;
  - ordin de plată;
  - proces-verbal de recepție;
  - NIR;
  - alt document.

  Stau în tabelul `expense_documents`, iar fișierele în depozitul `finance`, la `<club>/cheltuieli/…`. Le văd și le modifică doar biroul financiar (administrator, secretariat, contabil).
- **În Bani › Cheltuieli:**
  - coloana „Document” arată factura, numărul de documente în plus sau „Fără documente”;
  - filtrul „Fără documente” și avertismentul cu numărul lor arată ce mai trebuie strâns.
- **„Dosarul lunii (ZIP)”** este arhiva pentru contabilitate:
  - câte un dosar pe cheltuială (`NNN_data_furnizor/factura_…`, `contract_…` etc.);
  - `opis.csv` cu toate cheltuielile lunii și documentele fiecăreia;
  - respectă filtrul de departament;
  - are cel mult 300 MB, iar peste 4 MB trece prin depozit, cu link semnat;
  - descărcarea se jurnalizează.
- Ferestrele de dialog deschise dintr-o celulă de tabel nu mai preiau alinierea la dreapta a celulei (era cazul la „Modifică cheltuiala”).
