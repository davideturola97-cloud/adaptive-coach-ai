-- Adaptive Coach AI — obiettivo di tempo scelto dall'atleta per una gara (in secondi).
-- Si applica da sola con l'aggiornamento automatico. Si può rieseguire.
alter table public.events add column if not exists goal_time_sec integer check (goal_time_sec is null or goal_time_sec between 600 and 86400);
