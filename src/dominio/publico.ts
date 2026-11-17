// Formulário público: o que a cliente vê (cópia sem dados internos), o que ela envia e como o envio vira escolhas do orçamento.
import {
  acrescimoDaOpcao, criarEscolha, definirOutro, definirTexto, ehEscolha, ehTexto, grupoVisivel, ID_OUTRO, ID_TEXTO, opcaoDisponivel, podarEscolhas,
  type EscolhaItem, type GrupoOpcoes, type OpcaoProduto,
} from './opcoes.ts';
import { extrasComoGrupo, type ExtraCatalogo } from './extras.ts';
import type { InfoMaterial } from './produtos.ts';

type Infos = Record<string, InfoMaterial>;

export const MAX_QUANTIDADE = 50;
export const SEGUNDOS_MINIMOS = 5;

/** Cópia do formulário para a cliente: sem materiais, quantidades, perdas nem custos; só preço de cada opção e o que tem em estoque. */
export interface FormularioPublicado {
  versao: 1;
  publicadoEm: string;
  titulo: string;
  boasVindas: string;
  grupos: GrupoOpcoes[];
  nomes: Record<string, string>; // tipos (variantes) disponíveis: id → nome para mostrar
}

export const TITULO_PADRAO = 'Peça o seu personalizado';
export const BOAS_VINDAS_PADRAO = 'Conte como você imagina o seu e a gente transforma em realidade. Depois de enviar, eu entro em contato para confirmar os detalhes e o valor final. 🌸';

export function montarPublicacao(
  grupos: GrupoOpcoes[], extras: ExtraCatalogo[], info: Infos, mult: number, agora: string,
  titulo = TITULO_PADRAO, boasVindas = BOAS_VINDAS_PADRAO,
): FormularioPublicado {
  const nomes: Record<string, string> = {};
  const todos = [...grupos];
  const gx = extrasComoGrupo(extras);
  if (gx.opcoes.length) todos.push(gx);

  const limpas = todos.map((g): GrupoOpcoes => {
    const opcoes = ehEscolha(g.tipo)
      ? g.opcoes.filter((o) => opcaoDisponivel(o, info, 1)).map((o): OpcaoProduto => {
        const vars = (o.variantes ?? []).filter((id) => opcaoDisponivel({ ...o, variantes: undefined, materialId: id }, info, 1));
        for (const id of vars) nomes[id] = info[id]?.nome ?? '';
        return {
          id: o.id, nome: o.nome, materialId: null, quantidade: 0, desperdicioPct: 0,
          acrescimoCentavos: acrescimoDaOpcao(o, info, mult, vars.length ? vars[0] : o.materialId),
          padrao: o.padrao,
          ...(o.pedeTexto ? { pedeTexto: o.pedeTexto } : {}),
          ...(vars.length ? { variantes: vars } : {}),
        };
      })
      : [];
    return {
      id: g.id, nome: g.nome, tipo: g.tipo, obrigatorio: g.obrigatorio,
      ...(g.descricao ? { descricao: g.descricao } : {}),
      ...(g.permiteOutro ? { permiteOutro: true } : {}),
      ...(g.mostrarSe ? { mostrarSe: g.mostrarSe } : {}),
      ...(g.maxSelecao ? { maxSelecao: g.maxSelecao } : {}),
      opcoes,
    };
  });
  return { versao: 1, publicadoEm: agora, titulo, boasVindas, grupos: limpas, nomes };
}

/** Info "de mentira" para a página pública: tudo que foi publicado conta como disponível e sem custo (o preço já vem em cada opção). */
export function infoPublica(pub: FormularioPublicado): Infos {
  return Object.fromEntries(Object.entries(pub.nomes).map(([id, nome]) => [id, { nome, custoMicro: 0, disponivel: 1e9 }]));
}

export interface EnvioEscolha {
  grupoId: string;
  opcaoId: string;
  opcaoNome: string;
  texto?: string;
  materialId?: string | null;
  outro?: boolean;
}

export interface EnvioPublico {
  nome: string;
  contato: string;
  quantidade: number;
  observacao: string;
  escolhas: EnvioEscolha[];
  versao: string; // publicadoEm do formulário que ela viu
  abertoEm: number; // ms: quando abriu a página (a função recusa envio rápido demais)
  site: string; // campo escondido: robôs preenchem, pessoas não
}

