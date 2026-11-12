// Temas festivos: cores, desenhos e datas das festividades. Muda sozinho na semana da data e volta ao padrão depois.
import { diasEntre, somarDias } from './equipamentos.ts';

export type Motivo = 'nenhum' | 'neve' | 'estrela' | 'coracao' | 'flor' | 'ovo' | 'bandeirinha' | 'balao' | 'folha' | 'confete';

export const MOTIVOS: Record<Motivo, string> = {
  nenhum: 'Sem desenho', neve: 'Flocos de neve', estrela: 'Brilhos', coracao: 'Corações', flor: 'Flores', ovo: 'Ovinhos',
  bandeirinha: 'Bandeirinhas', balao: 'Balões', folha: 'Folhas', confete: 'Confete',
};

export interface CoresTema {
  principal: string; // botões e destaques (modo claro)
  principalEscuro: string; // o mesmo, para o modo escuro
  apoio: string;
  menu: string;
}

export type RegraData =
  | { tipo: 'fixa'; mes: number; dia: number }
  | { tipo: 'pascoa'; delta: number } // dias a partir da Páscoa (Carnaval = -47)
  | { tipo: 'domingo'; mes: number; n: number } // n-ésimo domingo do mês
  | { tipo: 'blackfriday' }
  | { tipo: 'nenhuma' };

export interface TemaBase {
  id: string;
  nome: string;
  regra: RegraData;
  cores: CoresTema;
  motivo: Motivo;
  corMotivo: string;
  saudacao: string; // frase acolhedora no Início durante o tema
}

export interface TemaPersonalizado extends TemaBase {
  imagem: Blob | null;
  veu: number; // 40–95: quanto a cor de fundo cobre a imagem (para o texto continuar legível)
  ativo: boolean;
  atualizadoEm: string;
}

export const DIAS_ANTES = 7;
export const DIAS_DEPOIS = 5;
export const VEU_PADRAO = 82;

