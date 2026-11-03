import { microParaCentavos } from './dinheiro.ts';

export interface ItemReceita {
  materialId: string;
  quantidade: number; // em unidades de estoque (folhas, gramas, un)
  custoUnitMicro: number;
  essencial: boolean;
}

/** Custo de material de uma unidade do produto, em centavos. */
export function custoMaterialCentavos(itens: ItemReceita[]): number {
  let micro = 0;
  for (const i of itens) micro += i.quantidade * i.custoUnitMicro;
  return microParaCentavos(micro);
}

/** Quantas unidades dá para produzir: só os materiais essenciais limitam; extras apenas avisam. */
export function quantosDaParaProduzir(
  itens: ItemReceita[],
  disponivelPorMaterial: Record<string, number>,
): { quantidade: number; limitante: string | null; extrasEmFalta: string[] } {
  let quantidade = Infinity;
  let limitante: string | null = null;
  const extrasEmFalta: string[] = [];
  for (const i of itens) {
    const disp = disponivelPorMaterial[i.materialId] ?? 0;
    const possivel = Math.floor(disp / i.quantidade);
    if (i.essencial) {
      if (possivel < quantidade) {
        quantidade = possivel;
        limitante = i.materialId;
      }
    } else if (possivel < 1) {
      extrasEmFalta.push(i.materialId);
    }
  }
  return { quantidade: quantidade === Infinity ? 0 : quantidade, limitante, extrasEmFalta };
}