export function paraEnvio(escolhas: EscolhaItem[]): EnvioEscolha[] {
  return escolhas.map((e) => ({
    grupoId: e.grupoId, opcaoId: e.opcaoId, opcaoNome: e.opcaoNome.slice(0, 500),
    ...(e.texto ? { texto: e.texto.slice(0, 300) } : {}),
    ...(e.materialId ? { materialId: e.materialId } : {}),
    ...(e.outro ? { outro: true } : {}),
  }));
}

/** O que falta para a cliente poder enviar. Vazio = pode. */
export function problemaNoEnvio(e: { nome: string; contato: string; quantidade: number }, pendentes: string[]): string {
  if (!e.nome.trim()) return 'Conte o seu nome, para eu saber com quem falo.';
  if (!e.contato.trim()) return 'Deixe um WhatsApp ou e-mail para eu te responder.';
  if (!Number.isFinite(e.quantidade) || e.quantidade < 1 || e.quantidade > MAX_QUANTIDADE) return `A quantidade precisa ser de 1 a ${MAX_QUANTIDADE}.`;
  if (pendentes.length) return `Falta responder: ${pendentes.join(', ')}.`;
  return '';
}

/**
 * Do envio da cliente para escolhas do orçamento, usando as perguntas e os preços de HOJE da dona
 * (o que a cliente mandou só diz "qual opção"; nome de grupo, nome de opção e preço vêm do app).
 */
export function escolhasDaSolicitacao(grupos: GrupoOpcoes[], enviadas: EnvioEscolha[], info: Infos, mult: number): { escolhas: EscolhaItem[]; ignoradas: string[] } {
  let escolhas: EscolhaItem[] = [];
  const ignoradas: string[] = [];
  for (const env of Array.isArray(enviadas) ? enviadas : []) {
    const g = grupos.find((x) => x.id === env.grupoId);
    if (!g) { ignoradas.push(String(env.opcaoNome ?? '').slice(0, 80)); continue; }
    if (env.opcaoId === ID_TEXTO) {
      if (ehTexto(g.tipo)) escolhas = definirTexto(escolhas, g, String(env.opcaoNome ?? '').slice(0, 500));
      continue;
    }
    if (env.opcaoId === ID_OUTRO || env.outro) {
      if (ehEscolha(g.tipo) && g.permiteOutro) escolhas = definirOutro(escolhas, g, String(env.opcaoNome ?? '').slice(0, 300));
      continue;
    }
    const o = g.opcoes.find((x) => x.id === env.opcaoId);
    if (!o || !ehEscolha(g.tipo)) { ignoradas.push(String(env.opcaoNome ?? '').slice(0, 80)); continue; }
    const variante = o.variantes?.includes(env.materialId ?? '') ? (env.materialId as string) : undefined;
    const nova = criarEscolha(g, o, info, mult, variante, 1, o.pedeTexto ? String(env.texto ?? '') : '');
    escolhas = escolhas.filter((e) => !(e.grupoId === g.id && (g.tipo === 'unica' || e.opcaoId === o.id)));
    if (g.tipo === 'multipla' && g.maxSelecao && escolhas.filter((e) => e.grupoId === g.id).length >= g.maxSelecao) { ignoradas.push(nova.opcaoNome); continue; }
    escolhas.push(nova);
  }
  return { escolhas: podarEscolhas(grupos, escolhas), ignoradas };
}

/** Quais perguntas obrigatórias ainda estão sem resposta (para a página pública, que não tem estoque para consultar). */
export function pendentesPublicos(pub: FormularioPublicado, escolhas: EscolhaItem[]): string[] {
  const visiveis = pub.grupos.filter((g) => grupoVisivel(g, pub.grupos, escolhas));
  const faltam = visiveis.filter((g) => g.obrigatorio && g.tipo !== 'secao' && !escolhas.some((e) => e.grupoId === g.id)
    && (!ehEscolha(g.tipo) || g.permiteOutro || g.opcoes.length > 0)).map((g) => g.nome);
  const semTexto = visiveis.flatMap((g) => g.opcoes
    .filter((o) => o.pedeTexto && escolhas.some((e) => e.grupoId === g.id && e.opcaoId === o.id && !e.texto?.trim()))
    .map((o) => `${g.nome} (${o.pedeTexto})`));
  return [...faltam, ...semTexto];
}

/** Link da página pública a partir do endereço em que o app está aberto. */
export function linkPublico(origem: string, caminho: string): string {
  return `${origem}${caminho.replace(/#.*$/, '')}#/pedido`;
}

export const ehRotaPublica = (hash: string): boolean => /^#\/pedido\/?$/.test(hash);