export const TEMAS_PRONTOS: TemaBase[] = [
  { id: 'anonovo', nome: 'Ano Novo', regra: { tipo: 'fixa', mes: 1, dia: 1 }, cores: { principal: '#8A6A1F', principalEscuro: '#D8B25E', apoio: '#E4E7F5', menu: '#1F2A4D' }, motivo: 'estrela', corMotivo: '#D8A776', saudacao: 'Feliz ano novo! Que venham páginas em branco cheias de histórias. ✨' },
  { id: 'carnaval', nome: 'Carnaval', regra: { tipo: 'pascoa', delta: -47 }, cores: { principal: '#9B4D96', principalEscuro: '#D58AD0', apoio: '#FBE3A6', menu: '#3E2A5E' }, motivo: 'confete', corMotivo: '#E7A6BE', saudacao: 'É Carnaval! Cores e alegria também nos cadernos do atelier. ✨' },
  { id: 'mulher', nome: 'Dia da Mulher', regra: { tipo: 'fixa', mes: 3, dia: 8 }, cores: { principal: '#8A4F9E', principalEscuro: '#C398C8', apoio: '#F1CDD9', menu: '#4A2E5F' }, motivo: 'flor', corMotivo: '#C398C8', saudacao: 'Dia Internacional da Mulher: uma boa data para presentear com algo feito à mão. 💜' },
  { id: 'pascoa', nome: 'Páscoa', regra: { tipo: 'pascoa', delta: 0 }, cores: { principal: '#4A7F6A', principalEscuro: '#A8D5C2', apoio: '#FBE3D6', menu: '#3A5A55' }, motivo: 'ovo', corMotivo: '#E7A6BE', saudacao: 'Feliz Páscoa! Cadernos e marcadores também são bons presentes. 🌸' },
  { id: 'maes', nome: 'Dia das Mães', regra: { tipo: 'domingo', mes: 5, n: 2 }, cores: { principal: '#B65C85', principalEscuro: '#E7A6BE', apoio: '#F9DDE6', menu: '#5A3A52' }, motivo: 'flor', corMotivo: '#E7A6BE', saudacao: 'Dia das Mães: presentes únicos, feitos com carinho. 🌸' },
  { id: 'namorados', nome: 'Dia dos Namorados', regra: { tipo: 'fixa', mes: 6, dia: 12 }, cores: { principal: '#B0405A', principalEscuro: '#EF8FA4', apoio: '#FBD5DC', menu: '#5A2A3A' }, motivo: 'coracao', corMotivo: '#E7A6BE', saudacao: 'Dia dos Namorados: personalize um presente para quem você ama. 💜' },
  { id: 'junina', nome: 'Festa Junina', regra: { tipo: 'fixa', mes: 6, dia: 24 }, cores: { principal: '#B5622E', principalEscuro: '#E8A265', apoio: '#FFE7B3', menu: '#5A3A22' }, motivo: 'bandeirinha', corMotivo: '#D8A776', saudacao: 'Festa junina chegando: o atelier também entra no clima. ✨' },
  { id: 'pais', nome: 'Dia dos Pais', regra: { tipo: 'domingo', mes: 8, n: 2 }, cores: { principal: '#35609A', principalEscuro: '#8FA8D2', apoio: '#CFE0F2', menu: '#24385C' }, motivo: 'estrela', corMotivo: '#92A8D1', saudacao: 'Dia dos Pais: cadernos e porta-canetas personalizados. 💙' },
  { id: 'criancas', nome: 'Dia das Crianças', regra: { tipo: 'fixa', mes: 10, dia: 12 }, cores: { principal: '#3F7F8C', principalEscuro: '#7FC8D0', apoio: '#FFE3A8', menu: '#2E4F5A' }, motivo: 'balao', corMotivo: '#92A8D1', saudacao: 'Dia das Crianças: papelaria colorida e divertida. ✨' },
  { id: 'professor', nome: 'Dia do Professor', regra: { tipo: 'fixa', mes: 10, dia: 15 }, cores: { principal: '#4F7F8C', principalEscuro: '#98B1C2', apoio: '#E3EFD9', menu: '#33505A' }, motivo: 'folha', corMotivo: '#98B1C2', saudacao: 'Dia do Professor: um presente útil e cheio de carinho. 📖' },
  { id: 'halloween', nome: 'Halloween', regra: { tipo: 'fixa', mes: 10, dia: 31 }, cores: { principal: '#A65A1E', principalEscuro: '#F0A25E', apoio: '#E4D2F0', menu: '#2A1F3A' }, motivo: 'estrela', corMotivo: '#F0A25E', saudacao: 'Halloween: um clima diferente por aqui. ✨' },
  { id: 'blackfriday', nome: 'Black Friday', regra: { tipo: 'blackfriday' }, cores: { principal: '#4A4E79', principalEscuro: '#A9B1C7', apoio: '#E5DFC9', menu: '#1E1B2B' }, motivo: 'estrela', corMotivo: '#D8A776', saudacao: 'Semana da Black Friday: pense com calma que condições combinam com o atelier. ✨' },
  { id: 'natal', nome: 'Natal', regra: { tipo: 'fixa', mes: 12, dia: 25 }, cores: { principal: '#A8443E', principalEscuro: '#E39A94', apoio: '#D6E6D3', menu: '#2F4A3A' }, motivo: 'neve', corMotivo: '#98B1C2', saudacao: 'Feliz Natal! Lembranças feitas à mão para quem você ama. 🤍' },
];

// ---------- datas ----------

const pad = (n: number) => String(n).padStart(2, '0');

/** n-ésimo dia da semana (0 = domingo) de um mês. */
function enesimo(ano: number, mes: number, diaSemana: number, n: number): string {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  return `${ano}-${pad(mes)}-${pad(1 + ((diaSemana - primeiro + 7) % 7) + (n - 1) * 7)}`;
}

