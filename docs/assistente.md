# Assistente: como ligar

O assistente conversa com uma IA (Claude, da Anthropic). A chave da IA fica guardada no Supabase e nunca vai para o navegador.
São 3 etapas, feitas uma única vez.

## 1. Chave da IA (Anthropic)
1. Entre em https://console.anthropic.com e crie uma conta.
2. Em **Billing**, adicione um valor pequeno de crédito (algumas dezenas de reais já rendem muitas conversas) e, se houver a opção, defina um **limite mensal de gasto**.
3. Em **API keys**, crie uma chave e copie (ela só aparece uma vez).

## 2. Publicar a função no Supabase
1. No painel do Supabase do projeto: **Edge Functions** > **Deploy a new function** > **Via Editor**.
2. Nome da função: `assistente` (exatamente assim, sem acento).
3. Apague o código de exemplo e cole todo o conteúdo do arquivo `supabase/functions/assistente/index.ts`.
4. Clique em **Deploy**. Deixe ligada a opção de verificar o login (JWT), que já vem ligada por padrão.

## 3. Guardar a chave e travar o uso só para você
Em **Edge Functions** > **Secrets**, adicione:
- `ANTHROPIC_API_KEY` = a chave copiada na etapa 1.
- `DONO_ID` = o seu "User UID" (em **Authentication** > **Users**, na linha do seu usuário). Assim, mesmo que alguém crie conta no seu app, só você usa o assistente.

Pronto: abra o app, entre em **Assistente** e faça uma pergunta.

## Cuidados
- Para responder, o app envia à IA um resumo do ateliê (materiais, produtos, pedidos em aberto, caixa do mês). Telefone, e-mail e sobrenome dos clientes não são enviados.
- O assistente só aconselha; ele não altera nada no app.
- Nunca coloque a chave da IA no GitHub nem no código do app.
