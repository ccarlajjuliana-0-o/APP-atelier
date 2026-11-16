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
  pedeTexto?: string; // pergunta de texto ao marcar a opção (ex.: "Qual nome na capa?")
  variantes?: string[]; // materiais do estoque entre os quais o cliente escolhe (ex.: tipos de cantoneira); só aparecem os que têm estoque
}

export type TipoGrupo = 'unica' | 'multipla' | 'texto' | 'paragrafo' | 'email' | 'secao';
export const TIPOS_GRUPO: Record<TipoGrupo, string> = {
  unica: 'Escolhe uma', multipla: 'Pode escolher várias', texto: 'Resposta curta', paragrafo: 'Resposta longa', email: 'E-mail', secao: 'Título de seção',
};
export const ehEscolha = (t: TipoGrupo) => t === 'unica' || t === 'multipla';
export const ehTexto = (t: TipoGrupo) => t === 'texto' || t === 'paragrafo' || t === 'email';
export const ID_OUTRO = '__outro';
export const ID_TEXTO = '__texto';

export interface GrupoOpcoes {
  id: string;
  nome: string;
  descricao?: string;
  tipo: TipoGrupo;
  obrigatorio: boolean;
  permiteOutro?: boolean; // campo "Outro:" nas perguntas de escolha
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
  outro?: boolean; // resposta digitada em "Outro"
  texto?: string; // resposta de texto da opção (ex.: o nome na capa)
}

type Infos = Record<string, InfoMaterial>;

function qtdDaOpcao(o: OpcaoProduto): number {
  return qtdEfetiva({ materialId: o.materialId ?? '', quantidade: o.quantidade, desperdicioPct: o.desperdicioPct, extra: false });
}

export function acrescimoDaOpcao(o: OpcaoProduto, info: Infos, multiplicador: number, materialId: string | null = o.materialId): number {
  if (o.acrescimoCentavos !== null) return Math.max(0, Math.round(o.acrescimoCentavos));
  if (!materialId) return 0;
  const m = info[materialId];
  if (!m) return 0;
  return Math.round(microParaCentavos(qtdDaOpcao(o) * m.custoMicro) * Math.max(1, multiplicador));
}

/** Opção sem material sempre aparece; com material, só se o estoque disponível cobre as unidades pedidas. */
export function opcaoDisponivel(o: OpcaoProduto, info: Infos, unidades = 1): boolean {
  if (o.variantes?.length) return variantesDisponiveis(o, info, unidades).length > 0;
  return materialCobre(o, o.materialId, info, unidades);
}

function materialCobre(o: OpcaoProduto, materialId: string | null, info: Infos, unidades: number): boolean {
  if (!materialId) return true;
  const m = info[materialId];
  if (!m) return false;
  const q = qtdDaOpcao(o) * Math.max(1, unidades);
  return q <= 0 || m.disponivel + 1e-9 >= q;
}

/** Tipos (materiais) da opção que ainda têm estoque para as unidades pedidas. */
export function variantesDisponiveis(o: OpcaoProduto, info: Infos, unidades = 1): string[] {
  return (o.variantes ?? []).filter((id) => materialCobre(o, id, info, unidades));
}

export function criarEscolha(g: GrupoOpcoes, o: OpcaoProduto, info: Infos, multiplicador: number, variante?: string, unidades = 1, texto = ''): EscolhaItem {
  const temVar = !!o.variantes?.length;
  const mid = temVar ? (variante ?? variantesDisponiveis(o, info, unidades)[0] ?? o.variantes![0]) : o.materialId;
  return {
    grupoId: g.id, grupoNome: g.nome, opcaoId: o.id,
    opcaoNome: (temVar && mid ? `${o.nome} · ${info[mid]?.nome ?? ''}` : o.nome) + (o.pedeTexto && texto.trim() ? `: ${texto.trim()}` : ''),
    ...(o.pedeTexto ? { texto: texto.trim() } : {}),
    materialId: mid, quantidade: mid ? qtdDaOpcao(o) : 0, acrescimoCentavos: acrescimoDaOpcao(o, info, multiplicador, mid),
  };
}

/** Troca o tipo (material) de uma opção já marcada. */
export function trocarVariante(escolhas: EscolhaItem[], g: GrupoOpcoes, o: OpcaoProduto, materialId: string, info: Infos, multiplicador: number): EscolhaItem[] {
  return escolhas.map((e) => (e.grupoId === g.id && e.opcaoId === o.id ? criarEscolha(g, o, info, multiplicador, materialId, 1, e.texto ?? '') : e));
}

