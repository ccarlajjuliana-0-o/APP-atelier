// Orçamentos: proposta enviada à cliente. Só vira pedido depois da confirmação dela e/ou do sinal.
import type { ItemPedido } from './pedidos.ts';
import { totalCentavos } from './pedidos.ts';
import type { TipoPedido } from './prazo.ts';

export type StatusOrcamento = 'aberto' | 'aprovado' | 'recusado';
export const STATUS_ORCAMENTO: Record<StatusOrcamento, string> = { aberto: 'Em aberto', aprovado: 'Virou pedido', recusado: 'Não fechou' };

export const CANAIS = ['Formulário online', 'WhatsApp', 'Instagram', 'Shopee', 'Mercado Livre', 'Site', 'Pessoalmente', 'Indicação', 'Outro'];

export interface EventoOrcamento {
  em: string; // ISO
  texto: string;
}

export interface Orcamento {
  id: string;
  numero: number;
  clienteId: string | null;
  canal: string; // como a cliente pediu
  status: StatusOrcamento;
  itens: ItemPedido[];
  observacoes: string;
  pedidoId: string | null;
  pedidoNumero: number | null;
  motivo: string; // por que não fechou
  historico: EventoOrcamento[];
  criadoEm: string;
  atualizadoEm: string;
}

export function evento(texto: string, agora = new Date().toISOString()): EventoOrcamento {
  return { em: agora, texto };
}

export function orcamentoNovo(): Orcamento {
  return {
    id: '', numero: 0, clienteId: null, canal: 'WhatsApp', status: 'aberto', itens: [], observacoes: '', pedidoId: null, pedidoNumero: null,
    motivo: '', historico: [], criadoEm: '', atualizadoEm: '',
  };
}

export function totalDoOrcamento(o: Pick<Orcamento, 'itens'>): number {
  return totalCentavos(o.itens);
}

/** Personalizado se algum item foi montado pelo formulário; senão, é de catálogo. */
export function tipoDoPedido(itens: ItemPedido[]): TipoPedido {
  return itens.some((i) => i.personalizado) ? 'personalizado' : 'catalogo';
}

/** Mensagem do que impede de virar pedido, ou null se pode. */
export function impedimentoParaPedido(o: Orcamento, confirmou: boolean, sinalCentavos: number): string | null {
  if (o.status !== 'aberto') return 'Este orçamento já foi encerrado.';
  if (!o.clienteId) return 'Escolha a cliente antes de gerar o pedido.';
  if (o.itens.length === 0) return 'Inclua ao menos um item.';
  if (o.itens.some((i) => !i.descricao.trim() || !(i.quantidade >= 1))) return 'Todo item precisa de descrição e quantidade.';
  if (!confirmou && !(sinalCentavos > 0)) return 'O pedido só nasce depois que a cliente confirma e/ou paga o sinal.';
  return null;
}
