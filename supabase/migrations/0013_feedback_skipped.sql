-- Adaptive Coach AI — attività per cui l'atleta non ricorda lo sforzo: l'app non chiede più l'RPE.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.
alter table public.activities add column if not exists feedback_skipped boolean not null default false;
