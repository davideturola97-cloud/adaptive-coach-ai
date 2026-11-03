-- Adaptive Coach AI — scheda di palestra a giorni fissi, inserita dall'atleta.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.
-- Formato: [{"day": "Lun", "groups": ["petto", "tricipiti"], "durationMin": 60}, ...] (al massimo un elemento per giorno).
alter table public.profiles
  add column if not exists gym_schedule jsonb not null default '[]'::jsonb
  check (jsonb_typeof(gym_schedule) = 'array' and jsonb_array_length(gym_schedule) <= 7);
