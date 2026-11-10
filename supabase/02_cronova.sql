-- ════════════════════════════════════════════════════════════════════════════
-- CRONOVA · 02_cronova.sql
-- Permite guardar tus Ajustes (nombre, casa, colores, sonidos) en la nube,
-- para que sean iguales en el iPhone y en el Mac.
-- No borra ni cambia ningún dato. Se puede ejecutar más de una vez.
-- ════════════════════════════════════════════════════════════════════════════

begin;

alter table public.orb_items drop constraint if exists orb_items_coleccion_check;
alter table public.orb_items add constraint orb_items_coleccion_check
  check (coleccion in ('events','emails','calls','config'));

commit;

-- Comprobación: debe mostrar la regla con 'config' incluido
select conname, pg_get_constraintdef(oid) as regla
from pg_constraint where conname = 'orb_items_coleccion_check';
