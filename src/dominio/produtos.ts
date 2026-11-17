// Produtos e receitas: custo de material e quantas unidades o estoque permite produzir.
import { microParaCentavos } from './dinheiro.ts';

export type Linha = 'encadernacao' | 'impressao3d';
export const LINHAS: Record<Linha, string> = { encadernacao: 'Encadernação', impressao3d: 'Impressão 3D' };

/** Descrição do produto, um campo para cada: ex. planner diário, A5, azul, wire-o, 90 folhas. */
export interface FichaProduto {
  tipo: string;
  tamanho: string;
  cor: string;
  encadernacao: string;
  folhas: string;
  // impressão 3D
  filamento?: string; // PLA, PETG, ABS, TPU ou Outro
  filamentoOutro?: string;
  modoCor?: 'mono' | 'multi'; // monocromático ou multicolorido (até 4 cores)
  cores?: string[];
  acabamentos?: string;
  pintar?: boolean; // vai ser pintado à mão?
  pinturaManual?: string;
}
export const FILAMENTOS = ['PLA', 'PETG', 'ABS', 'TPU', 'Outro'];
export const BICOS = ['Latão', 'Aço endurecido', 'Aço inox', 'Rubi', 'Outro'];
export const MAX_CORES = 4;
export const FICHA_VAZIA: FichaProduto = { tipo: '', tamanho: '', cor: '', encadernacao: '', folhas: '' };

export type TipoColecao = 'colecao' | 'temporada' | 'data' | 'tema';
export const TIPOS_COLECAO: Record<TipoColecao, string> = { colecao: 'Coleção', temporada: 'Temporada', data: 'Data comemorativa', tema: 'Temática' };

export function resumoFicha(f: Partial<FichaProduto> | undefined, linha: Linha = 'encadernacao'): string {
  if (!f) return '';
  if (linha === 'impressao3d') {
    const cores = f.modoCor === 'multi' ? (f.cores ?? []).filter((c) => c.trim()).join(' + ') : f.cor;
    const fil = f.filamento === 'Outro' ? f.filamentoOutro : f.filamento;
    return [f.tamanho && `${f.tamanho} cm`, cores, f.modoCor === 'multi' ? 'multicolorido' : f.modoCor === 'mono' ? 'monocromático' : '', fil, f.acabamentos, f.pintar ? 'pintura manual' : '']
      .filter((x) => !!x && String(x).trim()).join(' · ');
  }
  return [f.tipo, f.tamanho, f.cor, f.encadernacao, f.folhas && `${f.folhas} folhas`].filter((x) => !!x && String(x).trim()).join(' · ');
}

export interface ItemProduto {
  materialId: string;
  quantidade: number; // por unidade do produto, em unidades de estoque
  desperdicioPct: number; // perda específica deste item (ex.: sobra do corte). O desperdício geral entra na precificação.
  extra: boolean; // extra: se faltar, o produto sai sem ele (não limita a produção)
}

/** Um filamento do estoque usado na peça: volume da peça e purga (troca de cor), em gramas. */
export interface UsoFilamento {
  materialId: string;
  volumeG: number;
  purgaG: number;
}

/** Receita de uma peça 3D: cada filamento do estoque (em gramas) = volume usado + purga; o mesmo filamento em duas linhas soma. */
export function receitaFilamentos(usos: UsoFilamento[]): ItemProduto[] {
  const soma: Record<string, number> = {};
  for (const u of usos) {
    const q = Math.max(0, u.volumeG || 0) + Math.max(0, u.purgaG || 0);
    if (u.materialId && q > 0) soma[u.materialId] = (soma[u.materialId] ?? 0) + q;
  }
  return Object.entries(soma).map(([materialId, quantidade]) => ({ materialId, quantidade, desperdicioPct: 0, extra: false }));
}

export interface Perfil3D {
  tempMesaC?: number;
  tempBicoC?: number;
  tipoBico?: string;
  tipoBicoOutro?: string;
  camadas?: number; // número de camadas
  volumeG?: number; // volume usado na peça, em gramas
  purgaG?: number; // purga (troca de cor), em gramas
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
