// Devolução de pedido entregue: prazo, motivo, solução (troca ou reembolso) e destino de cada peça que volta.

export const PRAZO_DEVOLUCAO_DIAS = 7;

export type MotivoDevolucao = 'defeito_fabricacao' | 'avaria_transporte' | 'mau_uso' | 'arrependimento' | 'outro';
export const MOTIVOS: Record<MotivoDevolucao, string> = {
  defeito_fabricacao: 'Defeito de fabricação',
  avaria_transporte: 'Avaria no transporte',
  arrependimento: 'Arrependimento / não gostou',
  mau_uso: 'Mau uso',
  outro: 'Outro motivo',
};

export type MeioDevolucao = 'correios' | 'pessoalmente' | 'transportadora' | 'outro';
export const MEIOS: Record<MeioDevolucao, string> = {
  correios: 'Correios',
  pessoalmente: 'Pessoalmente',
  transportadora: 'Transportadora / app de entrega',
  outro: 'Outro',
};

export type SolucaoDevolucao = 'novo_pedido' | 'reembolso';
export const SOLUCOES: Record<SolucaoDevolucao, string> = {
  novo_pedido: 'Receber um novo pedido igual',
  reembolso: 'Reembolso',
};

/** Peça devolvida: a caminho → recebida e avaliada (estoque, conserto ou perda). */
export type SituacaoPeca = 'a_caminho' | 'no_estoque' | 'em_conserto' | 'perda';
export const SITUACAO_PECA: Record<SituacaoPeca, string> = {
  a_caminho: 'ainda não chegou',
  no_estoque: 'voltou ao estoque',
  em_conserto: 'em conserto',
  perda: 'perda (desperdício)',
};

export interface PecaDevolvida {
  indice: number; // posição do item no pedido
  descricao: string;
  quantidade: number;
  valorCentavos: number;
  situacao: SituacaoPeca;
  recebidaEm: string | null; // AAAA-MM-DD, quando a peça voltou ao ateliê
  nota: string; // estado em que chegou / o que foi feito
  perdaCentavos: number; // se virou desperdício
}

export interface Devolucao {
  id: string;
  solicitadaEm: string; // AAAA-MM-DD
  dentroDoPrazo: boolean;
  motivoTipo: MotivoDevolucao;
  motivo: string;
  meio: MeioDevolucao;
  meioDetalhe: string; // código de rastreio, quem levou...
  solucao: SolucaoDevolucao;
  reembolsoCentavos: number;
  novoPedidoId: string | null;
  novoPedidoNumero: number | null;
  pecas: PecaDevolvida[];
  criadoEm: string;
}

function diaNumero(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(a, (m || 1) - 1, d || 1) / 86400000);
}

/** Dias corridos entre a entrega e a data do pedido de devolução. */
export function diasDesdeEntrega(entregueEm: string, data: string): number {
  return diaNumero(data) - diaNumero(entregueEm);
}

export function dentroDoPrazo(entregueEm: string, data: string, prazo = PRAZO_DEVOLUCAO_DIAS): boolean {
  const d = diasDesdeEntrega(entregueEm, data);
  return d >= 0 && d <= prazo;
}

/** Texto para mostrar a conferência do prazo. */
export function textoPrazo(entregueEm: string, data: string, prazo = PRAZO_DEVOLUCAO_DIAS): string {
  const d = diasDesdeEntrega(entregueEm, data);
  if (d < 0) return 'A data é anterior à entrega. Confira.';
  if (d <= prazo) return d === 0 ? `Dentro do prazo (mesmo dia da entrega; limite de ${prazo} dias).` : `Dentro do prazo: ${d} ${d === 1 ? 'dia' : 'dias'} após a entrega (limite de ${prazo}).`;
  return `Fora do prazo: ${d} dias após a entrega (limite de ${prazo}).`;
}

/** Troca por um novo pedido só vale para defeito de fabricação ou avaria no transporte. */
export function trocaPermitida(motivo: MotivoDevolucao): boolean {
  return motivo === 'defeito_fabricacao' || motivo === 'avaria_transporte';
}

export function valorDasPecas(pecas: Pick<PecaDevolvida, 'valorCentavos'>[]): number {
  return pecas.reduce((s, p) => s + p.valorCentavos, 0);
}

/** Devolve o texto do problema, ou '' se estiver tudo certo para registrar. */
export function impedimentoDevolucao(d: {
  motivoTipo: MotivoDevolucao; motivo: string; solucao: SolucaoDevolucao; pecas: number; reembolsoCentavos: number; pagoCentavos: number;
  dentroDoPrazo: boolean; aceitaForaDoPrazo: boolean;
}): string {
  if (d.pecas === 0) return 'Marque ao menos um item que voltou.';
  if (!d.motivo.trim() && d.motivoTipo === 'outro') return 'Conte o motivo da devolução.';
  if (!d.dentroDoPrazo && !d.aceitaForaDoPrazo) return 'A devolução está fora do prazo. Marque “aceitar mesmo assim” se quiser seguir.';
  if (d.solucao === 'novo_pedido' && !trocaPermitida(d.motivoTipo)) return 'O novo pedido igual vale só para defeito de fabricação ou avaria no transporte.';
  if (d.solucao === 'reembolso') {
    if (!(d.reembolsoCentavos > 0)) return 'Informe o valor do reembolso.';
    if (d.reembolsoCentavos > d.pagoCentavos) return 'O reembolso não pode ser maior do que o valor já pago.';
  }
  return '';
}

export function pecaNova(indice: number, descricao: string, quantidade: number, valorCentavos: number): PecaDevolvida {
  return { indice, descricao, quantidade, valorCentavos, situacao: 'a_caminho', recebidaEm: null, nota: '', perdaCentavos: 0 };
}

export function pecasPendentes(devolucoes: Devolucao[] | undefined): number {
  return (devolucoes ?? []).reduce((s, d) => s + d.pecas.filter((p) => p.situacao === 'a_caminho' || p.situacao === 'em_conserto').length, 0);
}

/** Pedido que teve devolução com reembolso: total (nada ficou com a cliente) ou parcial, com a data do último reembolso. */
export function reembolsoDoPedido(p: { itens: { cancelado?: boolean; devolvido?: boolean }[]; devolucoes?: Devolucao[] }): { tipo: 'total' | 'parcial'; data: string } | null {
  const rs = (p.devolucoes ?? []).filter((d) => d.solucao === 'reembolso');
  if (rs.length === 0) return null;
  const data = rs.map((d) => d.solicitadaEm).sort().slice(-1)[0];
  const restam = p.itens.some((i) => !i.cancelado && !i.devolvido);
  return { tipo: restam ? 'parcial' : 'total', data };
}
