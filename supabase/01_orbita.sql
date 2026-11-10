-- ════════════════════════════════════════════════════════════════════════════
-- Órbita · 01_orbita.sql
-- Crea las tablas de Órbita en el mismo proyecto de Supabase de MotoContable.
-- NO toca ninguna tabla de MotoContable (mc_*). Se puede ejecutar más de una vez.
--
--   orb_items     : un registro por cita, correo o llamada de Órbita.
--   orb_historial : copia de cada versión anterior. Nada se pierde.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.orb_items (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  coleccion  text        not null check (coleccion in ('events','emails','calls')),
  id         text        not null check (length(id) between 1 and 200),
  data       jsonb       not null check (jsonb_typeof(data) = 'object'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, coleccion, id)
);

create table if not exists public.orb_historial (
  hist_id     bigserial   primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  coleccion   text        not null,
  id          text        not null,
  data        jsonb,
  deleted_at  timestamptz,
  motivo      text        not null check (motivo in ('edicion','eliminacion')),
  guardado_en timestamptz not null default now()
);
create index if not exists orb_historial_user_idx on public.orb_historial (user_id, coleccion, id, guardado_en desc);

-- Antes de cada cambio: guarda la versión anterior en el historial y actualiza la fecha.
create or replace function public.orb_items_antes_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data is distinct from old.data or new.deleted_at is distinct from old.deleted_at then
    insert into public.orb_historial (user_id, coleccion, id, data, deleted_at, motivo)
    values (old.user_id, old.coleccion, old.id, old.data, old.deleted_at,
            case when new.deleted_at is not null and old.deleted_at is null then 'eliminacion' else 'edicion' end);
  end if;
  new.user_id    := old.user_id;      -- nadie puede cambiar el dueño
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orb_items_antes_update on public.orb_items;
create trigger orb_items_antes_update before update on public.orb_items
  for each row execute function public.orb_items_antes_update();

-- ── Seguridad: solo tu cuenta lee y escribe tus datos ─────────────────────────
alter table public.orb_items     enable row level security;
alter table public.orb_historial enable row level security;

revoke all on table public.orb_items     from public, anon, authenticated;
revoke all on table public.orb_historial from public, anon, authenticated;
revoke all on sequence public.orb_historial_hist_id_seq from public, anon, authenticated;
grant select, insert, update on table public.orb_items     to authenticated;   -- sin DELETE: se marca deleted_at
grant select                 on table public.orb_historial to authenticated;

drop policy if exists "orb leer mios"      on public.orb_items;
drop policy if exists "orb crear mios"     on public.orb_items;
drop policy if exists "orb modificar mios" on public.orb_items;
drop policy if exists "orb historial mio"  on public.orb_historial;

create policy "orb leer mios" on public.orb_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "orb crear mios" on public.orb_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "orb modificar mios" on public.orb_items
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "orb historial mio" on public.orb_historial
  for select to authenticated using (user_id = (select auth.uid()));

commit;

-- ── Tiempo real: cambios del iPhone aparecen solos en el Mac y al revés ───────
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orb_items') then
    alter publication supabase_realtime add table public.orb_items;
  end if;
end $$;

-- Comprobación: debe mostrar orb_items y orb_historial con rls_activo = true
select tablename, rowsecurity as rls_activo from pg_tables
where schemaname = 'public' and tablename in ('orb_items','orb_historial');
