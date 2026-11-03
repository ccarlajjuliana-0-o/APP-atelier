# Mostruário no app do ateliê: importar o pacote do Estúdio de Miolos

O Estúdio de Miolos gera um arquivo `mostruario-craft-notes-unique.json` (aba **App → Baixar pacote para o app**).
O app lê esse arquivo e grava cada modelo e adesivo no Supabase. A partir daí, o formulário do cliente mostra as prévias para ele ver e escolher.

A ponte é um arquivo, e não uma conexão direta, porque o estúdio roda dentro do claude.ai. Lá, a página não pode falar com outros sites, então nenhuma senha ou chave do Supabase fica exposta no estúdio.

## 1. Formato do pacote

```json
{
  "formato": "craft-notes-unique/mostruario",
  "versao": 1,
  "geradoEm": "2026-11-03T17:20:00.000Z",
  "modelos": [
    {
      "id": "l8k2m1x...",
      "nome": "Semanal em blocos",
      "categoria": "Agenda / planner",
      "descricao": "Semana em blocos com espaço para notas",
      "ordem": 0,
      "tamanhos": ["A5", "A6"],
      "tamanhoBase": { "nome": "A5", "largura_mm": 148, "altura_mm": 210 },
      "preview": "data:image/jpeg;base64,...",
      "atualizadoEm": "2026-11-03T17:10:00.000Z"
    }
  ],
  "adesivos": [
    {
      "id": "l9p...",
      "nome": "Flor de cerejeira",
      "categoria": "Adesivos",
      "descricao": "",
      "ordem": 0,
      "preview": "data:image/png;base64,...",
      "atualizadoEm": "2026-11-03T17:12:00.000Z"
    }
  ]
}
```

O `id` é fixo. Se o mesmo modelo for importado de novo, ele é atualizado em vez de duplicado.

## 2. Tabela e armazenamento no Supabase (rodar uma vez no SQL Editor)

```sql
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

-- só você (logada) grava
create policy "dona grava" on mostruario_itens
  for all to authenticated using (true) with check (true);

-- o formulário do cliente lê apenas o que está visível
create policy "cliente vê o mostruário" on mostruario_itens
  for select to anon using (visivel);

-- bucket público para as prévias
insert into storage.buckets (id, name, public)
values ('mostruario', 'mostruario', true)
on conflict (id) do nothing;

create policy "dona envia prévias" on storage.objects
  for all to authenticated
  using (bucket_id = 'mostruario') with check (bucket_id = 'mostruario');
```

Se o formulário do cliente também exigir login, troque `to anon` por `to authenticated` na segunda política.
Hoje, a política "dona grava" vale para qualquer usuário logado. Isso funciona porque só você usa o app. Quando houver outros usuários, restrinja ao seu `auth.uid()`.

## 3. Função de importação (tela Mostruário → Importar pacote)

```js
// supabase = cliente já criado no app (createClient do @supabase/supabase-js v2)
async function importarMostruario(arquivo) {
  const pacote = JSON.parse(await arquivo.text());
  if (pacote.formato !== 'craft-notes-unique/mostruario') {
    throw new Error('Este arquivo não é um pacote do Estúdio de Miolos.');
  }

  const itens = [
    ...pacote.modelos.map(m => ({ ...m, tipo: 'modelo' })),
    ...pacote.adesivos.map(a => ({ ...a, tipo: 'adesivo' })),
  ];

  for (const it of itens) {
    const blob = await (await fetch(it.preview)).blob();       // data URL → arquivo
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const path = `${it.tipo}/${it.id}.${ext}`;

    const up = await supabase.storage.from('mostruario')
      .upload(path, blob, { upsert: true, contentType: blob.type });
    if (up.error) throw up.error;

    const { error } = await supabase.from('mostruario_itens').upsert({
      id: it.id,
      tipo: it.tipo,
      nome: it.nome,
      categoria: it.categoria,
      descricao: it.descricao,
      tamanhos: it.tamanhos || [],
      tamanho_base: it.tamanhoBase || null,
      ordem: it.ordem || 0,
      preview_path: path,
      visivel: true,
      atualizado_em: it.atualizadoEm,
    });
    if (error) throw error;
  }

  // o que saiu do mostruário no estúdio fica oculto no app (não é apagado)
  const ids = itens.map(i => i.id);
  await supabase.from('mostruario_itens')
    .update({ visivel: false })
    .not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`);

  return itens.length;
}
```

## 4. Como o formulário do cliente usa os dados

```js
// modelos de página para o tamanho que o cliente escolheu
const { data: modelos } = await supabase
  .from('mostruario_itens')
  .select('*')
  .eq('tipo', 'modelo')
  .eq('visivel', true)
  .contains('tamanhos', [tamanhoEscolhido])   // ex.: 'A5'
  .order('ordem');

const urlPrevia = it =>
  supabase.storage.from('mostruario').getPublicUrl(it.preview_path).data.publicUrl;
```

- **Itens sem estoque:** para seguir a regra de que esses itens não aparecem como opção, cruze `tamanhos` com o estoque de papel antes de mostrar a lista.
- **Pedido:** guarde no pedido o `id` do modelo e do adesivo escolhidos. Assim, a ficha de produção sabe exatamente qual página imprimir.
