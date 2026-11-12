// Assistente: monta o resumo do ateliê que acompanha a pergunta e limita o tamanho da conversa.
// Tudo aqui é cálculo e texto. A chamada à IA fica na função segura do Supabase.
import { centavosParaTexto, microParaCentavos } from './dinheiro.ts';

export interface MaterialResumo { nome: string; unidade: string; fisico: number; disponivel: number; minimo: number; custoMicro: number }
export interface ProdutoResumo {
  nome: string; linha: string; precoCentavos: number | null; custoCentavos: number; materiaisSemCusto: number;
  sugerido: { canal: string; centavos: number | null }[]; margemPct: number | null; horaCentavos: number | null; tempoTrabalhoMin: number;
}
export interface PedidoResumo {
  numero: number; cliente: string; status: string; totalCentavos: number; pagoCentavos: number; dataPrometida: string | null; atrasado: boolean; itens: string;
}
export interface SnapshotAssistente {
  hoje: string;
  tela?: string; // tela aberta no app quando a pergunta foi feita
  materiais: MaterialResumo[];
  produtos: ProdutoResumo[];
  pedidos: PedidoResumo[]; // só abertos
  caixaMes: { mes: string; entrou: number; saiu: number; fixas: number };
  ajustes: { multiplicadorEncadernacao: number | null; multiplicador3d: number | null; kwhCentavos: number };
  atencao: string[]; // manutenção vencendo, material abaixo do mínimo etc.
  publicacoes: { data: string; titulo: string; canal: string; status: string }[]; // próximas
}

const LIMITE_LINHAS = 120;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

/** Primeiro nome só: o contato e o sobrenome do cliente não saem do aparelho. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || 'cliente';
}

/** Texto compacto com o estado do ateliê. Valores já em reais, para a IA não precisar converter. */
export function montarContexto(s: SnapshotAssistente): string {
  const out: string[] = [`Hoje: ${s.hoje}`];
  if (s.tela) out.push(`Tela aberta no app agora: ${s.tela} (a pergunta pode se referir ao que ela mostra)`);
  out.push('');

  out.push('PRECIFICAÇÃO (ajustes do app)');
  out.push(`- multiplicador encadernação: ${s.ajustes.multiplicadorEncadernacao ?? 'não definido'}; multiplicador 3D: ${s.ajustes.multiplicador3d ?? 'não definido'}; kWh: ${s.ajustes.kwhCentavos > 0 ? centavosParaTexto(s.ajustes.kwhCentavos) : 'não definido'}`);
  out.push('');

  out.push('MATERIAIS (nome | físico | disponível | mínimo | custo unitário)');
  for (const m of s.materiais.slice(0, LIMITE_LINHAS)) {
    const abaixo = m.minimo > 0 && m.disponivel < m.minimo ? ' | ABAIXO DO MÍNIMO' : '';
    const custo = m.custoMicro > 0 ? centavosParaTexto(microParaCentavos(m.custoMicro)).replace('R$ ', 'R$') + `/${m.unidade} (≈${(m.custoMicro / 1_000_000).toFixed(4).replace('.', ',')})` : 'sem custo';
    out.push(`- ${m.nome} | ${num(m.fisico)} ${m.unidade} | ${num(m.disponivel)} | ${num(m.minimo)} | ${custo}${abaixo}`);
  }
  if (s.materiais.length === 0) out.push('- (nenhum material cadastrado)');
  out.push('');

  out.push('PRODUTOS (nome | linha | preço atual | custo | sugerido por canal | margem | lucro por hora)');
  for (const p of s.produtos.slice(0, LIMITE_LINHAS)) {
    const sug = p.sugerido.map((x) => `${x.canal}: ${x.centavos === null ? '—' : centavosParaTexto(x.centavos)}`).join('; ');
    const aviso = p.materiaisSemCusto > 0 ? ` | ATENÇÃO: faltam custos de ${p.materiaisSemCusto} material(is), custo incompleto` : '';
    out.push(`- ${p.nome} | ${p.linha} | ${p.precoCentavos === null ? 'sem preço' : centavosParaTexto(p.precoCentavos)} | custo ${centavosParaTexto(p.custoCentavos)} | ${sug || 'sem canais'} | margem ${p.margemPct === null ? '—' : p.margemPct.toFixed(0) + '%'} | hora ${p.horaCentavos === null ? '—' : centavosParaTexto(p.horaCentavos)} (${p.tempoTrabalhoMin} min de trabalho)${aviso}`);
  }
  if (s.produtos.length === 0) out.push('- (nenhum produto cadastrado)');
  out.push('');

  out.push('PEDIDOS EM ABERTO (nº | cliente | situação | total | recebido | falta | prazo)');
  for (const p of s.pedidos.slice(0, LIMITE_LINHAS)) {
    const falta = Math.max(0, p.totalCentavos - p.pagoCentavos);
    out.push(`- #${p.numero} | ${p.cliente} | ${p.status} | ${centavosParaTexto(p.totalCentavos)} | ${centavosParaTexto(p.pagoCentavos)} | falta ${centavosParaTexto(falta)} | ${p.dataPrometida ?? 'sem prazo'}${p.atrasado ? ' | ATRASADO' : ''} | ${p.itens}`);
  }
  if (s.pedidos.length === 0) out.push('- (nenhum pedido em aberto)');
  out.push('');

  out.push(`CAIXA DE ${s.caixaMes.mes}: entrou ${centavosParaTexto(s.caixaMes.entrou)}; saiu ${centavosParaTexto(s.caixaMes.saiu)} (já inclui despesas fixas de ${centavosParaTexto(s.caixaMes.fixas)})`);
  out.push('');

  out.push('ATENÇÃO HOJE');
  for (const a of s.atencao) out.push(`- ${a}`);
  if (s.atencao.length === 0) out.push('- nada pedindo atenção');
  out.push('');

  out.push('PRÓXIMAS PUBLICAÇÕES');
  for (const p of s.publicacoes.slice(0, 15)) out.push(`- ${p.data} | ${p.titulo || 'sem título'} | ${p.canal} | ${p.status}`);
  if (s.publicacoes.length === 0) out.push('- nenhuma planejada');

  return out.join('\n');
}

export interface Mensagem {
  role: 'user' | 'assistant';
  content: string;
}

export const MAX_MENSAGENS = 12;
export const MAX_CARACTERES = 4000;

/** Mantém só o fim da conversa e corta mensagens longas demais; a primeira mensagem enviada sempre é do usuário. */
export function limitarMensagens(msgs: Mensagem[]): Mensagem[] {
  let lista = msgs.filter((m) => m.content.trim()).slice(-MAX_MENSAGENS).map((m) => ({ ...m, content: m.content.slice(0, MAX_CARACTERES) }));
  while (lista.length > 0 && lista[0].role !== 'user') lista = lista.slice(1);
  return lista;
}

export const PERGUNTAS_SUGERIDAS = [
  'O que está pedindo atenção hoje?',
  'Quais materiais preciso comprar?',
  'Quanto ainda tenho a receber dos pedidos?',
  'Qual produto está com a menor margem?',
  'Sugira uma legenda para o próximo post.',
];
