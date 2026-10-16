-- Documentele justificative ale cheltuielilor (ca „Documente justificative" din TFB): pe lângă factură
-- (expenses.document_path), o cheltuială poate avea contract, chitanță/bon, ordin de plată, proces-verbal de recepție, NIR etc.
-- Fișierele stau în depozitul „finance", la <club>/cheltuieli/…, și le vede biroul financiar.

create table public.expense_documents (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  kind         text not null check (kind in ('contract', 'receipt', 'payment_order', 'handover', 'nir', 'other')),
  path         text not null unique check (length(path) <= 300),
  file_name    text not null check (length(file_name) between 1 and 200),
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index expense_documents_expense_idx on public.expense_documents (expense_id);

alter table public.expense_documents enable row level security;
create policy expense_documents_all on public.expense_documents for all to authenticated
  using (club_id = (select private.my_club()) and (select private.is_finance()))
  with check (club_id = (select private.my_club()) and (select private.is_finance())
              and left(path, 37) = club_id::text || '/'
              and exists (select 1 from public.expenses e where e.id = expense_id and e.club_id = club_id));
grant select, insert, update, delete on public.expense_documents to authenticated;
grant all on public.expense_documents to service_role;
create trigger expense_documents_audit after insert or update or delete on public.expense_documents
  for each row execute function private.audit();