/** Domingo de Páscoa (calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

export function dataDaRegra(r: RegraData, ano: number): string | null {
  switch (r.tipo) {
    case 'fixa': return `${ano}-${pad(r.mes)}-${pad(r.dia)}`;
    case 'pascoa': return somarDias(pascoa(ano), r.delta);
    case 'domingo': return enesimo(ano, r.mes, 0, r.n);
    case 'blackfriday': return somarDias(enesimo(ano, 11, 4, 4), 1);
    default: return null;
  }
}

export interface TemaDoDia { id: string; data: string; fim: string }

/**
 * Tema que vale hoje: começa `antes` dias antes da data e fica até `depois` dias depois.
 * Se duas festividades se encontram (Natal e Ano Novo), vale a que está mais perto de hoje.
 */
export function temaDoDia(temas: { id: string; regra: RegraData }[], hoje: string, antes = DIAS_ANTES, depois = DIAS_DEPOIS): TemaDoDia | null {
  const ano = Number(hoje.slice(0, 4));
  let melhor: { t: TemaDoDia; dist: number; futuro: number; ordem: number } | null = null;
  temas.forEach((tema, ordem) => {
    for (const a of [ano - 1, ano, ano + 1]) {
      const data = dataDaRegra(tema.regra, a);
      if (!data || hoje < somarDias(data, -antes) || hoje > somarDias(data, depois)) continue;
      const cand = { t: { id: tema.id, data, fim: somarDias(data, depois) }, dist: Math.abs(diasEntre(hoje, data)), futuro: data >= hoje ? 0 : 1, ordem };
      if (!melhor || cand.dist < melhor.dist || (cand.dist === melhor.dist && (cand.futuro < melhor.futuro || (cand.futuro === melhor.futuro && cand.ordem < melhor.ordem)))) melhor = cand;
    }
  });
  return melhor ? (melhor as { t: TemaDoDia }).t : null;
}

/** Próxima data do tema que ainda não terminou (ainda dentro do período de `depois` dias). */
export function proximaDataDoTema(r: RegraData, hoje: string, depois = DIAS_DEPOIS): string | null {
  const ano = Number(hoje.slice(0, 4));
  for (const a of [ano, ano + 1]) {
    const d = dataDaRegra(r, a);
    if (d && somarDias(d, depois) >= hoje) return d;
  }
  return null;
}

// ---------- qual tema está valendo ----------

export interface OpcoesDeTema {
  temaFestivo?: string; // 'automatico' (padrão), 'desligado' ou o id de um tema
  temaDiasAntes?: number;
  temaDiasDepois?: number;
}

export interface TemaResolvido {
  id: string;
  nome: string;
  cores: CoresTema;
  motivo: Motivo;
  corMotivo: string;
  saudacao: string;
  imagem: Blob | null;
  veu: number;
  personalizado: boolean;
  manual: boolean; // escolhido por você (não sai sozinho)
  fim: string | null; // último dia do tema automático
}

const limitarDias = (n: number | undefined, padrao: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(30, Math.max(0, Math.round(n))) : padrao);

const completar = (t: TemaBase | TemaPersonalizado, personalizado: boolean, manual: boolean, fim: string | null): TemaResolvido => ({
  id: t.id, nome: t.nome, cores: t.cores, motivo: t.motivo, corMotivo: t.corMotivo, saudacao: t.saudacao,
  imagem: personalizado ? (t as TemaPersonalizado).imagem ?? null : null,
  veu: personalizado ? (t as TemaPersonalizado).veu || VEU_PADRAO : VEU_PADRAO,
  personalizado, manual, fim,
});

