// Recebe o formulário que a cliente preenche no link público e guarda na caixa de solicitações.
// Deploy SEM exigir login (a cliente não tem conta):  supabase functions deploy orcamento-publico --no-verify-jwt
// Proteções: campo escondido (robôs), tempo mínimo de preenchimento, limite por origem (5 por hora), limite diário geral,
// tamanho máximo e conferência de cada campo. A dona revisa tudo antes de virar orçamento, e os preços são recalculados no app dela.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const POR_HORA = 5;
const POR_DIA = 80;
const SEGUNDOS_MINIMOS = 5;

const texto = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function hash(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(`${Deno.env.get('SAL_ORIGEM') ?? 'craft-notes'}|${valor}`);
  const h = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Método não permitido.' }, 405);

  const bruto = await req.text();
  if (bruto.length > 40000) return json({ erro: 'O pedido ficou grande demais.' }, 413);
  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return json({ erro: 'Pedido inválido.' }, 400);
  }

  // robô: o campo escondido veio preenchido. Responde "ok" para não dar pista.
  if (texto(corpo.site, 100) !== '') return json({ ok: true });

  const abertoEm = Number(corpo.abertoEm);
  if (!Number.isFinite(abertoEm) || Date.now() - abertoEm < SEGUNDOS_MINIMOS * 1000) {
    return json({ erro: 'Foi muito rápido! Confira as respostas e envie de novo em alguns segundos.' }, 429);
  }

  const nome = texto(corpo.nome, 120);
  const contato = texto(corpo.contato, 160);
  const observacao = texto(corpo.observacao, 1000);
  const quantidade = Math.round(Number(corpo.quantidade));
  if (!nome || !contato) return json({ erro: 'Preencha o seu nome e um contato (WhatsApp ou e-mail).' }, 400);
  if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 50) return json({ erro: 'A quantidade precisa ser de 1 a 50.' }, 400);
  if (!Array.isArray(corpo.escolhas) || corpo.escolhas.length > 150) return json({ erro: 'As respostas não parecem certas.' }, 400);

  const escolhas = (corpo.escolhas as Record<string, unknown>[]).map((e) => ({
    grupoId: texto(e?.grupoId, 80),
    opcaoId: texto(e?.opcaoId, 80),
    opcaoNome: texto(e?.opcaoNome, 500),
    ...(texto(e?.texto, 300) ? { texto: texto(e?.texto, 300) } : {}),
    ...(texto(e?.materialId, 80) ? { materialId: texto(e?.materialId, 80) } : {}),
    ...(e?.outro === true ? { outro: true } : {}),
  })).filter((e) => e.grupoId && e.opcaoId);

  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) return json({ erro: 'A função ainda não está configurada.' }, 500);
  const banco = createClient(url, chave, { auth: { persistSession: false } });

  const { data: form } = await banco.from('formulario_publico').select('dono, ativo').eq('id', 'atual').maybeSingle();
  if (!form || !form.ativo) return json({ erro: 'Este formulário não está recebendo pedidos agora.' }, 410);

  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'desconhecido').split(',')[0].trim();
  const origem = await hash(ip);
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const umDia = new Date(Date.now() - 86400_000).toISOString();

  const { count: daOrigem } = await banco.from('solicitacoes').select('id', { count: 'exact', head: true }).eq('origem_hash', origem).gte('criado_em', umaHora);
  if ((daOrigem ?? 0) >= POR_HORA) return json({ erro: 'Já recebi alguns pedidos seus agora há pouco. Tente de novo mais tarde, com carinho.' }, 429);
  const { count: doDia } = await banco.from('solicitacoes').select('id', { count: 'exact', head: true }).eq('dono', form.dono).gte('criado_em', umDia);
  if ((doDia ?? 0) >= POR_DIA) return json({ erro: 'A caixa de pedidos está cheia por hoje. Tente amanhã ou chame no WhatsApp.' }, 429);

  const { error } = await banco.from('solicitacoes').insert({
    dono: form.dono, nome, contato, origem_hash: origem,
    dados: { quantidade, observacao, escolhas, versao: texto(corpo.versao, 60) },
  });
  if (error) {
    console.error('insert', error.message);
    return json({ erro: 'Não consegui guardar o pedido agora. Tente de novo em instantes.' }, 500);
  }
  return json({ ok: true });
});
