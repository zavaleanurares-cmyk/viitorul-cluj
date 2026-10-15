-- Locker Room · Faza 4 · Club: magazinul clubului (echipament, pachete, mărimi cu stoc, comenzi prin registrul de taxe).
--
-- Familia comandă din aplicație pentru un copil; stocul scade pe loc, iar suma intră ca taxă (kind 'equipment')
-- în registrul familiei, plătită ca orice altă taxă. Biroul pregătește comanda („gata de ridicat") și o predă.
-- Anularea pune stocul la loc și anulează taxa neplătită. Fiecare mișcare de stoc rămâne în jurnal.

create or replace function private.can_manage_shop() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.my_role()) in ('admin', 'secretary', 'accountant'), false)
$$;
grant execute on function private.can_manage_shop() to authenticated;

create table public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  name         text not null check (length(name) between 2 and 120),
  description  text check (length(description) <= 2000),
  category     text not null default 'kit' check (category in ('kit', 'training', 'accessories', 'other')),
  price        bigint not null check (price between 0 and 100000000),
  photo_paths  text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  kind         text not null default 'item' check (kind in ('item', 'bundle')),
  size_kind    text not null default 'apparel' check (size_kind in ('apparel', 'shoes', 'none')),
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index shop_products_club_idx on public.shop_products (club_id, is_active, sort);

create table public.shop_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.shop_products(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  size        text check (length(size) between 1 and 12),
  stock       int not null default 0 check (stock >= 0),
  sort        int not null default 0
);
create unique index shop_variants_uq on public.shop_variants (product_id, coalesce(size, ''));

create table public.shop_bundle_items (
  bundle_id   uuid not null references public.shop_products(id) on delete cascade,
  product_id  uuid not null references public.shop_products(id) on delete cascade,
  primary key (bundle_id, product_id),
  check (bundle_id <> product_id)
);

create table public.shop_orders (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  number        int not null,
  player_id     uuid references public.players(id) on delete set null,
  guardian_id   uuid references public.guardians(id) on delete set null,
  child_name    text not null,
  status        text not null default 'placed' check (status in ('placed', 'ready', 'picked_up', 'cancelled')),
  total         bigint not null check (total >= 0),
  charge_id     uuid references public.charges(id) on delete set null,
  note          text check (length(note) <= 500),
  cancel_reason text check (length(cancel_reason) <= 500),
  placed_by     uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  ready_at      timestamptz,
  picked_up_at  timestamptz,
  unique (club_id, number)
);
create index shop_orders_club_idx on public.shop_orders (club_id, status, created_at desc);

create table public.shop_order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.shop_orders(id) on delete cascade,
  product_id  uuid references public.shop_products(id) on delete set null,
  variant_id  uuid references public.shop_variants(id) on delete set null,
  parent_id   uuid references public.shop_order_items(id) on delete cascade,
  title       text not null,
  size        text,
  qty         int not null check (qty between 1 and 20),
  unit_price  bigint not null check (unit_price >= 0)
);
create index shop_order_items_order_idx on public.shop_order_items (order_id);

