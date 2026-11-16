// Opções de personalização: grupos de escolhas (cor do wire-o, nº de páginas, elástico...) ligados a materiais do estoque.
import { microParaCentavos } from './dinheiro.ts';
import { qtdEfetiva, type InfoMaterial } from './produtos.ts';

export interface OpcaoProduto {
  id: string;
  nome: string;
  materialId: string | null; // null: opção sem material (ex.: "sem elástico")
  quantidade: number; // por unidade do produto
  desperdicioPct: number;
  acrescimoCentavos: number | null; // null = automático (custo do material × multiplicador)
  padrao: boolean;
}

export interface GrupoOpcoes {
  id: string;
  nome: string;
  tipo: 'unica' | 'multipla';
  obrigatorio: boolean;
  opcoes: OpcaoProduto[];
}

/** Escolha gravada no item do pedido (cópia: continua certa mesmo que o produto mude depois). */
export interface EscolhaItem {
  grupoId: string;
  grupoNome: string;
  opcaoId: string;
  opcaoNome: string;
  materialId: string | null;
  quantidade: number; // por unidade, já com desperdício
  acrescimoCentavos: number;
}

type Infos = Record<string, InfoMaterial>;

function qtdDaOpcao(o: OpcaoProduto): number {
  return qtdEfetiva({ materialId: o.materialId ?? '', quantidade: o.quantidade, desperdicioPct: o.desperdicioPct, extra: false });
}

export function acrescimoDaOpcao(o: OpcaoProduto, info: Infos, multiplicador: number): number {
  if (o.acrescimoCentavos !== null) return Math.max(0, Math.round(o.acrescimoCentavos));
  if (!o.materialId) return 0;
  const m = info[o.materialId];
  if (!m) return 0;
  return Math.round(microParaCentavos(qtdDaOpcao(o) * m.custoMicro) * Math.max(1, multiplicador));
}

/** Opção sem material sempre aparece; com material, só se o estoque disponível cobre as unidades pedidas. */
export function opcaoDisponivel(o: OpcaoProduto, info: Infos, unidades = 1): boolean {
  if (!o.materialId) return true;
  const m = info[o.materialId];
  if (!m) return false;
  const q = qtdDaOpcao(o) * Math.max(1, unidades);
  return q <= 0 || m.disponivel + 1e-9 >= q;
}

export function criarEscolha(g: GrupoOpcoes, o: OpcaoProduto, info: Infos, multiplicador: number): EscolhaItem {
  return {
    grupoId: g.id, grupoNome: g.nome, opcaoId: o.id, opcaoNome: o.nome, materialId: o.materialId,
    quantidade: o.materialId ? qtdDaOpcao(o) : 0, acrescimoCentavos: acrescimoDaOpcao(o, info, multiplicador),
  };
}

/** Escolhas iniciais: as opções marcadas como padrão que estão disponíveis. */
export function escolhasPadrao(grupos: GrupoOpcoes[], info: Infos, multiplicador: number, unidades = 1): EscolhaItem[] {
  const out: EscolhaItem[] = [];
  for (const g of grupos) {
    const ok = g.opcoes.filter((o) => o.padrao && opcaoDisponivel(o, info, unidades));
    for (const o of g.tipo === 'unica' ? ok.slice(0, 1) : ok) out.push(criarEscolha(g, o, info, multiplicador));
  }
  return out;
}

/** Alterna uma opção: em grupo de escolha única troca; em múltipla liga/desliga (única pode ser desmarcada se não obrigatória). */
export function alternarEscolha(escolhas: EscolhaItem[], g: GrupoOpcoes, o: OpcaoProduto, info: Infos, multiplicador: number): EscolhaItem[] {
  const marcada = escolhas.some((e) => e.grupoId === g.id && e.opcaoId === o.id);
  const resto = escolhas.filter((e) => !(e.grupoId === g.id && (g.tipo === 'unica' || e.opcaoId === o.id)));
  if (marcada) return g.obrigatorio && g.tipo === 'unica' ? escolhas : resto;
  return [...resto, criarEscolha(g, o, info, multiplicador)];
}

export function acrescimoTotal(escolhas: EscolhaItem[]): number {
  return escolhas.reduce((s, e) => s + e.acrescimoCentavos, 0);
}

/** Grupos obrigatórios sem nenhuma escolha (e que ainda têm opção disponível). */
export function gruposPendentes(grupos: GrupoOpcoes[], escolhas: EscolhaItem[], info: Infos, unidades = 1): string[] {
  return grupos
    .filter((g) => g.obrigatorio && g.opcoes.some((o) => opcaoDisponivel(o, info, unidades)) && !escolhas.some((e) => e.grupoId === g.id))
    .map((g) => g.nome);
}

export function resumoEscolhas(escolhas: EscolhaItem[]): string {
  return escolhas.map((e) => `${e.grupoNome}: ${e.opcaoNome}`).join(' · ');
}
