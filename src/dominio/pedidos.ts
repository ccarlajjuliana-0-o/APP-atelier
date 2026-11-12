// Pedidos: status, valores, entrada de 50%, prazo em dias úteis e necessidade de material.
import { PRAZO_DIAS_UTEIS, adicionarDiasUteis, type TipoPedido } from './prazo.ts';
import { qtdEfetiva, type ItemProduto } from './produtos.ts';

export type StatusPedido = 'orcamento' | 'confirmado' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado';

export const STATUS: Record<StatusPedido, string> = {
  orcamento: 'Orçamento',
  confirmado: 'Confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const ABERTOS: StatusPedido[] = ['orcamento', 'confirmado', 'em_producao', 'pronto'];

/** Próxima etapa do pedido e o texto do botão que leva até ela. */
export const AVANCO: Partial<Record<StatusPedido, { para: StatusPedido; botao: string }>> = {
  orcamento: { para: 'confirmado', botao: 'Confirmar pedido' },
  confirmado: { para: 'em_producao', botao: 'Começar a produzir' },
  em_producao: { para: 'pronto', botao: 'Marcar como pronto' },
  pronto: { para: 'entregue', botao: 'Marcar como entregue' },
};

export function podeCancelar(s: StatusPedido): boolean {
  return s === 'orcamento' || s === 'confirmado' || s === 'em_producao';
}

export const TIPOS: Record<TipoPedido, string> = { personalizado: 'Personalizado', catalogo: 'Catálogo' };
export const ENTRADA_PCT = 50;

export interface ItemPedido {
  produtoId: string | null; // null: item avulso, sem receita (não mexe no estoque)
  descricao: string;
  quantidade: number;
  precoUnitCentavos: number;
  modeloId: string | null; // do Mostruário
  modeloNome: string;
  adesivoId: string | null;
  adesivoNome: string;
  observacao: string; // nome a gravar, cor, detalhes
}

export interface Pagamento {
  data: string; // AAAA-MM-DD
  valorCentavos: number;
  observacao: string;
}

export interface Reserva {
  materialId: string;
  quantidade: number;
}

export function totalCentavos(itens: ItemPedido[]): number {
  return itens.reduce((s, i) => s + Math.round(Math.max(0, i.quantidade) * Math.max(0, i.precoUnitCentavos)), 0);
}

export function entradaCentavos(total: number, pct = ENTRADA_PCT): number {
  return Math.round((total * pct) / 100);
}

export function pagoCentavos(pagamentos: Pagamento[]): number {
  return pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
}

export type SituacaoPagamento = 'sem_pagamento' | 'parcial' | 'entrada_paga' | 'quitado';

export function situacaoPagamento(total: number, pagamentos: Pagamento[]): SituacaoPagamento {
  const pago = pagoCentavos(pagamentos);
  if (pago <= 0) return 'sem_pagamento';
  if (total > 0 && pago >= total) return 'quitado';
  if (pago >= entradaCentavos(total)) return 'entrada_paga';
  return 'parcial';
}

export const TEXTO_PAGAMENTO: Record<SituacaoPagamento, string> = {
  sem_pagamento: 'sem pagamento',
  parcial: 'pago parte da entrada',
  entrada_paga: 'entrada paga',
  quitado: 'quitado',
};

export function prazoPadraoDias(tipo: TipoPedido): number {
  return PRAZO_DIAS_UTEIS[tipo].max;
}

export function dataPrometida(confirmadoEm: string, prazoDias: number): string {
  return adicionarDiasUteis(confirmadoEm, prazoDias);
}

export function atrasado(status: StatusPedido, prometida: string | null, hoje: string): boolean {
  return (status === 'confirmado' || status === 'em_producao' || status === 'pronto') && !!prometida && hoje > prometida;
}

export function dataParaTexto(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export interface Necessidade {
  materialId: string;
  necessario: number; // inteiro, arredondado para cima
  reservar: number; // o que será reservado (extras só até onde há estoque)
  falta: number; // o que falta em relação ao disponível
  extra: boolean; // só entra em receitas como extra
}

/**
 * Soma o material que os itens do pedido pedem. Itens avulsos e produtos sem receita não contam.
 * Material essencial é reservado por inteiro (o saldo disponível pode ficar negativo, e a tela avisa).
 * Extra só é reservado até onde há estoque disponível.
 */
export function necessidades(
  itens: ItemPedido[],
  receitas: Record<string, ItemProduto[]>,
  disponivel: Record<string, number>,
): Necessidade[] {
  const essencial: Record<string, number> = {};
  const extra: Record<string, number> = {};
  for (const it of itens) {
    if (!it.produtoId || !(it.quantidade > 0)) continue;
    for (const r of receitas[it.produtoId] ?? []) {
      const q = qtdEfetiva(r) * it.quantidade;
      if (!(q > 0)) continue;
      const alvo = r.extra ? extra : essencial;
      alvo[r.materialId] = (alvo[r.materialId] ?? 0) + q;
    }
  }
  const ids = new Set([...Object.keys(essencial), ...Object.keys(extra)]);
  const out: Necessidade[] = [];
  for (const id of ids) {
    const ess = Math.ceil((essencial[id] ?? 0) - 1e-9);
    const total = Math.ceil((essencial[id] ?? 0) + (extra[id] ?? 0) - 1e-9);
    const ext = Math.max(0, total - ess);
    const disp = Math.max(0, disponivel[id] ?? 0);
    const reservaExtra = Math.min(ext, Math.max(0, disp - ess));
    out.push({
      materialId: id,
      necessario: total,
      reservar: ess + reservaExtra,
      falta: Math.max(0, total - disp),
      extra: ess === 0,
    });
  }
  return out.filter((n) => n.necessario > 0).sort((a, b) => a.materialId.localeCompare(b.materialId));
}
