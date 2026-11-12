// Divulgação: calendário de publicações, datas para planejar, legendas na voz da marca e resultados.
// Regras de voz e hashtags: identidade visual da Craft Notes Unique (delicada, acolhedora, feita à mão; no máximo 3 emojis; até 5 hashtags).

import type { Linha } from './produtos.ts';
import { somarDias } from './equipamentos.ts';

export type CanalPost =
  | 'instagram_feed' | 'instagram_stories' | 'instagram_reels' | 'shopee' | 'mercado_livre' | 'site' | 'whatsapp' | 'outro';

export const CANAIS: Record<CanalPost, string> = {
  instagram_feed: 'Instagram · feed',
  instagram_stories: 'Instagram · stories',
  instagram_reels: 'Instagram · reels',
  shopee: 'Shopee',
  mercado_livre: 'Mercado Livre',
  site: 'Site',
  whatsapp: 'WhatsApp (status ou lista)',
  outro: 'Outro',
};

/** Tamanhos de referência da identidade visual. */
export const FORMATO_DO_CANAL: Record<CanalPost, string> = {
  instagram_feed: 'Feed: 1080×1350 (4:5) ou 1080×1080, fundo creme ou noturno com brilho suave.',
  instagram_stories: 'Stories: 1080×1920, com 250 px livres no topo e na base.',
  instagram_reels: 'Capa do reels: 1080×1920, com 250 px livres no topo e na base.',
  shopee: 'Capa de produto: 1200×1200, fundo branco ou creme, produto centralizado e pouco texto.',
  mercado_livre: 'Capa de produto: 1200×1200, fundo branco ou creme, produto centralizado e pouco texto.',
  site: 'Banner: 1920×600, com o gradiente lavanda para azul bem suave.',
  whatsapp: 'Imagem vertical 1080×1920 ou quadrada 1080×1080.',
  outro: '',
};

export type StatusPost = 'ideia' | 'criando' | 'pronto' | 'publicado' | 'descartado';
export const STATUS_POST: Record<StatusPost, string> = {
  ideia: 'Ideia', criando: 'Em criação', pronto: 'Pronto', publicado: 'Publicado', descartado: 'Descartado',
};

export type TipoLegenda = 'lancamento' | 'processo' | 'personalizacao' | 'depoimento' | 'data' | 'promocao';
export const TIPOS_LEGENDA: Record<TipoLegenda, string> = {
  lancamento: 'Lançamento de produto',
  processo: 'Bastidores e processo',
  personalizacao: 'Convite para personalizar',
  depoimento: 'Depoimento de cliente',
  data: 'Data comemorativa',
  promocao: 'Condição especial',
};

export interface Metricas {
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  compartilhamentos: number;
  mensagens: number; // conversas iniciadas a partir da publicação
}

export const METRICAS_ZERADAS: Metricas = { alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, mensagens: 0 };

export interface Publicacao {
  id: string;
  titulo: string;
  canal: CanalPost;
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM ou vazio
  status: StatusPost;
  tipo: TipoLegenda | '';
  produtoId: string | null;
  legenda: string;
  hashtags: string[];
  link: string;
  observacoes: string;
  imagens?: Blob[];
  metricas: Metricas;
  atualizadoEm: string;
}

