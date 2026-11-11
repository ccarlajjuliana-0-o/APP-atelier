// Produtos e receitas: custo de material e quantas unidades o estoque permite produzir.
import { microParaCentavos } from './dinheiro.ts';

export type Linha = 'encadernacao' | 'impressao3d';
export const LINHAS: Record<Linha, string> = { encadernacao: 'Encadernação', impressao3d: 'Impressão 3D' };

export interface ItemProduto {
  materialId: string;
  quantidade: number; // por unidade do produto, em unidades de estoque
  desperdicioPct: number; // perda específica deste item (ex.: sobra do corte). O desperdício geral entra na precificação.
  extra: boolean; // extra: se faltar, o produto sai sem ele (não limita a produção)
}

export interface Perfil3D {
  paredes: number;
  preenchimentoTipo: string;
  preenchimentoPct: number;
  alturaCamadaMm: number;
  cor: 'mono' | 'ams'; // monocromática (feita por partes) ou colorida (AMS)
  tempoImpressaoMin: number;
  observacoes: string;
}

export interface InfoMaterial {
  nome: string;
  custoMicro: number;
  disponivel: number;
}

export interface LinhaResumo {
  materialId: string;
  qtdEfetiva: number;
  custoMicro: number;
  pode: number; // unidades que este item permite
  emFalta: boolean;
}

export interface ResumoProduto {
  linhas: LinhaResumo[];
  custoCentavos: number;
  quantidade: number | null; // null: receita sem item essencial
  limitante: string | null;
  extrasEmFalta: string[];
  semCusto: string[]; // materiais da receita que ainda não têm custo
}

export function qtdEfetiva(i: ItemProduto): number {
  return i.quantidade * (1 + Math.max(0, i.desperdicioPct) / 100);
}

export function resumoProduto(itens: ItemProduto[], materiais: Record<string, InfoMaterial>): ResumoProduto {
  const linhas: LinhaResumo[] = [];
  const semCusto: string[] = [];
  let custoMicro = 0;
  let quantidade = Infinity;
  let limitante: string | null = null;
  const extrasEmFalta: string[] = [];
  let temEssencial = false;

  for (const i of itens) {
    const info = materiais[i.materialId];
    const q = qtdEfetiva(i);
    if (!info || !(q > 0)) continue;
    const custo = q * info.custoMicro;
    custoMicro += custo;
    if (info.custoMicro === 0) semCusto.push(i.materialId);
    const pode = Math.floor(Math.max(0, info.disponivel) / q);
    linhas.push({ materialId: i.materialId, qtdEfetiva: q, custoMicro: custo, pode, emFalta: pode < 1 });
    if (i.extra) {
      if (pode < 1) extrasEmFalta.push(i.materialId);
    } else {
      temEssencial = true;
      if (pode < quantidade) {
        quantidade = pode;
        limitante = i.materialId;
      }
    }
  }
  return {
    linhas,
    custoCentavos: microParaCentavos(custoMicro),
    quantidade: temEssencial ? quantidade : null,
    limitante,
    extrasEmFalta,
    semCusto,
  };
}
