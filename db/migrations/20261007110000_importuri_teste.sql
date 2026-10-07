-- =============================================================================
-- Importuri · rezultate la teste fizice
--
-- Un rând din fișier = un jucător la o dată, cu câte o valoare pentru fiecare test mapat.
-- Atomic și idempotent: reimportul aceluiași fișier actualizează valorile (cheia este
-- test + jucător + dată), nu le dublează. Jucătorii nepotriviți nu se creează: se sar
-- și apar în raport. SECURITY INVOKER: scrierile trec prin RLS, ca la celelalte importuri.
--
-- Payload:
--   { filename, file_hash, mapping,
--     rows: [{ row, source_name, match_key, player_id | null, tested_on, note,
--              results: [{ test_id, value }] }] }
-- =============================================================================

create or replace function public.import_tests(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_club uuid := private.my_club();
  r jsonb; t jsonb;
  v_player uuid;
  v_date date;
  v_exists boolean;
  v_new int := 0; v_updated int := 0; v_skipped int := 0; v_rows int := 0; v_flagged int := 0;
  v_row_new int; v_row_updated int;
  v_matches jsonb := '[]'::jsonb;
  v_details jsonb := '[]'::jsonb;
  v_import uuid;
begin
  if not private.is_physio() then raise exception 'Acces interzis' using errcode = '42501'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_payload->'rows', '[]'::jsonb)) loop
    v_player := nullif(r->>'player_id', '')::uuid;
    v_date := nullif(r->>'tested_on', '')::date;
    if v_player is null or v_date is null or jsonb_array_length(coalesce(r->'results', '[]'::jsonb)) = 0 then
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'date', r->>'tested_on',
        'result', 'skipped',
        'note', coalesce(nullif(r->>'note', ''),
                         case when v_player is null then 'Jucător nepotrivit'
                              when v_date is null then 'Lipsește data testării'
                              else 'Nicio valoare de importat' end));
      continue;
    end if;

    v_row_new := 0; v_row_updated := 0;
    for t in select * from jsonb_array_elements(r->'results') loop
      if not exists (select 1 from public.fitness_tests ft where ft.id = (t->>'test_id')::uuid and ft.club_id = v_club) then
        raise exception 'Test inexistent în club' using errcode = '23503';
      end if;
      select exists (
        select 1 from public.fitness_test_results fr
        where fr.test_id = (t->>'test_id')::uuid and fr.player_id = v_player and fr.tested_on = v_date
      ) into v_exists;
      insert into public.fitness_test_results (test_id, player_id, tested_on, value, created_by)
      values ((t->>'test_id')::uuid, v_player, v_date, (t->>'value')::numeric, (select app_auth.uid()))
      on conflict (test_id, player_id, tested_on) do update set value = excluded.value;
      if v_exists then v_row_updated := v_row_updated + 1; else v_row_new := v_row_new + 1; end if;
    end loop;

    v_new := v_new + v_row_new;
    v_updated := v_updated + v_row_updated;
    v_rows := v_rows + 1;
    if nullif(r->>'note', '') is not null then v_flagged := v_flagged + 1; end if;
    v_matches := v_matches || jsonb_build_object('source_name', r->>'match_key', 'group_id', null, 'player_id', v_player);
    v_details := v_details || jsonb_build_object('row', r->'row', 'name', r->>'source_name', 'date', r->>'tested_on',
      'result', case when v_row_new = 0 then 'updated' else 'imported' end,
      'values', v_row_new + v_row_updated,
      'flagged', nullif(r->>'note', '') is not null, 'note', nullif(r->>'note', ''));
  end loop;

  perform private.remember_matches(v_club, v_matches);

  insert into public.imports (club_id, kind, filename, file_hash, mapping, rows_imported, rows_skipped, rows_flagged, report, created_by)
  values (v_club, 'tests', p_payload->>'filename', p_payload->>'file_hash', p_payload->'mapping', v_rows, v_skipped, v_flagged,
          jsonb_build_object('new', v_new, 'updated', v_updated, 'rows', v_details), (select app_auth.uid()))
  returning id into v_import;

  return jsonb_build_object('import_id', v_import, 'rows', v_rows, 'new', v_new, 'updated', v_updated,
                            'skipped', v_skipped, 'flagged', v_flagged);
end $$;

revoke execute on function public.import_tests(jsonb) from public, anon;
grant execute on function public.import_tests(jsonb) to authenticated, service_role;
