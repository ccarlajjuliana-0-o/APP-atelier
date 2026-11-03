// Estoque: o saldo é sempre a soma das movimentações, que só se acrescentam.
// Papel em FOLHAS e filamento em GRAMAS (inteiros). Compras podem ser em resma/rolo e são convertidas.

export type TipoMovimentacao =
  | 'entrada' // compra ou saldo inicial (+físico)
  | 'ajuste' // correção de inventário (±físico)
  | 'reserva' // pedido confirmado (+reservado)
  | 'liberacao' // pedido cancelado (−reservado)
  | 'baixa'; // etapa de produção concluída (−físico, −reservado)

export interface Movimentacao {
  materialId: string;
  tipo: TipoMovimentacao;
  quantidade: number; // sempre positivo, exceto 'ajuste' que pode ser negativo
}

export function saldoFisico(movs: Movimentacao[]): number {
  let total = 0;
  for (const m of movs) {
    if (m.tipo === 'entrada' || m.tipo === 'ajuste') total += m.quantidade;
    else if (m.tipo === 'baixa') total -= m.quantidade;
  }
  return total;
}

export function saldoReservado(movs: Movimentacao[]): number {
  let total = 0;
  for (const m of movs) {
    if (m.tipo === 'reserva') total += m.quantidade;
    else if (m.tipo === 'liberacao' || m.tipo === 'baixa') total -= m.quantidade;
  }
  return total;
}

export function saldoDisponivel(movs: Movimentacao[]): number {
  return saldoFisico(movs) - saldoReservado(movs);
}

/** Custo médio ponderado (micro-reais por unidade) após uma nova compra. */
export function custoMedioPonderado(
  saldoAtual: number,
  custoAtualMicro: number,
  quantidadeComprada: number,
  custoUnitCompraMicro: number,
): number {
  const total = saldoAtual + quantidadeComprada;
  if (total <= 0) return custoUnitCompraMicro;
  return Math.round(
    (saldoAtual * custoAtualMicro + quantidadeComprada * custoUnitCompraMicro) / total,
  );
}

/** Converte uma compra em embalagens (resma, rolo) para unidades de estoque (folhas, gramas). */
export function converterCompra(
  embalagens: number,
  unidadesPorEmbalagem: number,
  valorTotalCentavos: number,
): { quantidade: number; custoUnitMicro: number } {
  const quantidade = embalagens * unidadesPorEmbalagem;
  const custoUnitMicro = Math.round((valorTotalCentavos * 10_000) / quantidade);
  return { quantidade, custoUnitMicro };
}

export function abaixoDoMinimo(disponivel: number, minimo: number): boolean {
  return disponivel < minimo;
}