export function resolverTema(o: OpcoesDeTema, personalizados: TemaPersonalizado[], hoje: string): TemaResolvido | null {
  const modo = o.temaFestivo ?? 'automatico';
  if (modo === 'desligado') return null;
  const meus = personalizados.filter((t) => t.ativo);
  const todos = [...meus.map((t) => ({ t, p: true })), ...TEMAS_PRONTOS.map((t) => ({ t, p: false }))];
  if (modo !== 'automatico') {
    const achado = todos.find((x) => x.t.id === modo);
    return achado ? completar(achado.t, achado.p, true, null) : null;
  }
  const dia = temaDoDia(todos.map((x) => ({ id: x.t.id, regra: x.t.regra })), hoje, limitarDias(o.temaDiasAntes, DIAS_ANTES), limitarDias(o.temaDiasDepois, DIAS_DEPOIS));
  if (!dia) return null;
  const achado = todos.find((x) => x.t.id === dia.id);
  return achado ? completar(achado.t, achado.p, false, dia.fim) : null;
}

// ---------- desenho de fundo ----------

const COR_VALIDA = /^#[0-9a-fA-F]{6}$/;

function desenho(m: Motivo, c: string): string {
  switch (m) {
    case 'estrela': return `<path d="M0,-10 C1,-2 2,-1 10,0 C2,1 1,2 0,10 C-1,2 -2,1 -10,0 C-2,-1 -1,-2 0,-10Z" fill="${c}"/>`;
    case 'coracao': return `<path d="M0,6 C-9,-1 -11,-6 -7,-9 C-4,-11 -1,-10 0,-7 C1,-10 4,-11 7,-9 C11,-6 9,-1 0,6Z" fill="${c}"/>`;
    case 'neve': return `<g stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M0,-10V10M-8.7,-5L8.7,5M-8.7,5L8.7,-5"/><path d="M-3,-8L0,-5L3,-8M-3,8L0,5L3,8"/></g>`;
    case 'flor': return `<g fill="${c}">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(Math.sin((a * Math.PI) / 180) * 6).toFixed(2)}" cy="${(-Math.cos((a * Math.PI) / 180) * 6).toFixed(2)}" r="4"/>`).join('')}<circle r="2.6" fill="#FFFFFF" opacity="0.7"/></g>`;
    case 'ovo': return `<g><ellipse rx="7" ry="9.5" fill="${c}"/><path d="M-7,1 L-3.5,-2 L0,1 L3.5,-2 L7,1" stroke="#FFFFFF" stroke-width="1.4" fill="none" opacity="0.7"/></g>`;
    case 'bandeirinha': return `<path d="M-9,-7 L9,-7 L0,9Z" fill="${c}"/>`;
    case 'balao': return `<g><ellipse cy="-2" rx="6.5" ry="8" fill="${c}"/><path d="M0,6 L-2,9 L2,9Z" fill="${c}"/><path d="M0,9 C3,12 -3,14 0,18" stroke="${c}" stroke-width="1" fill="none"/></g>`;
    case 'folha': return `<g><path d="M0,-10 C9,-4 9,6 0,10 C-9,6 -9,-4 0,-10Z" fill="${c}"/><path d="M0,-6 V8" stroke="#FFFFFF" stroke-width="1" opacity="0.6"/></g>`;
    case 'confete': return `<g fill="${c}"><rect x="-8" y="-6" width="6" height="3" rx="1" transform="rotate(25)"/><circle cx="6" cy="-4" r="2.2"/><rect x="2" y="4" width="6" height="3" rx="1" transform="rotate(-30 5 5)"/><circle cx="-5" cy="6" r="1.8"/></g>`;
    default: return '';
  }
}

/** Imagem de fundo (SVG repetido) para o desenho escolhido. Vazio se não há desenho. */
export function svgDoMotivo(m: Motivo, cor: string): string {
  if (m === 'nenhum') return '';
  const c = COR_VALIDA.test(cor) ? cor : '#C398C8';
  const d = desenho(m, c);
  if (!d) return '';
  const lugares: [number, number, number, number][] = [[28, 30, 1.3, -12], [112, 52, 1, 18], [62, 118, 1.5, 6], [140, 130, 0.9, -20]];
  const corpo = lugares.map(([x, y, e, r]) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${e})">${d}</g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g opacity="0.26">${corpo}</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Versão mais clara da cor principal, para o modo escuro dos temas criados por você. */
export function clarear(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const v = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(x + (255 - x) * 0.38));
  return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('');
}