/** Texto de uma opção que pede resposta (ex.: nome na capa). */
export function definirTextoDaOpcao(escolhas: EscolhaItem[], g: GrupoOpcoes, o: OpcaoProduto, texto: string, info: Infos, multiplicador: number): EscolhaItem[] {
  return escolhas.map((e) => (e.grupoId === g.id && e.opcaoId === o.id ? criarEscolha(g, o, info, multiplicador, e.materialId ?? undefined, 1, texto) : e));
}

/** Resposta de texto (curta, longa ou e-mail). Vazia remove a resposta. */
export function definirTexto(escolhas: EscolhaItem[], g: GrupoOpcoes, texto: string): EscolhaItem[] {
  const resto = escolhas.filter((e) => e.grupoId !== g.id);
  if (!texto.trim()) return resto;
  return [...resto, { grupoId: g.id, grupoNome: g.nome, opcaoId: ID_TEXTO, opcaoNome: texto, materialId: null, quantidade: 0, acrescimoCentavos: 0 }];
}

/** "Outro:" — texto null desmarca; em grupo de escolha única, marcar troca as demais. */
export function definirOutro(escolhas: EscolhaItem[], g: GrupoOpcoes, texto: string | null): EscolhaItem[] {
  const base = escolhas.filter((e) => !(e.grupoId === g.id && (e.opcaoId === ID_OUTRO || (texto !== null && g.tipo === 'unica'))));
  if (texto === null) return base;
  return [...base, { grupoId: g.id, grupoNome: g.nome, opcaoId: ID_OUTRO, opcaoNome: texto.trim() || 'Outro', materialId: null, quantidade: 0, acrescimoCentavos: 0, outro: true }];
}

/** Escolhas iniciais: as opções marcadas como padrão que estão disponíveis. */
export function escolhasPadrao(grupos: GrupoOpcoes[], info: Infos, multiplicador: number, unidades = 1): EscolhaItem[] {
  const out: EscolhaItem[] = [];
  for (const g of grupos) {
    if (!ehEscolha(g.tipo)) continue;
    const ok = g.opcoes.filter((o) => o.padrao && opcaoDisponivel(o, info, unidades));
    for (const o of g.tipo === 'unica' ? ok.slice(0, 1) : ok) out.push(criarEscolha(g, o, info, multiplicador));
  }
  return out;
}

/** Alterna uma opção: em grupo de escolha única troca; em múltipla liga/desliga (única pode ser desmarcada se não obrigatória). */
export function alternarEscolha(escolhas: EscolhaItem[], g: GrupoOpcoes, o: OpcaoProduto, info: Infos, multiplicador: number, unidades = 1): EscolhaItem[] {
  const marcada = escolhas.some((e) => e.grupoId === g.id && e.opcaoId === o.id);
  const resto = escolhas.filter((e) => !(e.grupoId === g.id && (g.tipo === 'unica' || e.opcaoId === o.id)));
  if (marcada) return g.obrigatorio && g.tipo === 'unica' ? escolhas : resto;
  // marcar uma opção em escolha única também desfaz um "Outro" digitado
  return [...resto, criarEscolha(g, o, info, multiplicador, undefined, unidades)];
}

export function acrescimoTotal(escolhas: EscolhaItem[]): number {
  return escolhas.reduce((s, e) => s + e.acrescimoCentavos, 0);
}

/** Grupos obrigatórios sem nenhuma escolha (e que ainda têm opção disponível). */
export function gruposPendentes(grupos: GrupoOpcoes[], escolhas: EscolhaItem[], info: Infos, unidades = 1): string[] {
  const semTexto = grupos.flatMap((g) => g.opcoes
    .filter((o) => o.pedeTexto && escolhas.some((e) => e.grupoId === g.id && e.opcaoId === o.id && !e.texto?.trim()))
    .map((o) => `${g.nome} (${o.pedeTexto})`));
  const faltam = grupos
    .filter((g) => g.obrigatorio && g.tipo !== 'secao' && !escolhas.some((e) => e.grupoId === g.id)
      && (!ehEscolha(g.tipo) || g.permiteOutro || g.opcoes.some((o) => opcaoDisponivel(o, info, unidades))))
    .map((g) => g.nome);
  return [...faltam, ...semTexto];
}

export function resumoEscolhas(escolhas: EscolhaItem[]): string {
  return linhasDeEscolhas(escolhas).join(' · ');
}

/** Uma linha por pergunta (várias opções de uma mesma pergunta ficam juntas). */
export function linhasDeEscolhas(escolhas: EscolhaItem[]): string[] {
  const ordem: string[] = [];
  const por: Record<string, { nome: string; vals: string[] }> = {};
  for (const e of escolhas) {
    if (!por[e.grupoId]) { por[e.grupoId] = { nome: e.grupoNome, vals: [] }; ordem.push(e.grupoId); }
    por[e.grupoId].vals.push(e.opcaoNome);
  }
  return ordem.map((id) => `${por[id].nome}: ${por[id].vals.join(', ')}`);
}
