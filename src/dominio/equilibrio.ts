// Ponto de equilíbrio: custos do mês ÷ contribuição média por pedido.

export function contribuicaoMediaPorPedido(contribuicaoTotal: number, pedidos: number): number {
  return pedidos > 0 ? contribuicaoTotal / pedidos : 0;
}

export function pedidosParaEquilibrio(custosDoMes: number, contribuicaoMedia: number): number {
  if (contribuicaoMedia <= 0) return Infinity;
  return Math.ceil(custosDoMes / contribuicaoMedia);
}

export function resultadoDoPeriodo(contribuicaoTotal: number, custosDoPeriodo: number): number {
  return contribuicaoTotal - custosDoPeriodo;
}
