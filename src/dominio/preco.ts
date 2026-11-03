// Precificação. A hora de trabalho NÃO entra no custo: é tratada como lucro.

export interface EntradaCusto {
  materiaisCentavos: number;
  desperdicioPercentual: number; // 5 = 5% sobre os materiais (encadernação); 30 para falhas em 3D (sobre o custo)
  baseDoPercentual: 'materiais' | 'custo';
  extrasCentavos: number[]; // energia/desgaste por uso, impressão do miolo, acabamento...
}

export function custoDoProdutoCentavos(e: EntradaCusto): number {
  const extras = e.extrasCentavos.reduce((a, b) => a + b, 0);
  const base = e.baseDoPercentual === 'materiais' ? e.materiaisCentavos : e.materiaisCentavos + extras;
  const perda = Math.round((base * e.desperdicioPercentual) / 100);
  return e.materiaisCentavos + extras + perda;
}

/** Preço = custo × multiplicador ÷ (1 − taxa do canal). */
export function precoSugeridoCentavos(custo: number, multiplicador: number, taxaCanal = 0): number {
  return Math.round((custo * multiplicador) / (1 - taxaCanal));
}

export function lucroCentavos(preco: number, custo: number, taxaCanal = 0): number {
  return Math.round(preco * (1 - taxaCanal)) - custo;
}

export function horaImplicitaCentavos(lucro: number, horas: number): number {
  return Math.round(lucro / horas);
}
