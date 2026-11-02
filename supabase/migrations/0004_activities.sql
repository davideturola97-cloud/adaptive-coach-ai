-- Adaptive Coach AI — Milestone 5: attività svolte, sedute saltate, feedback.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

alter table public.planned_workouts
  add column if not exists skip_reason text check (char_length(skip_reason) <= 300),
  add column if not exists skipped_at timestamptz;

-- Una seduta pianificata può avere al massimo un'attività collegata.
create unique index if not exists activities_one_per_planned
  on public.activities (planned_workout_id) where planned_workout_id is not null;

-- Registra un'attività, la collega alla seduta (che diventa "completato") e salva il feedback, tutto insieme.
-- p_activity: {activity_date, started_at?, sport, title, duration_min, distance_km?, avg_hr?, avg_power_w?, elevation_m?, source, dedupe_key?, planned_workout_id?}
-- p_feedback: {rpe, muscle_fatigue, cardio_fatigue, sleep_quality?, feeling, pain?, notes?} oppure null
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
    (planned_workout_id, activity_date, started_at, sport, title, duration_min, distance_km, avg_hr, avg_power_w, elevation_m, source, dedupe_key)
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
    nullif(p_activity->>'dedupe_key', '')
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

-- Se un'attività collegata viene cancellata, la seduta torna "programmato".
create or replace function public.activity_unlink_plan() returns trigger language plpgsql as $$
begin
  if old.planned_workout_id is not null then
    update public.planned_workouts set status = 'programmato'
    where id = old.planned_workout_id and status = 'completato';
  end if;
  return old;
end $$;

drop trigger if exists activity_unlink on public.activities;
create trigger activity_unlink after delete on public.activities for each row execute function public.activity_unlink_plan();
