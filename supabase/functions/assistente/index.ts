// Função segura do Assistente (Supabase Edge Function).
// A chave da IA fica nos "Secrets" do Supabase e nunca chega ao navegador.
// O Supabase confere o login (JWT) antes de chamar esta função; aqui só limitamos a quem é o dono do ateliê.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function usuarioDoToken(req: Request): string | null {
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const carga = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const dados = JSON.parse(atob(carga.padEnd(Math.ceil(carga.length / 4) * 4, '=')));
    return typeof dados.sub === 'string' ? dados.sub : null;
  } catch {
    return null;
  }
}

const VOZ = `Você é a assistente do atelier Craft Notes Unique, um ateliê de encadernação artesanal, papelaria personalizada e impressão 3D, em fase inicial de vendas.
Fale em português do Brasil, com tom delicado, acolhedor e direto, tratando a dona do ateliê por "você". Nada de tom corporativo.
Regras de trabalho:
- Responda usando SOMENTE os dados do resumo abaixo. Se faltar uma informação, diga o que falta e onde cadastrar no app, sem inventar números.
- Valores em reais já vêm prontos no resumo. Não refaça contas de custo ou preço por conta própria; use os valores do resumo e, se precisar somar, mostre a conta.
- Respostas curtas e fáceis de ler. Use lista só quando ajudar.
- Para legendas: voz da marca (delicada, feita à mão, "único", "com carinho"), no máximo 2 ou 3 emojis entre 🌸 📖 ✨ 💜 💙 🤍, sem caixa-alta, sem urgência agressiva, até 5 hashtags relevantes (#craftnotesunique #encadernacaoartesanal #papelariapersonalizada #cadernopersonalizado #impressao3d).
- Para preços: lembre que o preço sugerido já considera materiais, máquina, desperdício, multiplicador e taxa do canal, e que o trabalho manual é o lucro. Se multiplicador ou taxas estiverem "não definido", diga que ela precisa preenchê-los em Financeiro > Ajustes antes de fechar o preço.
- Você apenas aconselha. Não altera nada no app; quando algo precisar ser feito, diga em qual tela.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const dono = Deno.env.get('DONO_ID');
  if (dono && usuarioDoToken(req) !== dono) return json({ erro: 'Este assistente é só para a dona do ateliê.' }, 403);

  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) return json({ erro: 'A chave da IA ainda não foi cadastrada no Supabase (secret ANTHROPIC_API_KEY).' }, 500);

  let corpo: { mensagens?: { role: string; content: string }[]; contexto?: string };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'Pedido inválido.' }, 400);
  }

  const mensagens = (corpo.mensagens ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (mensagens.length === 0 || mensagens[0].role !== 'user' || mensagens[mensagens.length - 1].role !== 'user') {
    return json({ erro: 'Conversa inválida.' }, 400);
  }
  const contexto = String(corpo.contexto ?? '').slice(0, 30000);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('MODELO') ?? 'claude-sonnet-5-5',
      max_tokens: 1200,
      system: `${VOZ}\n\n=== RESUMO ATUAL DO ATELIÊ ===\n${contexto}`,
      messages: mensagens,
    }),
  });

  if (!resp.ok) {
    const detalhe = await resp.text();
    console.error('Anthropic', resp.status, detalhe.slice(0, 500));
    const msg = resp.status === 401 ? 'A chave da IA não foi aceita. Confira o secret ANTHROPIC_API_KEY.'
      : resp.status === 400 && /credit/i.test(detalhe) ? 'Faltam créditos na conta da Anthropic.'
      : resp.status === 429 ? 'Muitas perguntas seguidas. Espere um pouquinho e tente de novo.'
      : 'A IA não conseguiu responder agora. Tente de novo em instantes.';
    return json({ erro: msg }, 502);
  }
  const dados = await resp.json();
  const texto = (dados.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim();
  return json({ texto: texto || 'Não consegui montar uma resposta. Pode perguntar de outro jeito?' });
});