create table public.shop_stock_moves (
  id          bigint generated always as identity primary key,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  variant_id  uuid not null references public.shop_variants(id) on delete cascade,
  delta       int not null,
  reason      text not null check (reason in ('restock', 'adjust', 'order', 'cancel')),
  order_id    uuid references public.shop_orders(id) on delete set null,
  note        text check (length(note) <= 200),
  actor_id    uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index shop_stock_moves_variant_idx on public.shop_stock_moves (variant_id, at desc);

alter table public.shop_products enable row level security;
alter table public.shop_variants enable row level security;
alter table public.shop_bundle_items enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_stock_moves enable row level security;
-- catalogul activ îl vede tot clubul; produsele ascunse doar biroul
create policy shop_products_select on public.shop_products for select to authenticated
  using (club_id = (select private.my_club()) and (is_active or (select private.can_manage_shop())));
create policy shop_variants_select on public.shop_variants for select to authenticated
  using (club_id = (select private.my_club()));
create policy shop_bundle_items_select on public.shop_bundle_items for select to authenticated
  using (exists (select 1 from public.shop_products p where p.id = bundle_id and p.club_id = (select private.my_club())));
create or replace function private.can_see_order(p_order uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shop_orders o where o.id = p_order and o.club_id = private.my_club()
                   and (private.can_manage_shop() or o.placed_by = app_auth.uid() or o.player_id = any (private.my_player_ids())))
$$;
create policy shop_orders_select on public.shop_orders for select to authenticated
  using (club_id = (select private.my_club()) and ((select private.can_manage_shop()) or placed_by = (select app_auth.uid())
         or player_id = any (private.my_player_ids())));
create policy shop_order_items_select on public.shop_order_items for select to authenticated
  using ((select private.can_see_order(order_id)));
create policy shop_stock_moves_select on public.shop_stock_moves for select to authenticated
  using (club_id = (select private.my_club()) and (select private.can_manage_shop()));
grant select on public.shop_products, public.shop_variants, public.shop_bundle_items, public.shop_orders,
  public.shop_order_items, public.shop_stock_moves to authenticated;

/**
 * Produsul cu mărimile și stocul.
 *   p = { id?, name, description?, category, price, photo_paths[], kind, size_kind, is_active, sort?,
 *         variants: [{ size|null, stock }], bundle_items: [product_id] }
 * Stocul scris aici e stocul nou: diferența intră în jurnal ca „adjust" (sau „restock" dacă crește).
 */
create or replace function public.save_product(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_club uuid := private.my_club(); v_id uuid := nullif(p->>'id', '')::uuid; v jsonb; v_var record; v_size text; v_stock int;
        v_sizes text[] := '{}'; v_sort int := 0; v_photos text[];
begin
  if not private.can_manage_shop() then raise exception 'Doar biroul administrează magazinul.' using errcode = '42501'; end if;
  select coalesce(array_agg(x), '{}') into v_photos from jsonb_array_elements_text(coalesce(p->'photo_paths', '[]'::jsonb)) x
  where x like v_club::text || '/%';
  if v_id is null then
    insert into public.shop_products (club_id, name, description, category, price, photo_paths, kind, size_kind, is_active, sort)
    values (v_club, trim(p->>'name'), nullif(trim(p->>'description'), ''), coalesce(nullif(p->>'category', ''), 'kit'), (p->>'price')::bigint,
            v_photos, coalesce(nullif(p->>'kind', ''), 'item'), coalesce(nullif(p->>'size_kind', ''), 'apparel'),
            coalesce((p->>'is_active')::boolean, true), coalesce((p->>'sort')::int, 0))
    returning id into v_id;
  else
    update public.shop_products set name = trim(p->>'name'), description = nullif(trim(p->>'description'), ''),
      category = coalesce(nullif(p->>'category', ''), category), price = (p->>'price')::bigint, photo_paths = v_photos,
      size_kind = coalesce(nullif(p->>'size_kind', ''), size_kind), is_active = coalesce((p->>'is_active')::boolean, is_active),
      sort = coalesce((p->>'sort')::int, sort)
    where id = v_id and club_id = v_club;
    if not found then raise exception 'Produsul nu a fost găsit.' using errcode = 'P0002'; end if;
  end if;

  if (select kind from public.shop_products where id = v_id) = 'bundle' then
    delete from public.shop_bundle_items where bundle_id = v_id;
    insert into public.shop_bundle_items (bundle_id, product_id)
    select v_id, pr.id from public.shop_products pr
    where pr.club_id = v_club and pr.kind = 'item' and pr.id <> v_id
      and pr.id::text in (select jsonb_array_elements_text(coalesce(p->'bundle_items', '[]'::jsonb)));
    if not exists (select 1 from public.shop_bundle_items where bundle_id = v_id) then
      raise exception 'Alege produsele din pachet.' using errcode = '22023';
    end if;
  else
    for v in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb)) loop
      v_size := nullif(trim(coalesce(v->>'size', '')), '');
      v_stock := greatest(coalesce((v->>'stock')::int, 0), 0);
      v_sizes := v_sizes || coalesce(v_size, '');
      select * into v_var from public.shop_variants where product_id = v_id and coalesce(size, '') = coalesce(v_size, '') for update;
      if not found then
        insert into public.shop_variants (product_id, club_id, size, stock, sort) values (v_id, v_club, v_size, v_stock, v_sort) returning * into v_var;
        if v_stock > 0 then
          insert into public.shop_stock_moves (club_id, variant_id, delta, reason, actor_id) values (v_club, v_var.id, v_stock, 'restock', app_auth.uid());
        end if;
      else
        if v_stock <> v_var.stock then
          insert into public.shop_stock_moves (club_id, variant_id, delta, reason, actor_id)
          values (v_club, v_var.id, v_stock - v_var.stock, case when v_stock > v_var.stock then 'restock' else 'adjust' end, app_auth.uid());
        end if;
        update public.shop_variants set stock = v_stock, sort = v_sort where id = v_var.id;
      end if;
      v_sort := v_sort + 1;
    end loop;
    -- mărimile scoase: dispar dacă nu au comenzi; altfel rămân cu stoc 0
    delete from public.shop_variants sv where sv.product_id = v_id and not (coalesce(sv.size, '') = any (v_sizes))
      and not exists (select 1 from public.shop_order_items oi where oi.variant_id = sv.id);
    update public.shop_variants sv set stock = 0 where sv.product_id = v_id and not (coalesce(sv.size, '') = any (v_sizes));
    if not exists (select 1 from public.shop_variants where product_id = v_id) then
      raise exception 'Adaugă cel puțin o mărime (sau „mărime unică").' using errcode = '22023';
    end if;
  end if;
  return v_id;
