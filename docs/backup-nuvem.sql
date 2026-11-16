-- Rodar UMA vez no Supabase: SQL Editor > New query > colar tudo > Run.
-- Cria o espaço privado "backups" para as cópias automáticas do app.
-- Cada pessoa logada só enxerga e grava dentro da própria pasta (o nome da pasta é o seu ID de usuário).
-- Não precisa trocar nada neste arquivo.

insert into storage.buckets (id, name, public, file_size_limit)
values ('backups', 'backups', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "backups: ler as proprias" on storage.objects;
drop policy if exists "backups: gravar nas proprias" on storage.objects;
drop policy if exists "backups: apagar as proprias" on storage.objects;

create policy "backups: ler as proprias" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backups: gravar nas proprias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backups: apagar as proprias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);
