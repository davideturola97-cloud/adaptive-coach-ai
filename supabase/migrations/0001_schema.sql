-- Adaptive Coach AI — schema iniziale (Milestone 2)
-- Da incollare una volta sola in Supabase: SQL Editor > New query > Run.
-- Ogni tabella con dati personali ha Row Level Security: ogni utente vede e modifica solo le proprie righe.

-- Sport supportati. Per aggiungere nuoto o palestra basta inserire una riga qui.
create table if not exists public.sports (
  key text primary key,
  label text not null
);
insert into public.sports (key, label) values ('run', 'Corsa'), ('bike', 'Ciclismo')
on conflict (key) do nothing;

-- Profilo atleta: una riga per utente, creata alla registrazione.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  birth_date date check (birth_date between '1900-01-01' and current_date),
  sex text check (sex in ('M', 'F', 'altro')),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 300),
  weekly_hours_available numeric(4, 1) check (weekly_hours_available between 0 and 40),
  available_days text[] not null default '{}',
  max_session_min integer check (max_session_min between 10 and 600),
  equipment text[] not null default '{}',
  limitations text[] not null default '{}',
  goal_primary text not null default '' check (char_length(goal_primary) <= 200),
  goals_secondary text[] not null default '{}',
  ftp_w integer check (ftp_w between 50 and 600),
  ftp_origin text check (ftp_origin in ('misurato', 'stimato', 'dichiarato')),
  ftp_date date,
  threshold_pace_sec integer check (threshold_pace_sec between 150 and 900),
  threshold_origin text check (threshold_origin in ('misurato', 'stimato', 'dichiarato')),
  threshold_date date,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_sports (
  user_id uuid not null references auth.users (id) on delete cascade,
  sport text not null references public.sports (key),
  level text not null check (level in ('principiante', 'intermedio', 'avanzato')),
  years_experience numeric(4, 1) not null default 0 check (years_experience between 0 and 80),
  weekly_volume text not null default '' check (char_length(weekly_volume) <= 200),
  primary key (user_id, sport)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  event_date date not null,
  sport text not null references public.sports (key),
  distance_km numeric(6, 2) check (distance_km > 0),
  priority text not null default 'A' check (priority in ('A', 'B', 'C')),
  created_at timestamptz not null default now()
);

create table if not exists public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_date date not null,
  sport text not null references public.sports (key),
  workout_type text not null,
  title text not null check (char_length(title) <= 120),
  objective text not null default '',
  duration_min integer not null check (duration_min between 1 and 720),
  distance_km numeric(6, 2),
  intensity text not null default '',
  structure jsonb not null default '{}'::jsonb,
  technical_tips text[] not null default '{}',
  safety_notes text[] not null default '{}',
  status text not null default 'programmato' check (status in ('programmato', 'completato', 'saltato', 'modificato')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  planned_workout_id uuid references public.planned_workouts (id) on delete set null,
  activity_date date not null,
  started_at timestamptz,
  sport text not null references public.sports (key),
  title text not null default '' check (char_length(title) <= 120),
  duration_min numeric(6, 1) not null check (duration_min > 0 and duration_min <= 1440),
  distance_km numeric(7, 2) check (distance_km >= 0),
  avg_hr integer check (avg_hr between 30 and 230),
  avg_power_w integer check (avg_power_w between 0 and 2000),
  elevation_m integer check (elevation_m between 0 and 10000),
  source text not null check (source in ('manuale', 'screenshot', 'file')),
  -- Impronta per riconoscere i duplicati (sport + inizio + durata arrotondata), calcolata dall'app.
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.feedback (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rpe integer not null check (rpe between 1 and 10),
  muscle_fatigue integer not null check (muscle_fatigue between 1 and 5),
  cardio_fatigue integer not null check (cardio_fatigue between 1 and 5),
  sleep_quality integer check (sleep_quality between 1 and 5),
  feeling text not null check (feeling in ('ottimo', 'buono', 'normale', 'stanco', 'pessimo')),
  pain text check (char_length(pain) <= 500),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  test_date date not null,
  sport text not null references public.sports (key),
  kind text not null check (kind in ('5km', 'cooper', 'ftp20', 'ramp', 'dichiarato')),
  raw_value jsonb not null,
  derived jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists planned_workouts_user_date on public.planned_workouts (user_id, workout_date);
create index if not exists activities_user_date on public.activities (user_id, activity_date);
create index if not exists events_user_date on public.events (user_id, event_date);
create index if not exists test_results_user_date on public.test_results (user_id, test_date);

-- updated_at automatico
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists planned_workouts_touch on public.planned_workouts;
create trigger planned_workouts_touch before update on public.planned_workouts for each row execute function public.touch_updated_at();

-- Profilo vuoto creato alla registrazione
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Cancellazione dell'account: elimina l'utente, e a cascata tutti i suoi dati.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Row Level Security
alter table public.sports enable row level security;
alter table public.profiles enable row level security;
alter table public.athlete_sports enable row level security;
alter table public.events enable row level security;
alter table public.planned_workouts enable row level security;
alter table public.activities enable row level security;
alter table public.feedback enable row level security;
alter table public.test_results enable row level security;

drop policy if exists "sport leggibili" on public.sports;
create policy "sport leggibili" on public.sports for select to authenticated using (true);

-- Il profilo nasce dal trigger e sparisce con l'account: l'utente lo legge e lo modifica, non lo crea né lo cancella.
drop policy if exists "proprio profilo: lettura" on public.profiles;
create policy "proprio profilo: lettura" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "proprio profilo: modifica" on public.profiles;
create policy "proprio profilo: modifica" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['athlete_sports', 'events', 'planned_workouts', 'activities', 'feedback', 'test_results'] loop
    execute format('drop policy if exists "proprie righe" on public.%I', t);
    execute format(
      'create policy "proprie righe" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- Un feedback può riferirsi solo a un'attività dello stesso utente.
create or replace function public.feedback_same_owner() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.activities a where a.id = new.activity_id and a.user_id = new.user_id) then
    raise exception 'Attività non trovata';
  end if;
  return new;
end $$;
drop trigger if exists feedback_owner on public.feedback;
create trigger feedback_owner before insert or update on public.feedback for each row execute function public.feedback_same_owner();

-- Un'attività può collegarsi solo a una seduta dello stesso utente.
create or replace function public.activity_plan_same_owner() returns trigger language plpgsql as $$
begin
  if new.planned_workout_id is not null and not exists (
    select 1 from public.planned_workouts p where p.id = new.planned_workout_id and p.user_id = new.user_id
  ) then
    raise exception 'Seduta non trovata';
  end if;
  return new;
end $$;
drop trigger if exists activity_plan_owner on public.activities;
create trigger activity_plan_owner before insert or update on public.activities for each row execute function public.activity_plan_same_owner();

-- Permessi: gli utenti anonimi non toccano nulla.
revoke all on all tables in schema public from anon;
grant select on public.sports to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.athlete_sports, public.events, public.planned_workouts,
  public.activities, public.feedback, public.test_results to authenticated;
