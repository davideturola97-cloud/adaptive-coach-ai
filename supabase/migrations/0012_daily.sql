-- Adaptive Coach AI — controllo del mattino e revisione settimanale.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

-- 1. Controllo del mattino: uno al giorno per utente.
create table if not exists public.daily_checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checkin_date date not null,
  sleep integer not null check (sleep between 1 and 5),      -- 1 malissimo ... 5 benissimo
  fatigue integer not null check (fatigue between 1 and 5),  -- 1 fresco ... 5 distrutto
  pain text not null default 'nessuno' check (pain in ('nessuno', 'leggero', 'forte')),
  pain_where text check (char_length(pain_where) <= 100),
  created_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);
alter table public.daily_checkins enable row level security;
drop policy if exists "proprie righe" on public.daily_checkins;
create policy "proprie righe" on public.daily_checkins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.daily_checkins to authenticated;

-- 2. Ultima settimana rivista dal coach (lunedì della settimana a cui si riferisce la revisione).
alter table public.profiles add column if not exists plan_reviewed_week date;
