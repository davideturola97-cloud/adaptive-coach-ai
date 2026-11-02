-- 0008: limite ai tentativi di accesso.
-- L'app chiama Supabase dal server, quindi i limiti di Supabase vedono l'indirizzo del server e non quello di chi prova ad accedere.
-- Qui si contano i tentativi falliti per (indirizzo IP + email) e per indirizzo IP, salvati solo come impronte SHA-256:
-- nessuna email e nessun IP in chiaro. La tabella non è leggibile né scrivibile direttamente da nessuno.

create table if not exists public.auth_attempts (
  key text not null check (key ~ '^[0-9a-f]{64}$'),
  at timestamptz not null default now()
);
create index if not exists auth_attempts_key_at on public.auth_attempts (key, at);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;

-- Quanti tentativi falliti per ciascuna impronta negli ultimi p_window_sec secondi (al massimo 1 ora).
create or replace function public.auth_attempts_count(p_keys text[], p_window_sec integer)
returns integer[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  result integer[] := '{}';
begin
  if p_keys is null or array_length(p_keys, 1) is null or array_length(p_keys, 1) > 2 then
    raise exception 'Chiavi non valide';
  end if;
  foreach k in array p_keys loop
    if k !~ '^[0-9a-f]{64}$' then raise exception 'Chiave non valida'; end if;
    result := result || (
      select count(*)::integer from public.auth_attempts a
      where a.key = k and a.at > now() - make_interval(secs => least(greatest(p_window_sec, 1), 3600))
    );
  end loop;
  return result;
end $$;

-- Registra un tentativo fallito e cancella quelli più vecchi di un giorno.
create or replace function public.auth_attempts_record(p_keys text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare k text;
begin
  if p_keys is null or array_length(p_keys, 1) is null or array_length(p_keys, 1) > 2 then
    raise exception 'Chiavi non valide';
  end if;
  foreach k in array p_keys loop
    if k !~ '^[0-9a-f]{64}$' then raise exception 'Chiave non valida'; end if;
    insert into public.auth_attempts (key) values (k);
  end loop;
  delete from public.auth_attempts where at < now() - interval '1 day';
end $$;

revoke all on function public.auth_attempts_count(text[], integer) from public;
revoke all on function public.auth_attempts_record(text[]) from public;
grant execute on function public.auth_attempts_count(text[], integer) to anon, authenticated;
grant execute on function public.auth_attempts_record(text[]) to anon, authenticated;