// ---------- calendário ----------

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export function mesSeguinte(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export interface DiaDoCalendario {
  data: string; // AAAA-MM-DD
  doMes: boolean;
}

/** Semanas começando no domingo, cobrindo o mês inteiro. */
export function semanasDoMes(mes: string): DiaDoCalendario[][] {
  const primeiro = `${mes}-01`;
  const diaSemana = new Date(`${primeiro}T00:00:00Z`).getUTCDay(); // 0 = domingo
  const inicio = somarDias(primeiro, -diaSemana);
  const ultimo = somarDias(mesSeguinte(mes, 1) + '-01', -1);
  const semanas: DiaDoCalendario[][] = [];
  let atual = inicio;
  while (atual <= ultimo) {
    const semana: DiaDoCalendario[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push({ data: atual, doMes: atual.slice(0, 7) === mes });
      atual = somarDias(atual, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

// ---------- datas para planejar ----------

export interface DataComemorativa {
  data: string;
  nome: string;
  aproximada?: boolean;
}

/** n-ésimo dia da semana (0 = domingo) de um mês. */
function enesimoDiaDaSemana(ano: number, mes: number, diaSemana: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = 1 + ((diaSemana - primeiro + 7) % 7) + (n - 1) * 7;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Datas que costumam render bom conteúdo para papelaria e presentes. */
export function datasComemorativas(ano: number): DataComemorativa[] {
  const f = (m: number, d: number) => `${ano}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const quartaQuinta = enesimoDiaDaSemana(ano, 11, 4, 4); // 4ª quinta de novembro
  return [
    { data: f(2, 2), nome: 'Volta às aulas (início de fevereiro)', aproximada: true },
    { data: f(3, 8), nome: 'Dia Internacional da Mulher' },
    { data: f(4, 23), nome: 'Dia Mundial do Livro' },
    { data: enesimoDiaDaSemana(ano, 5, 0, 2), nome: 'Dia das Mães' },
    { data: f(6, 12), nome: 'Dia dos Namorados' },
    { data: enesimoDiaDaSemana(ano, 8, 0, 2), nome: 'Dia dos Pais' },
    { data: f(8, 11), nome: 'Dia do Estudante' },
    { data: f(10, 12), nome: 'Dia das Crianças' },
    { data: f(10, 15), nome: 'Dia do Professor' },
    { data: f(10, 29), nome: 'Dia Nacional do Livro' },
    { data: somarDias(quartaQuinta, 1), nome: 'Black Friday' },
    { data: f(12, 25), nome: 'Natal' },
  ].sort((a, b) => a.data.localeCompare(b.data));
}

/** Datas dos próximos `dias` dias (a partir de hoje), olhando também o ano seguinte. */
export function proximasDatas(hoje: string, dias: number): DataComemorativa[] {
  const ano = Number(hoje.slice(0, 4));
  const limite = somarDias(hoje, dias);
  return [...datasComemorativas(ano), ...datasComemorativas(ano + 1)].filter((d) => d.data >= hoje && d.data <= limite);
}

// ---------- hashtags ----------

/** Normaliza: minúsculas, sem espaços e símbolos, com # na frente, sem repetidas. */
export function limparHashtags(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const bruto of texto.split(/[\s,;]+/)) {
    const palavra = bruto.replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');
    if (!palavra || vistos.has(palavra)) continue;
    vistos.add(palavra);
    out.push(`#${palavra}`);
  }
  return out;
}

export function hashtagsPara(linha: Linha | null): string[] {
  if (linha === 'impressao3d') return ['#craftnotesunique', '#impressao3d', '#papelariapersonalizada'];
  return ['#craftnotesunique', '#encadernacaoartesanal', '#papelariapersonalizada', '#cadernopersonalizado'];
}

// ---------- legendas ----------

const CTAS = [
  'Conta pra gente como você imagina o seu, a gente transforma em realidade ✨',
  'Quer o seu? Chama a gente pra encomendar 💜',
  'Cada detalhe pode ser do seu jeito. É só chamar a gente 🌸',
];

export interface EntradaLegenda {
  tipo: TipoLegenda;
  produto: string; // nome do produto, ou o assunto da publicação
  linha: Linha | null;
  tema: string; // título da publicação (nome da data comemorativa, por exemplo)
  variacao: number;
}

/** Sugestão de legenda e hashtags na voz da marca. Texto-base para você ajustar, não um texto final. */
export function gerarLegenda(e: EntradaLegenda): { legenda: string; hashtags: string[] } {
  const v = ((e.variacao % 3) + 3) % 3;
  const P = e.produto.trim() || 'o novo item';
  const is3d = e.linha === 'impressao3d';
  const cta = CTAS[v];
  let corpo = '';

  switch (e.tipo) {
    case 'lancamento':
      corpo = [
        `${P} chegou ao atelier 🌸\n\nPensado com carinho, feito com capricho e com espaço para a sua história.`,
        `Novidade por aqui: ${P}.\n\nCada detalhe foi escolhido com cuidado, ${is3d ? 'da modelagem ao acabamento' : 'do papel ao acabamento'}.`,
        `Apresentando ${P} 💙\n\nUma peça do atelier para acompanhar o seu dia a dia, do seu jeito.`,
      ][v];
      break;
    case 'processo':
      corpo = is3d
        ? [
            `Bastidores do atelier: ${P} ganhando forma, camada por camada. ✨`,
            `Olha só como ${P} nasce aqui no atelier, camada por camada.`,
            `Do arquivo ao objeto: ${P} sendo impresso com calma e capricho. 🤍`,
          ][v]
        : [
            `Bastidores do atelier: ${P} sendo montado, página por página, com o capricho de sempre. 📖`,
            `Olha só como ${P} nasce aqui no atelier: papel escolhido com cuidado e muito detalhe.`,
            `Um pouquinho do processo de ${P}: tudo feito com calma e com carinho. 🤍`,
          ][v];
      break;
    case 'personalizacao':
      corpo = is3d
        ? `${P} pode ter a sua cara: cores e detalhes escolhidos por você.\n\nCada pedido é único, assim como a sua história.`
        : `${P} pode ter a sua cara: nome na capa, cores, modelo e adesivos escolhidos por você.\n\nCada pedido é único, assim como a sua história.`;
      break;
    case 'depoimento':
      corpo = '“[cole aqui o depoimento]”\n\nObrigada, [nome do cliente], por escolher o atelier! 💜 Receber o carinho de quem usa o que a gente faz é o que faz tudo valer a pena.';
      break;
    case 'data':
      corpo = `${e.tema.trim() || '[nome da data]'}: uma boa hora para presentear com algo feito à mão e pensado para quem você ama. 🤍`;
      break;
    case 'promocao':
      corpo = `Condição especial no atelier para ${P}.\n\n[escreva aqui a condição e até quando vale]`;
      break;
  }

  const semCta = e.tipo === 'depoimento';
  const texto = semCta ? corpo : `${corpo}\n\n${cta}`;
  return { legenda: texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1), hashtags: hashtagsPara(e.linha) };
}

// ---------- conferência com a identidade da marca ----------

export interface Alerta {
  texto: string;
}

/** Confere a legenda e as hashtags com as regras de voz da marca. Devolve avisos, não bloqueios. */
export function conferirComAMarca(legenda: string, hashtags: string[]): string[] {
  const avisos: string[] = [];
  const emojis = (legenda.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emojis > 3) avisos.push(`Há ${emojis} emojis. A marca usa no máximo 2 ou 3, da família 🌸 📖 ✨ 💜 💙 🤍.`);
  if (/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/.test(legenda)) avisos.push('Há palavras em caixa-alta. A marca evita gritar; prefira o tom acolhedor.');
  if (/!{2,}/.test(legenda)) avisos.push('Muitas exclamações seguidas. Prefira um tom calmo.');
  if (/últimas?\s+unidades|só hoje|corre\b|imperdível|aproveite já/i.test(legenda)) avisos.push('Há urgência agressiva (“últimas unidades”, “corre”…). A marca convida, não pressiona.');
  if (/prezad[oa]|soluções|produtos? de linha|fabricado em série|\bgenérico\b/i.test(legenda)) avisos.push('Há termos corporativos ou de produção em massa. Prefira “feito à mão”, “sob medida”, “com carinho”.');
  if (/\[[^\]]+\]/.test(legenda)) avisos.push('Ainda há trechos entre colchetes para completar.');
  if (hashtags.length > 5) avisos.push(`Há ${hashtags.length} hashtags. A marca usa até 5, as mais relevantes.`);
  if (legenda.trim() === '') avisos.push('A legenda está vazia.');
  return avisos;
}

// ---------- resultados ----------

export function engajamento(m: Metricas): number {
  return m.curtidas + m.comentarios + m.salvamentos + m.compartilhamentos;
}

export interface ResumoResultados {
  publicados: number;
  alcance: number;
  engajamento: number;
  mensagens: number;
  melhor: Publicacao | null; // maior engajamento
}

export function resumirResultados(posts: Publicacao[]): ResumoResultados {
  const publicados = posts.filter((p) => p.status === 'publicado');
  let melhor: Publicacao | null = null;
  for (const p of publicados) if (!melhor || engajamento(p.metricas) > engajamento(melhor.metricas)) melhor = p;
  return {
    publicados: publicados.length,
    alcance: publicados.reduce((s, p) => s + p.metricas.alcance, 0),
    engajamento: publicados.reduce((s, p) => s + engajamento(p.metricas), 0),
    mensagens: publicados.reduce((s, p) => s + p.metricas.mensagens, 0),
    melhor: melhor && engajamento(melhor.metricas) > 0 ? melhor : null,
  };
}

/** Só endereços http(s) viram link clicável. */
export function enderecoSeguro(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Texto pronto para colar na rede: legenda, linha em branco e hashtags. */
export function textoParaCopiar(p: Pick<Publicacao, 'legenda' | 'hashtags'>): string {
  return [p.legenda.trim(), p.hashtags.join(' ')].filter(Boolean).join('\n\n');
}
