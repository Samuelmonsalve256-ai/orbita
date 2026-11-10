-- ════════════════════════════════════════════════════════════════════════════
-- CRONOVA · 03_cronova_avisos.sql
-- Notificaciones al celular (Web Push), como en Mis Deudores:
--   · Resumen de tus citas del día (por defecto a las 10:00 a. m.).
--   · Aviso 30 minutos antes de cada cita.
-- Llegan aunque CRONOVA esté cerrada.
--
-- Ejecutar DESPUÉS de crear la función "cronova-avisos" (ver LEEME, paso 6).
-- Se puede ejecutar más de una vez: no borra nada y reemplaza la programación.
-- Si sale un error con pg_cron o pg_net, actívalos en Database → Extensions.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Permite guardar tus Ajustes en la nube (por si no ejecutaste 02_cronova.sql)
alter table public.orb_items drop constraint if exists orb_items_coleccion_check;
alter table public.orb_items add constraint orb_items_coleccion_check
  check (coleccion in ('events','emails','calls','config'));

-- Tus dispositivos (iPhone, Mac) que reciben avisos
create table if not exists public.orb_push_suscripciones (
  endpoint     text primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  dispositivo  text,
  creado       timestamptz not null default now(),
  ultimo_envio timestamptz
);
alter table public.orb_push_suscripciones enable row level security;
revoke all on table public.orb_push_suscripciones from public, anon, authenticated;
grant select, insert, update, delete on table public.orb_push_suscripciones to authenticated;
drop policy if exists "orb push: mis dispositivos" on public.orb_push_suscripciones;
create policy "orb push: mis dispositivos" on public.orb_push_suscripciones for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Claves del servicio de avisos (solo las lee la función, nunca el navegador)
create table if not exists public.orb_push_config (
  id            int primary key check (id = 1),
  vapid_publica text,
  vapid_privada jsonb,
  secreto_cron  text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.orb_push_config enable row level security;
revoke all on table public.orb_push_config from public, anon, authenticated;
insert into public.orb_push_config (id) values (1) on conflict (id) do nothing;

-- Registro de avisos enviados: cada aviso llega una sola vez
create table if not exists public.orb_push_envios (
  user_id uuid not null references auth.users(id) on delete cascade,
  clave   text not null,
  creado  timestamptz not null default now(),
  primary key (user_id, clave)
);
alter table public.orb_push_envios enable row level security;
revoke all on table public.orb_push_envios from public, anon, authenticated;

commit;

-- ── Revisión automática cada 5 minutos ────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cronova-avisos') then
    perform cron.unschedule('cronova-avisos');
  end if;
end
$$;

select cron.schedule(
  'cronova-avisos',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://llyovzgwdqoeunvyczcy.supabase.co/functions/v1/cronova-avisos',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseW92emd3ZHFvZXVudnljemN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzUzNjcsImV4cCI6MjEwNjAxMTM2N30.g1DgUdTGPHDz8HEI1Kgv4SOJ13zyOwOfcAp8Ak2BRGQ',
      'x-cr-cron',     (select secreto_cron from public.orb_push_config where id = 1)
    ),
    body    := '{"accion":"revisar"}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);

-- Comprobación: debe mostrar la tarea "cronova-avisos" activa, cada 5 minutos
select jobname, schedule, active from cron.job where jobname = 'cronova-avisos';
