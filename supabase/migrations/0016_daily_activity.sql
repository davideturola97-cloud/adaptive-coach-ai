-- Adaptive Coach AI — attività quotidiana fuori dall'allenamento (per il fabbisogno calorico).
-- Si applica da sola con l'aggiornamento automatico. Si può rieseguire.
alter table public.profiles add column if not exists daily_activity text check (daily_activity is null or daily_activity in ('sedentario', 'in piedi', 'fisico'));
