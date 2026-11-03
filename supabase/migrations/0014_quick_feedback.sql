-- Adaptive Coach AI — feedback in un tocco: basta lo sforzo percepito (RPE), il resto è facoltativo.
-- Si applica da sola con l'aggiornamento automatico; si può anche incollare in Supabase > SQL Editor. Si può rieseguire.
alter table public.feedback alter column muscle_fatigue drop not null;
alter table public.feedback alter column cardio_fatigue drop not null;
alter table public.feedback alter column feeling drop not null;
