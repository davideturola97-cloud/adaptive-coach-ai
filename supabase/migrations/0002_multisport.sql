-- Adaptive Coach AI — Milestone 3: nuoto, palestra, triathlon, test e controlli di sicurezza.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

-- Nuovi sport
insert into public.sports (key, label) values ('swim', 'Nuoto'), ('gym', 'Palestra')
on conflict (key) do nothing;

-- Profilo: dettagli nuoto, soglia in acqua, consenso ai test massimali
alter table public.profiles
  add column if not exists swim_pool_m integer check (swim_pool_m in (25, 50)),
  add column if not exists swim_open_water boolean not null default false,
  add column if not exists swim_wetsuit boolean not null default false,
  add column if not exists swim_strokes text[] not null default '{}',
  add column if not exists css_pace_sec integer check (css_pace_sec between 50 and 400),
  add column if not exists css_origin text check (css_origin in ('misurato', 'stimato', 'dichiarato')),
  add column if not exists css_date date;

-- Gare: singolo sport o triathlon con le tre frazioni. La data può essere provvisoria.
alter table public.events
  add column if not exists kind text not null default 'singolo' check (kind in ('singolo', 'triathlon')),
  add column if not exists date_tentative boolean not null default false,
  add column if not exists tri_format text check (tri_format in ('sprint', 'olimpico', 'medio', 'lungo', 'personalizzato')),
  add column if not exists swim_km numeric(5, 2) check (swim_km > 0 and swim_km <= 20),
  add column if not exists bike_km numeric(6, 1) check (bike_km > 0 and bike_km <= 1000),
  add column if not exists run_km numeric(5, 1) check (run_km > 0 and run_km <= 200);
alter table public.events alter column sport drop not null;

alter table public.events drop constraint if exists events_kind_shape;
alter table public.events add constraint events_kind_shape check (
  (kind = 'singolo' and sport is not null)
  or (kind = 'triathlon' and sport is null and swim_km is not null and bike_km is not null and run_km is not null)
);

-- Tipi di test
alter table public.test_results drop constraint if exists test_results_kind_check;
alter table public.test_results add constraint test_results_kind_check
  check (kind in ('5km', 'cooper', 'recente_corsa', 'ftp20', 'ramp', 'ftp_nota', 'css', 'recente_nuoto', 'dichiarato'));

-- Test proposti dal coach, con il loro stato. Rimandare non blocca nulla: l'app usa gli ultimi parametri affidabili.
create table if not exists public.planned_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sport text not null references public.sports (key),
  kind text not null check (kind in ('5km', 'cooper', 'recente_corsa', 'ftp20', 'ramp', 'ftp_nota', 'css', 'recente_nuoto')),
  status text not null default 'proposto' check (status in ('proposto', 'programmato', 'rimandato', 'rifiutato', 'completato')),
  due_date date,
  reason text not null default '' check (char_length(reason) <= 300),
  test_result_id uuid references public.test_results (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists planned_tests_one_open_per_sport
  on public.planned_tests (user_id, sport) where status in ('proposto', 'programmato', 'rimandato');

drop trigger if exists planned_tests_touch on public.planned_tests;
create trigger planned_tests_touch before update on public.planned_tests for each row execute function public.touch_updated_at();

-- Controllo prima dei test massimali (domande tipo PAR-Q). Non è una valutazione medica.
create table if not exists public.readiness_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers jsonb not null,
  flagged boolean not null,
  doctor_cleared boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.planned_tests enable row level security;
alter table public.readiness_checks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['planned_tests', 'readiness_checks'] loop
    execute format('drop policy if exists "proprie righe" on public.%I', t);
    execute format(
      'create policy "proprie righe" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

revoke all on public.planned_tests, public.readiness_checks from anon;
grant select, insert, update, delete on public.planned_tests, public.readiness_checks to authenticated;
