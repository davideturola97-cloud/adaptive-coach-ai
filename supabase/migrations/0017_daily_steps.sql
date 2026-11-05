-- Adaptive Coach AI — passi medi al giorno (senza la corsa), per il fabbisogno calorico.
-- Si applica da sola con l'aggiornamento automatico. Si può rieseguire.
alter table public.profiles add column if not exists daily_steps integer check (daily_steps is null or daily_steps between 0 and 40000);
