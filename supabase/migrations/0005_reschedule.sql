-- Adaptive Coach AI — Milestone 6: modifiche al programma con storico e annullamento.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

alter table public.plan_versions
  add column if not exists kind text not null default 'generazione' check (kind in ('generazione', 'modifica', 'annullamento')),
  add column if not exists created_ids uuid[] not null default '{}',
  add column if not exists undone_at timestamptz;

-- Il programma generato registra le sedute che crea, così anche la generazione si può annullare.
create or replace function public.replace_future_plan(p_from date, p_workouts jsonb, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev jsonb;
  v_created uuid[];
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
  insert into public.plan_versions (reason, from_date, workouts, previous, kind)
  values (left(coalesce(p_reason, ''), 300), p_from, p_workouts, v_prev, 'generazione')
  returning id into v_id;

  delete from public.planned_workouts
  where user_id = auth.uid() and workout_date >= p_from and status = 'programmato';

  with ins as (
    insert into public.planned_workouts
      (workout_date, sport, workout_type, title, objective, duration_min, distance_km, intensity,
       structure, technical_tips, safety_notes, plan_version_id)
    select
      (w->>'date')::date, w->>'sport', w->>'type', left(w->>'title', 120), coalesce(w->>'objective', ''),
      (w->>'durationMin')::integer, nullif(w->>'distanceKm', '')::numeric, coalesce(w->>'intensity', ''),
      coalesce(w->'structure', '{}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(w->'technicalTips')), '{}'),
      coalesce(array(select jsonb_array_elements_text(w->'safetyNotes')), '{}'),
      v_id
    from jsonb_array_elements(p_workouts) w
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_created from ins;

  update public.plan_versions set created_ids = v_created where id = v_id;
  return v_id;
end $$;

-- Applica una proposta di riprogrammazione confermata dall'atleta.
-- p_changes: [{op: 'sposta'|'modifica', id, patch: {date, sport, type, title, objective, durationMin, intensity, structure, technicalTips, safetyNotes}}
--             | {op: 'elimina', id}]
-- Tocca solo sedute dell'utente ancora da fare o saltate; conserva lo stato precedente per l'annullamento.
create or replace function public.apply_plan_changes(p_changes jsonb, p_reason text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev jsonb;
  v_ids uuid[];
  c jsonb;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 60 then
    raise exception 'Modifica non valida';
  end if;

  select array_agg((x->>'id')::uuid) into v_ids from jsonb_array_elements(p_changes) x;
  if (select count(*) from public.planned_workouts p
      where p.id = any(v_ids) and p.user_id = auth.uid() and p.status in ('programmato', 'saltato')) <> cardinality(v_ids) then
    raise exception 'Alcune sedute non esistono o sono già state registrate';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_prev
  from public.planned_workouts p where p.id = any(v_ids);

  update public.plan_versions set is_current = false where user_id = auth.uid() and is_current;
  insert into public.plan_versions (reason, from_date, workouts, previous, kind)
  values (left(coalesce(p_reason, ''), 300), current_date, p_changes, v_prev, 'modifica')
  returning id into v_id;

  for c in select * from jsonb_array_elements(p_changes) loop
    if c->>'op' = 'elimina' then
      delete from public.planned_workouts where id = (c->>'id')::uuid and user_id = auth.uid();
    elsif c->>'op' in ('sposta', 'modifica') then
      update public.planned_workouts set
        workout_date = (c->'patch'->>'date')::date,
        sport = c->'patch'->>'sport',
        workout_type = c->'patch'->>'type',
        title = left(c->'patch'->>'title', 120),
        objective = coalesce(c->'patch'->>'objective', ''),
        duration_min = (c->'patch'->>'durationMin')::integer,
        intensity = coalesce(c->'patch'->>'intensity', ''),
        structure = coalesce(c->'patch'->'structure', '{}'::jsonb),
        technical_tips = coalesce(array(select jsonb_array_elements_text(c->'patch'->'technicalTips')), '{}'),
        safety_notes = coalesce(array(select jsonb_array_elements_text(c->'patch'->'safetyNotes')), '{}'),
        status = 'programmato',
        skip_reason = null,
        skipped_at = null,
        plan_version_id = v_id
      where id = (c->>'id')::uuid and user_id = auth.uid();
    else
      raise exception 'Operazione sconosciuta';
    end if;
  end loop;

  return v_id;
end $$;

-- Annulla l'ultima versione: toglie le sedute che aveva creato e rimette quelle di prima.
-- Rifiuta se nel frattempo una di quelle sedute è stata registrata come fatta.
create or replace function public.undo_plan_version(p_version uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.plan_versions;
  v_new uuid;
  r jsonb;
  v_touched uuid[];
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  select * into v from public.plan_versions where id = p_version and user_id = auth.uid();
  if not found then
    raise exception 'Versione non trovata';
  end if;
  if v.undone_at is not null or v.kind = 'annullamento' then
    raise exception 'Versione già annullata';
  end if;
  if exists (select 1 from public.plan_versions where user_id = auth.uid() and created_at > v.created_at and undone_at is null and kind <> 'annullamento') then
    raise exception 'Si può annullare solo l''ultima modifica';
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_touched from jsonb_array_elements(v.previous) x;
  v_touched := v_touched || v.created_ids;
  if exists (select 1 from public.planned_workouts where id = any(v_touched) and status = 'completato') then
    raise exception 'Alcune sedute sono già state registrate come fatte';
  end if;

  delete from public.planned_workouts where id = any(v.created_ids) and user_id = auth.uid();

  for r in select * from jsonb_array_elements(v.previous) loop
    insert into public.planned_workouts
      (id, user_id, workout_date, sport, workout_type, title, objective, duration_min, distance_km, intensity,
       structure, technical_tips, safety_notes, status, skip_reason, skipped_at, plan_version_id, created_at)
    values (
      (r->>'id')::uuid, auth.uid(), (r->>'workout_date')::date, r->>'sport', r->>'workout_type', r->>'title',
      coalesce(r->>'objective', ''), (r->>'duration_min')::integer, nullif(r->>'distance_km', '')::numeric, coalesce(r->>'intensity', ''),
      coalesce(r->'structure', '{}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(r->'technical_tips')), '{}'),
      coalesce(array(select jsonb_array_elements_text(r->'safety_notes')), '{}'),
      r->>'status', r->>'skip_reason', nullif(r->>'skipped_at', '')::timestamptz,
      nullif(r->>'plan_version_id', '')::uuid, coalesce(nullif(r->>'created_at', '')::timestamptz, now())
    )
    on conflict (id) do update set
      workout_date = excluded.workout_date, sport = excluded.sport, workout_type = excluded.workout_type, title = excluded.title,
      objective = excluded.objective, duration_min = excluded.duration_min, distance_km = excluded.distance_km,
      intensity = excluded.intensity, structure = excluded.structure, technical_tips = excluded.technical_tips,
      safety_notes = excluded.safety_notes, status = excluded.status, skip_reason = excluded.skip_reason,
      skipped_at = excluded.skipped_at, plan_version_id = excluded.plan_version_id;
  end loop;

  update public.plan_versions set undone_at = now(), is_current = false where id = v.id;
  insert into public.plan_versions (reason, from_date, workouts, previous, kind, is_current)
  values (left('Annullata: ' || v.reason, 300), v.from_date, '[]'::jsonb, '[]'::jsonb, 'annullamento', true)
  returning id into v_new;
  return v_new;
end $$;

revoke all on function public.apply_plan_changes(jsonb, text) from public;
revoke all on function public.undo_plan_version(uuid) from public;
grant execute on function public.apply_plan_changes(jsonb, text) to authenticated;
grant execute on function public.undo_plan_version(uuid) to authenticated;
