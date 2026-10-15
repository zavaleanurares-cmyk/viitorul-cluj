-- Locker Room · 6 · La ștergerea unui club sau a unui jucător, cascadele și „set null" ating aceleași rânduri
-- în ordini diferite (ex. un eveniment de meci primește player_id = null după ce meciul lui a fost deja șters).
-- Cheile de mai jos se verifică la sfârșitul tranzacției, când rândurile orfane au dispărut deja.
alter table public.events          alter constraint events_club_id_fkey deferrable initially deferred;
alter table public.event_series    alter constraint event_series_club_id_fkey deferrable initially deferred;
alter table public.event_teams     alter constraint event_teams_event_id_fkey deferrable initially deferred;
alter table public.matches         alter constraint matches_event_id_fkey deferrable initially deferred;
alter table public.match_events    alter constraint match_events_event_id_fkey deferrable initially deferred;
alter table public.match_squad     alter constraint match_squad_event_id_fkey deferrable initially deferred;
alter table public.suspensions     alter constraint suspensions_club_id_fkey deferrable initially deferred;
alter table public.suspensions     alter constraint suspensions_player_id_fkey deferrable initially deferred;
alter table public.suspensions     alter constraint suspensions_competition_id_fkey deferrable initially deferred;
alter table public.competitions    alter constraint competitions_club_id_fkey deferrable initially deferred;
alter table public.guardians       alter constraint guardians_club_id_fkey deferrable initially deferred;
alter table public.attendance      alter constraint attendance_event_id_fkey deferrable initially deferred;
alter table public.attendance      alter constraint attendance_player_id_fkey deferrable initially deferred;
