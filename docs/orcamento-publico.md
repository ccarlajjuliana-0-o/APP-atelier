# Link público e QR code do orçamento

A cliente abre `https://SEU-USUARIO.github.io/APP-atelier/#/pedido` (ou aponta a câmera para o QR), preenche as perguntas do seu formulário e o pedido chega no app, em Orçamentos > "Solicitações recebidas".

## Preparar uma vez
1. Supabase > SQL Editor > cole `docs/orcamento-publico.sql` > Run.
2. No terminal do Codespaces: `supabase functions deploy orcamento-publico --no-verify-jwt`
   (a função usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, que o Supabase já fornece sozinho).
3. No app: Orçamentos > "Link público e QR code" > "Publicar formulário".

## Como funciona
- O que a cliente vê é uma **cópia** do formulário (sem materiais, quantidades ou custos): só as opções com estoque e o preço de cada uma. Republique quando mudar perguntas, extras, preços ou estoque.
- Ninguém de fora grava direto no banco: o envio passa pela função `orcamento-publico`, que confere tudo e guarda na caixa de solicitações.
- Ao clicar em "Virar orçamento", o app recalcula preços e estoque com os dados de agora e ignora qualquer resposta que não exista no seu formulário.

## Proteções contra spam
- Campo escondido que só robôs preenchem.
- Tempo mínimo de 5 segundos entre abrir a página e enviar.
- No máximo 5 envios por hora por origem (guardada só como código embaralhado) e 80 por dia no total.
- Limite de tamanho e conferência de cada campo.
- Dá para "Pausar link" a qualquer momento; opcionalmente defina o secret `SAL_ORIGEM` no Supabase (qualquer texto) para embaralhar melhor a origem.