end $$;

/**
 * Comanda: p_items = [{ product_id, variant_id?, qty, components?: [{ product_id, variant_id }] }].
 * Pentru un produs simplu se alege mărimea (variant_id); pentru un pachet, câte o mărime pe fiecare produs din pachet.
 */
create or replace function public.place_order(p_player uuid, p_items jsonb, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_club uuid := private.my_club(); v_pl record; v_order uuid; v_number int; v_total bigint := 0; it jsonb; comp jsonb;
  v_prod record; v_var record; v_qty int; v_line uuid; v_g uuid; v_charge uuid; v_n int := 0;
begin
  if not (p_player = any (private.my_player_ids()) or private.can_manage_shop()) then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select id, full_name, birth_date into v_pl from public.players where id = p_player and club_id = v_club and is_active and anonymized_at is null;
  if not found then raise exception 'Jucătorul nu a fost găsit.' using errcode = 'P0002'; end if;
  if private.my_role() = 'player' and (v_pl.birth_date is null or v_pl.birth_date > private.club_today(v_club) - interval '18 years') then
    raise exception 'Roagă un părinte să comande din contul lui.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Coșul e gol.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('shop_order:' || v_club::text));
  select coalesce(max(number), 0) + 1 into v_number from public.shop_orders where club_id = v_club;
  v_g := private.billing_guardian(p_player);
  insert into public.shop_orders (club_id, number, player_id, guardian_id, child_name, total, note, placed_by)
  values (v_club, v_number, p_player, v_g, v_pl.full_name, 0, nullif(trim(p_note), ''), app_auth.uid())
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((it->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 20 then raise exception 'Cantitate invalidă.' using errcode = '22023'; end if;
    select * into v_prod from public.shop_products where id = (it->>'product_id')::uuid and club_id = v_club and is_active;
    if not found then raise exception 'Un produs nu mai este disponibil.' using errcode = 'P0002'; end if;
    if v_prod.kind = 'item' then
      select * into v_var from public.shop_variants where id = (it->>'variant_id')::uuid and product_id = v_prod.id for update;
      if not found then raise exception 'Alege mărimea pentru %.', v_prod.name using errcode = '22023'; end if;
      if v_var.stock < v_qty then raise exception 'Nu mai avem % în mărimea % (rămase: %).', v_prod.name, coalesce(v_var.size, 'unică'), v_var.stock using errcode = '22023'; end if;
      update public.shop_variants set stock = stock - v_qty where id = v_var.id;
      insert into public.shop_stock_moves (club_id, variant_id, delta, reason, order_id, actor_id) values (v_club, v_var.id, -v_qty, 'order', v_order, app_auth.uid());
      insert into public.shop_order_items (order_id, product_id, variant_id, title, size, qty, unit_price)
      values (v_order, v_prod.id, v_var.id, v_prod.name, v_var.size, v_qty, v_prod.price);
    else
      insert into public.shop_order_items (order_id, product_id, title, qty, unit_price)
      values (v_order, v_prod.id, v_prod.name, v_qty, v_prod.price) returning id into v_line;
      if (select count(*) from public.shop_bundle_items where bundle_id = v_prod.id)
         <> (select count(distinct c->>'product_id') from jsonb_array_elements(coalesce(it->'components', '[]'::jsonb)) c
             where (c->>'product_id')::uuid in (select product_id from public.shop_bundle_items where bundle_id = v_prod.id))
         or jsonb_array_length(it->'components') <> (select count(*) from public.shop_bundle_items where bundle_id = v_prod.id) then
        raise exception 'Alege mărimea pentru fiecare produs din %.', v_prod.name using errcode = '22023';
      end if;
      for comp in select * from jsonb_array_elements(it->'components') loop
        select sv.*, pr.name as pname into v_var from public.shop_variants sv join public.shop_products pr on pr.id = sv.product_id
        where sv.id = (comp->>'variant_id')::uuid and sv.product_id = (comp->>'product_id')::uuid
          and sv.product_id in (select product_id from public.shop_bundle_items where bundle_id = v_prod.id) for update of sv;
        if not found then raise exception 'Alege mărimea pentru fiecare produs din %.', v_prod.name using errcode = '22023'; end if;
        if v_var.stock < v_qty then raise exception 'Nu mai avem % în mărimea % (rămase: %).', v_var.pname, coalesce(v_var.size, 'unică'), v_var.stock using errcode = '22023'; end if;
        update public.shop_variants set stock = stock - v_qty where id = v_var.id;
        insert into public.shop_stock_moves (club_id, variant_id, delta, reason, order_id, actor_id) values (v_club, v_var.id, -v_qty, 'order', v_order, app_auth.uid());
        insert into public.shop_order_items (order_id, product_id, variant_id, parent_id, title, size, qty, unit_price)
        values (v_order, v_var.product_id, v_var.id, v_line, v_var.pname, v_var.size, v_qty, 0);
      end loop;
    end if;
    v_total := v_total + v_prod.price * v_qty;
    v_n := v_n + v_qty;
  end loop;

  if v_total > 0 then
    insert into public.charges (club_id, player_id, guardian_id, kind, title, amount, due_on, created_by)
    values (v_club, p_player, v_g, 'equipment', 'Magazin: comanda nr. ' || v_number, v_total, private.club_today(v_club) + 7, app_auth.uid())
    returning id into v_charge;
  end if;
  update public.shop_orders set total = v_total, charge_id = v_charge where id = v_order;
  perform private.notify_users(v_club, array['admin', 'secretary', 'accountant']::public.app_role[], 'shop_order',
    'Comandă nouă nr. ' || v_number, v_pl.full_name || ' · ' || private.lei(v_total), '/club/magazin', 'shop_order:' || v_order, app_auth.uid());
  return jsonb_build_object('id', v_order, 'number', v_number, 'total', v_total, 'items', v_n);
end $$;

/** Biroul: „gata de ridicat" (familia e anunțată), apoi „predat". */
create or replace function public.set_order_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o record; v_user uuid;
begin
  if not private.can_manage_shop() then raise exception 'Acces interzis' using errcode = '42501'; end if;
  select * into v_o from public.shop_orders where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Comanda nu a fost găsită.' using errcode = 'P0002'; end if;
  if not ((v_o.status = 'placed' and p_status in ('ready', 'picked_up')) or (v_o.status = 'ready' and p_status in ('picked_up', 'placed'))) then
    raise exception 'Comanda nu poate trece în această stare.' using errcode = '22023';
  end if;
  update public.shop_orders set status = p_status,
    ready_at = case when p_status = 'ready' then now() when p_status = 'placed' then null else ready_at end,
    picked_up_at = case when p_status = 'picked_up' then now() else picked_up_at end
  where id = p_id;
  if p_status = 'ready' then
    v_user := coalesce(v_o.placed_by, (select user_id from public.guardians where id = v_o.guardian_id));
    if v_user is not null and v_user is distinct from app_auth.uid() then
      perform private.notify(v_user, 'shop_order', 'Comanda nr. ' || v_o.number || ' e gata de ridicat', v_o.child_name, '/magazin', 'shop_ready:' || p_id);
    end if;
  end if;
end $$;

/** Anularea: familia cât timp comanda nu e pregătită; biroul până la predare. Stocul revine, taxa neplătită se anulează. */
create or replace function public.cancel_order(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_o record; r record;
begin
  select * into v_o from public.shop_orders where id = p_id and club_id = private.my_club() for update;
  if not found then raise exception 'Comanda nu a fost găsită.' using errcode = 'P0002'; end if;
  if private.can_manage_shop() then
    if v_o.status not in ('placed', 'ready') then raise exception 'Comanda predată nu se mai anulează.' using errcode = '22023'; end if;
  else
    if not (v_o.placed_by = app_auth.uid() or v_o.player_id = any (private.my_player_ids())) then raise exception 'Acces interzis' using errcode = '42501'; end if;
    if v_o.status <> 'placed' then raise exception 'Comanda e deja pregătită; anunță biroul clubului.' using errcode = '22023'; end if;
  end if;
  for r in select variant_id, qty from public.shop_order_items where order_id = p_id and variant_id is not null loop
    update public.shop_variants set stock = stock + r.qty where id = r.variant_id;
    insert into public.shop_stock_moves (club_id, variant_id, delta, reason, order_id, actor_id) values (v_o.club_id, r.variant_id, r.qty, 'cancel', p_id, app_auth.uid());
  end loop;
  if v_o.charge_id is not null then
    if exists (select 1 from public.allocations where charge_id = v_o.charge_id) then
      perform private.notify_users(v_o.club_id, array['accountant', 'admin']::public.app_role[], 'shop_order',
        'Restituire de verificat: comanda nr. ' || v_o.number, v_o.child_name, '/bani', 'shop_refund:' || p_id);
    else
      update public.charges set status = 'cancelled', cancel_reason = 'Comandă anulată' where id = v_o.charge_id and status = 'open';
    end if;
  end if;
  update public.shop_orders set status = 'cancelled', cancel_reason = nullif(trim(p_reason), '') where id = p_id;
end $$;

grant execute on function public.save_product(jsonb), public.place_order(uuid, jsonb, text), public.set_order_status(uuid, text),
  public.cancel_order(uuid, text) to authenticated;

-- Depozitul „shop": fotografiile produselor (<club>/<uuid>.<ext>): le vede tot clubul, le încarcă biroul
create or replace function private.shop_file_access(p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case when p_action = 'read' then true else private.can_manage_shop() end
$$;
grant execute on function private.shop_file_access(text) to authenticated;

do $$
declare v_src text;
begin
  select pg_get_functiondef('private.file_access_lr(text, text, text, uuid, public.app_role)'::regprocedure) into v_src;
  if position('shop_file_access' in v_src) = 0 then
    v_src := replace(v_src, E'  end if;\n  return false;\nend', E'  elsif p_bucket = ''shop'' then\n    if p_owner is distinct from (select private.my_club()) then return false; end if;\n    return private.shop_file_access(p_action);\n  end if;\n  return false;\nend');
    if position('shop_file_access' in v_src) = 0 then raise exception 'file_access_lr: punctul de inserare nu a fost găsit'; end if;
    execute v_src;
  end if;
end $$;
