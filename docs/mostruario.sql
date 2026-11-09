-- Rodar UMA vez no Supabase: SQL Editor > New query > colar tudo > Run.
-- Antes, troque SEU_EMAIL_GITHUB pelo e-mail da conta GitHub que você usa para entrar no app (o e-mail principal e verificado).
-- Importante: sem essa trava, qualquer pessoa com uma conta GitHub que entrasse no app poderia gravar.

create table if not exists mostruario_itens (
  id            text primary key,
  tipo          text not null check (tipo in ('modelo','adesivo')),
  nome          text not null,
  categoria     text,
  descricao     text default '',
  tamanhos      text[] default '{}',
  tamanho_base  jsonb,
  ordem         int default 0,
  preview_path  text,
  visivel       boolean default true,
  atualizado_em timestamptz default now()
);

alter table mostruario_itens enable row level security;

create policy "dona grava" on mostruario_itens
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'SEU_EMAIL_GITHUB')
  with check ((auth.jwt() ->> 'email') = 'SEU_EMAIL_GITHUB');

create policy "cliente ve o mostruario" on mostruario_itens
  for select to anon using (visivel);

insert into storage.buckets (id, name, public)
values ('mostruario', 'mostruario', true)
on conflict (id) do nothing;

create policy "dona envia previas" on storage.objects
  for all to authenticated
  using (bucket_id = 'mostruario' and (auth.jwt() ->> 'email') = 'SEU_EMAIL_GITHUB')
  with check (bucket_id = 'mostruario' and (auth.jwt() ->> 'email') = 'SEU_EMAIL_GITHUB');
