-- Rodar UMA vez no Supabase: SQL Editor > New query > colar tudo > Run.
-- Não precisa trocar nada neste arquivo (não tem e-mail aqui). Cada pessoa logada só enxerga os próprios registros.

create table if not exists public.registros (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tabela        text not null,
  id            text not null,
  dados         jsonb not null,
  atualizado_em timestamptz not null default now(),
  recebido_em   timestamptz not null default now(),
  primary key (user_id, tabela, id)
);

create index if not exists registros_recebido_idx on public.registros (user_id, recebido_em);

-- marca a hora em que o servidor recebeu cada registro (é por ela que cada aparelho sabe o que é novo)
create or replace function public.registros_recebido() returns trigger
language plpgsql as $$
begin
  new.recebido_em = now();
  return new;
end;
$$;

drop trigger if exists registros_recebido_t on public.registros;
create trigger registros_recebido_t
  before insert or update on public.registros
  for each row execute function public.registros_recebido();

alter table public.registros enable row level security;

drop policy if exists "cada um ve e grava os seus" on public.registros;
create policy "cada um ve e grava os seus" on public.registros
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
