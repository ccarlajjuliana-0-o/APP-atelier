-- Rodar UMA vez no Supabase: SQL Editor > New query > colar tudo > Run.
-- Cria o formulário público (qualquer pessoa LÊ, só você grava) e a caixa de solicitações (só você lê; quem grava é a função orcamento-publico).

-- 1) O formulário que a cliente vê (uma cópia sem custos nem materiais, publicada pelo app)
create table if not exists public.formulario_publico (
  id           text primary key default 'atual',
  dono         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ativo        boolean not null default true,
  dados        jsonb not null,
  publicado_em timestamptz not null default now()
);

alter table public.formulario_publico enable row level security;

drop policy if exists "qualquer pessoa le o formulario ativo" on public.formulario_publico;
create policy "qualquer pessoa le o formulario ativo" on public.formulario_publico
  for select to anon, authenticated
  using (ativo = true or dono = auth.uid());

drop policy if exists "a dona publica" on public.formulario_publico;
create policy "a dona publica" on public.formulario_publico
  for insert to authenticated
  with check (dono = auth.uid());

drop policy if exists "a dona atualiza" on public.formulario_publico;
create policy "a dona atualiza" on public.formulario_publico
  for update to authenticated
  using (dono = auth.uid())
  with check (dono = auth.uid());

drop policy if exists "a dona apaga" on public.formulario_publico;
create policy "a dona apaga" on public.formulario_publico
  for delete to authenticated
  using (dono = auth.uid());

-- 2) A caixa de solicitações recebidas
create table if not exists public.solicitacoes (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null references auth.users(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  nome        text not null,
  contato     text not null,
  dados       jsonb not null,
  origem_hash text,
  importada   boolean not null default false
);

create index if not exists solicitacoes_dono_idx on public.solicitacoes (dono, criado_em desc);
create index if not exists solicitacoes_origem_idx on public.solicitacoes (origem_hash, criado_em);

alter table public.solicitacoes enable row level security;

-- Não existe política de INSERT de propósito: ninguém de fora consegue gravar direto na tabela.
-- Só a função orcamento-publico (que usa a chave de serviço e confere tudo) grava.
drop policy if exists "a dona ve" on public.solicitacoes;
create policy "a dona ve" on public.solicitacoes
  for select to authenticated
  using (dono = auth.uid());

drop policy if exists "a dona atualiza" on public.solicitacoes;
create policy "a dona atualiza" on public.solicitacoes
  for update to authenticated
  using (dono = auth.uid())
  with check (dono = auth.uid());

drop policy if exists "a dona apaga" on public.solicitacoes;
create policy "a dona apaga" on public.solicitacoes
  for delete to authenticated
  using (dono = auth.uid());
