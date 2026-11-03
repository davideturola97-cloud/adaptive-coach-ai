-- Adaptive Coach AI — importazione da Strava (sola lettura).
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

-- 1. Collegamento a Strava: uno per utente. I token sono cifrati dall'app (AES-256-GCM) prima di arrivare qui:
--    chi leggesse il database non potrebbe usarli.
create table if not exists public.strava_connections (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  athlete_name text not null default '' check (char_length(athlete_name) <= 120),
  scope text not null default '' check (char_length(scope) <= 200),
  token_ciphertext text not null check (char_length(token_ciphertext) <= 4000),
  last_import_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.strava_connections enable row level security;
drop policy if exists "proprie righe" on public.strava_connections;
create policy "proprie righe" on public.strava_connections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.strava_connections to authenticated;

-- 2. Le attività ricordano da quale attività Strava arrivano: la stessa non si importa due volte.
alter table public.activities add column if not exists external_id text check (char_length(external_id) <= 64);
create unique index if not exists activities_user_external on public.activities (user_id, external_id) where external_id is not null;

alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check check (source in ('manuale', 'screenshot', 'file', 'strava'));

-- 3. record_activity salva anche external_id (stessa funzione della 0007, con un campo in più).
create or replace function public.record_activity(p_activity jsonb, p_feedback jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_planned uuid := nullif(p_activity->>'planned_workout_id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;

  insert into public.activities
    (planned_workout_id, activity_date, started_at, sport, title, duration_min, distance_km, avg_hr, avg_power_w, elevation_m, source, dedupe_key, splits, external_id)
  values (
    v_planned,
    (p_activity->>'activity_date')::date,
    nullif(p_activity->>'started_at', '')::timestamptz,
    p_activity->>'sport',
    coalesce(p_activity->>'title', ''),
    (p_activity->>'duration_min')::numeric,
    nullif(p_activity->>'distance_km', '')::numeric,
    nullif(p_activity->>'avg_hr', '')::integer,
    nullif(p_activity->>'avg_power_w', '')::integer,
    nullif(p_activity->>'elevation_m', '')::integer,
    p_activity->>'source',
    nullif(p_activity->>'dedupe_key', ''),
    case when jsonb_typeof(p_activity->'splits') = 'array' then p_activity->'splits' else null end,
    nullif(p_activity->>'external_id', '')
  )
  returning id into v_id;

  if v_planned is not null then
    update public.planned_workouts set status = 'completato', skip_reason = null, skipped_at = null
    where id = v_planned and user_id = auth.uid();
  end if;

  if p_feedback is not null and jsonb_typeof(p_feedback) = 'object' then
    insert into public.feedback (activity_id, rpe, muscle_fatigue, cardio_fatigue, sleep_quality, feeling, pain, notes)
    values (
      v_id,
      (p_feedback->>'rpe')::integer,
      (p_feedback->>'muscle_fatigue')::integer,
      (p_feedback->>'cardio_fatigue')::integer,
      nullif(p_feedback->>'sleep_quality', '')::integer,
      p_feedback->>'feeling',
      nullif(p_feedback->>'pain', ''),
      nullif(p_feedback->>'notes', '')
    );
  end if;

  return v_id;
end $$;

revoke all on function public.record_activity(jsonb, jsonb) from public;
grant execute on function public.record_activity(jsonb, jsonb) to authenticated;

-- 4. Feedback aggiunto dopo (per le attività importate da Strava): solo sulle proprie attività.
create or replace function public.add_feedback(p_activity_id uuid, p_feedback jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if not exists (select 1 from public.activities where id = p_activity_id and user_id = auth.uid()) then
    raise exception 'Attività non trovata';
  end if;
  insert into public.feedback (activity_id, rpe, muscle_fatigue, cardio_fatigue, sleep_quality, feeling, pain, notes)
  values (
    p_activity_id,
    (p_feedback->>'rpe')::integer,
    (p_feedback->>'muscle_fatigue')::integer,
    (p_feedback->>'cardio_fatigue')::integer,
    nullif(p_feedback->>'sleep_quality', '')::integer,
    p_feedback->>'feeling',
    nullif(p_feedback->>'pain', ''),
    nullif(p_feedback->>'notes', '')
  )
  on conflict (activity_id) do update set
    rpe = excluded.rpe, muscle_fatigue = excluded.muscle_fatigue, cardio_fatigue = excluded.cardio_fatigue,
    sleep_quality = excluded.sleep_quality, feeling = excluded.feeling, pain = excluded.pain, notes = excluded.notes;
end $$;

revoke all on function public.add_feedback(uuid, jsonb) from public;
grant execute on function public.add_feedback(uuid, jsonb) to authenticated;
