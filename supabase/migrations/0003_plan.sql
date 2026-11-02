-- Adaptive Coach AI — Milestone 4: preferenze per i lunghi e programma salvato con le sue versioni.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

alter table public.profiles
  add column if not exists long_days text[] not null default '{}',
  add column if not exists long_session_max_min integer check (long_session_max_min between 20 and 600),
  add column if not exists sport_days jsonb not null default '{}'::jsonb;

-- Ogni generazione o modifica del programma crea una versione. `previous` conserva le sedute sostituite,
-- così una modifica si può annullare (Milestone 6).
create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  reason text not null default '' check (char_length(reason) <= 300),
  from_date date not null,
  workouts jsonb not null,
  previous jsonb not null default '[]'::jsonb,
  is_current boolean not null default true
);
create index if not exists plan_versions_user on public.plan_versions (user_id, created_at desc);

alter table public.planned_workouts
  add column if not exists plan_version_id uuid references public.plan_versions (id) on delete set null;

alter table public.plan_versions enable row level security;
drop policy if exists "proprie righe" on public.plan_versions;
create policy "proprie righe" on public.plan_versions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.plan_versions from anon;
grant select, insert, update on public.plan_versions to authenticated;

-- Sostituisce in un colpo solo le sedute ancora da fare a partire da una data.
-- Le sedute completate, saltate o modificate restano. Gira con i permessi dell'utente (RLS).
create or replace function public.replace_future_plan(p_from date, p_workouts jsonb, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev jsonb;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if jsonb_typeof(p_workouts) <> 'array' or jsonb_array_length(p_workouts) > 500 then
    raise exception 'Programma non valido';
  end if;
  if exists (select 1 from jsonb_array_elements(p_workouts) w where (w->>'date')::date < p_from) then
    raise exception 'Sedute prima della data di partenza';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.workout_date), '[]'::jsonb) into v_prev
  from public.planned_workouts p
  where p.user_id = auth.uid() and p.workout_date >= p_from and p.status = 'programmato';

  update public.plan_versions set is_current = false where user_id = auth.uid() and is_current;
  insert into public.plan_versions (reason, from_date, workouts, previous)
  values (left(coalesce(p_reason, ''), 300), p_from, p_workouts, v_prev)
  returning id into v_id;

  delete from public.planned_workouts
  where user_id = auth.uid() and workout_date >= p_from and status = 'programmato';

  insert into public.planned_workouts
    (workout_date, sport, workout_type, title, objective, duration_min, distance_km, intensity,
     structure, technical_tips, safety_notes, plan_version_id)
  select
    (w->>'date')::date,
    w->>'sport',
    w->>'type',
    left(w->>'title', 120),
    coalesce(w->>'objective', ''),
    (w->>'durationMin')::integer,
    nullif(w->>'distanceKm', '')::numeric,
    coalesce(w->>'intensity', ''),
    coalesce(w->'structure', '{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(w->'technicalTips')), '{}'),
    coalesce(array(select jsonb_array_elements_text(w->'safetyNotes')), '{}'),
    v_id
  from jsonb_array_elements(p_workouts) w;

  return v_id;
end $$;

revoke all on function public.replace_future_plan(date, jsonb, text) from public;
grant execute on function public.replace_future_plan(date, jsonb, text) to authenticated;
