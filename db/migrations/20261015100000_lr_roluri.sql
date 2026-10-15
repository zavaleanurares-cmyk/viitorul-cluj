-- =============================================================================
-- Locker Room · 1 · Roluri noi
-- Valorile noi ale enumului trebuie confirmate (commit) înainte să fie folosite,
-- de aceea stau într-o migrare separată.
--   admin       administratorul clubului (conturi, setări, tot ce ține de lot și program)
--   secretary   secretariatul (lot, program, înscrieri, documente)
--   accountant  contabilul (bani; faza 3)
--   guardian    părintele sau tutorele unui jucător
-- =============================================================================

alter type public.app_role add value if not exists 'admin';
alter type public.app_role add value if not exists 'secretary';
alter type public.app_role add value if not exists 'accountant';
alter type public.app_role add value if not exists 'guardian';
