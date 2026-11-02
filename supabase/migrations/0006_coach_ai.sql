-- Adaptive Coach AI — Milestone 7: chat con il coach AI e controllo dei costi.
-- Da incollare in Supabase: SQL Editor > New query > Run. Si può rieseguire senza danni.

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  -- Proposte di riprogrammazione mostrate con questo messaggio (imprevisto + proposte calcolate dal motore).
  proposals jsonb,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_conv on public.coach_messages (conversation_id, created_at);

-- Un messaggio può stare solo in una conversazione dello stesso utente.
create or replace function public.coach_message_owner() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.coach_conversations c where c.id = new.conversation_id and c.user_id = new.user_id) then
    raise exception 'Conversazione non trovata';
  end if;
  return new;
end $$;
drop trigger if exists coach_message_owner on public.coach_messages;
create trigger coach_message_owner before insert or update on public.coach_messages for each row execute function public.coach_message_owner();

-- Uso dell'AI per giorno. Gli utenti lo leggono ma non lo scrivono: lo aggiorna solo la funzione qui sotto,
-- che può solo aumentare i contatori (nessuno può azzerarsi il limite).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0 check (requests >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  images integer not null default 0 check (images >= 0),
  primary key (user_id, day)
);

create or replace function public.ai_usage_add(p_input integer, p_output integer, p_images integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  insert into public.ai_usage (user_id, day, requests, input_tokens, output_tokens, images)
  values (auth.uid(), current_date, 1, greatest(p_input, 0), greatest(p_output, 0), greatest(p_images, 0))
  on conflict (user_id, day) do update set
    requests = public.ai_usage.requests + 1,
    input_tokens = public.ai_usage.input_tokens + greatest(p_input, 0),
    output_tokens = public.ai_usage.output_tokens + greatest(p_output, 0),
    images = public.ai_usage.images + greatest(p_images, 0);
end $$;

alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.ai_usage enable row level security;

do $$
declare t text;
begin
  foreach t in array array['coach_conversations', 'coach_messages'] loop
    execute format('drop policy if exists "proprie righe" on public.%I', t);
    execute format(
      'create policy "proprie righe" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

drop policy if exists "proprio uso: lettura" on public.ai_usage;
create policy "proprio uso: lettura" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.coach_conversations, public.coach_messages, public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;
grant select, insert, update, delete on public.coach_conversations, public.coach_messages to authenticated;
grant select on public.ai_usage to authenticated;

revoke all on function public.ai_usage_add(integer, integer, integer) from public;
grant execute on function public.ai_usage_add(integer, integer, integer) to authenticated;
