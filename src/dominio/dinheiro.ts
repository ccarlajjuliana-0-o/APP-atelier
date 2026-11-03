// Dinheiro e custos.
// - Valores totais (preço, caixa, despesas) em CENTAVOS inteiros.
// - Custo unitário de materiais em MICRO-REAIS inteiros (1 real = 1.000.000),
//   porque uma folha de papel custa frações de centavo.

export const MICRO = 1_000_000;

export function centavosParaTexto(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100);
  const cent = String(abs % 100).padStart(2, '0');
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}R$ ${milhar},${cent}`;
}

export function microParaCentavos(micro: number): number {
  return Math.round(micro / 10_000);
}

export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}
