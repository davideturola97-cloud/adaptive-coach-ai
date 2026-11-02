-- Adaptive Coach AI — intertempi (parziali al km) delle attività.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

-- Elenco dei parziali: [{"n": 1, "km": 1, "paceSec": 312, "hr": 148, "elevM": 4}, ...]
alter table public.activities
  add column if not exists splits jsonb
  check (splits is null or (jsonb_typeof(splits) = 'array' and jsonb_array_length(splits) <= 200));

-- Stessa funzione della Milestone 5, che ora salva anche i parziali.
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
    (planned_workout_id, activity_date, started_at, sport, title, duration_min, distance_km, avg_hr, avg_power_w, elevation_m, source, dedupe_key, splits)
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
    case when jsonb_typeof(p_activity->'splits') = 'array' then p_activity->'splits' else null end
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
