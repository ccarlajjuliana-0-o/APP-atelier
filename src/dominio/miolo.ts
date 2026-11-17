// Editor de miolos: gera as páginas (linhas, pontos, quadrados e textos em milímetros) a partir de um modelo e das suas escolhas.
// As páginas são feitas de peças simples (Elemento), que servem tanto para a prévia na tela quanto para o PDF.

export type ModeloMiolo = 'pautado' | 'pontilhado' | 'quadriculado' | 'liso' | 'semanal' | 'mensal' | 'diario1' | 'diario2' | 'habitos' | 'checklist' | 'reflexao';

export const MODELOS_MIOLO: Record<ModeloMiolo, { nome: string; grupo: string; dica: string }> = {
  pautado: { nome: 'Pautado', grupo: 'Caderno', dica: 'Linhas horizontais.' },
  pontilhado: { nome: 'Pontilhado', grupo: 'Caderno', dica: 'Grade de pontinhos.' },
  quadriculado: { nome: 'Quadriculado', grupo: 'Caderno', dica: 'Grade de quadradinhos.' },
  liso: { nome: 'Liso', grupo: 'Caderno', dica: 'Página em branco.' },
  semanal: { nome: 'Semanal', grupo: 'Planner', dica: 'Uma semana por página, com foco e os 7 dias.' },
  mensal: { nome: 'Mensal', grupo: 'Planner', dica: 'Calendário do mês e notas.' },
  diario1: { nome: 'Diário (1 dia por página)', grupo: 'Planner', dica: 'Prioridades, agenda por hora e anotações.' },
  diario2: { nome: 'Diário (2 dias por página)', grupo: 'Planner', dica: 'Dois dias por página, com linhas para escrever.' },
  habitos: { nome: 'Hábitos do mês', grupo: 'Extras', dica: 'Tabela de hábitos por dia do mês.' },
  checklist: { nome: 'Checklist', grupo: 'Extras', dica: 'Lista de tarefas com quadradinhos.' },
  reflexao: { nome: 'Reflexão semanal', grupo: 'Extras', dica: 'Perguntas para refletir sobre a semana.' },
};

export type TamanhoMiolo = 'A4' | 'A5' | 'A6' | 'Colegial';
export const TAMANHOS_MIOLO: Record<TamanhoMiolo, { l: number; a: number; nome: string }> = {
  A4: { l: 210, a: 297, nome: 'A4 (21 × 29,7 cm)' },
  A5: { l: 148, a: 210, nome: 'A5 (14,8 × 21 cm)' },
  A6: { l: 105, a: 148, nome: 'A6 (10,5 × 14,8 cm)' },
  Colegial: { l: 170, a: 230, nome: 'Colegial (17 × 23 cm)' },
};

export type FonteMiolo = 'sans' | 'serif';
export const FONTES_MIOLO: Record<FonteMiolo, string> = { sans: 'Moderna (sem serifa)', serif: 'Clássica (com serifa)' };

export interface ConfigMiolo {
  modelo: ModeloMiolo;
  tamanho: TamanhoMiolo;
  paginas: number;
  margemInternaMm: number; // lado da encadernação
  margemExternaMm: number;
  margemSuperiorMm: number;
  margemInferiorMm: number;
  cor: string; // linhas e pontos
  corTexto: string;
  espacamentoMm: number; // pautado, pontilhado e quadriculado
  espessuraMm: number;
  titulo: string; // cabeçalho opcional
  fonte: FonteMiolo;
  numeracao: boolean;
  datado: boolean;
  inicio: string; // AAAA-MM-DD: primeiro dia (semanal/diário) ou mês (mensal e hábitos)
  semanaComecaNaSegunda: boolean;
  habitos: number; // linhas da tabela de hábitos
}

export const CONFIG_PADRAO: ConfigMiolo = {
  modelo: 'pautado', tamanho: 'A5', paginas: 96, margemInternaMm: 14, margemExternaMm: 9, margemSuperiorMm: 12, margemInferiorMm: 14,
  cor: '#B9AFC6', corTexto: '#5A4A6B', espacamentoMm: 7, espessuraMm: 0.2, titulo: '', fonte: 'sans', numeracao: true,
  datado: false, inicio: '', semanaComecaNaSegunda: true, habitos: 10,
};

/** Espaçamento sugerido ao trocar de modelo. */
export function espacamentoSugerido(m: ModeloMiolo): number {
  return m === 'pontilhado' || m === 'quadriculado' ? 5 : 7;
}

// ---------- peças ----------

export type Elemento =
  | { t: 'linha'; x1: number; y1: number; x2: number; y2: number; cor: string; esp: number }
  | { t: 'ret'; x: number; y: number; w: number; h: number; cor: string; esp: number; preenche?: string }
  | { t: 'ponto'; x: number; y: number; d: number; cor: string }
  | { t: 'texto'; x: number; y: number; texto: string; tam: number; cor: string; alinhar: 'e' | 'c' | 'd'; negrito?: boolean; fonte: FonteMiolo };

export interface PaginaMiolo {
  numero: number; // 1 = primeira página
  larguraMm: number;
  alturaMm: number;
  itens: Elemento[];
}

// ---------- calendário (sem fuso: tudo em UTC) ----------

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function partes(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function emDias(iso: string): number {
  const [a, m, d] = partes(iso);
  return Math.round(Date.UTC(a, m - 1, d) / 86400000);
}
function deDias(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export const somarDias = (iso: string, n: number): string => deDias(emDias(iso) + n);
export const diaDaSemana = (iso: string): number => (((emDias(iso) + 4) % 7) + 7) % 7; // 0 = domingo
export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // mes de 1 a 12
}
export function somarMeses(iso: string, n: number): string {
  const [a, m] = partes(iso);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}
/** Primeiro dia da semana que contém a data. */
export function inicioDaSemana(iso: string, segunda: boolean): string {
  const dow = diaDaSemana(iso);
  const recuo = segunda ? (dow + 6) % 7 : dow;
  return somarDias(iso, -recuo);
}
function dm(iso: string): string {
  const [, m, d] = partes(iso);
  return `${d} de ${MESES[m - 1].toLowerCase()}`;
}
/** "17 a 23 de novembro" ou "28 de novembro a 4 de dezembro". */
export function intervaloDaSemana(ini: string): string {
  const fim = somarDias(ini, 6);
  const [, m1, d1] = partes(ini);
  const [, m2, d2] = partes(fim);
  return m1 === m2 ? `${d1} a ${d2} de ${MESES[m2 - 1].toLowerCase()}` : `${dm(ini)} a ${dm(fim)}`;
}

/** Hoje, para sugerir o início. */
export function inicioPadrao(modelo: ModeloMiolo, hojeIso: string, segunda: boolean): string {
  if (modelo === 'mensal' || modelo === 'habitos') return `${hojeIso.slice(0, 7)}-01`;
  if (modelo === 'semanal' || modelo === 'reflexao') return inicioDaSemana(hojeIso, segunda);
  return hojeIso;
}

// ---------- geração ----------

interface Caixa { x0: number; x1: number; y0: number; y1: number; w: number; h: number }

class Pagina {
  itens: Elemento[] = [];
  cfg: ConfigMiolo;
  numero: number;
  W: number;
  H: number;
  c: Caixa;
  constructor(cfg: ConfigMiolo, numero: number, W: number, H: number, c: Caixa) {
    this.cfg = cfg; this.numero = numero; this.W = W; this.H = H; this.c = c;
  }
  linha(x1: number, y1: number, x2: number, y2: number, cor = this.cfg.cor, esp = this.cfg.espessuraMm) {
    this.itens.push({ t: 'linha', x1, y1, x2, y2, cor, esp });
  }
  ret(x: number, y: number, w: number, h: number, cor = this.cfg.cor, esp = this.cfg.espessuraMm, preenche?: string) {
    this.itens.push({ t: 'ret', x, y, w, h, cor, esp, ...(preenche ? { preenche } : {}) });
  }
  ponto(x: number, y: number, d: number) { this.itens.push({ t: 'ponto', x, y, d, cor: this.cfg.cor }); }
  texto(x: number, y: number, texto: string, tam: number, alinhar: 'e' | 'c' | 'd' = 'e', negrito = false, cor = this.cfg.corTexto) {
    this.itens.push({ t: 'texto', x, y, texto, tam, cor, alinhar, negrito, fonte: this.cfg.fonte });
  }
}

const recto = (numero: number) => numero % 2 === 1;

function caixaDa(cfg: ConfigMiolo, numero: number, W: number, H: number): Caixa {
  const esq = recto(numero) ? cfg.margemInternaMm : cfg.margemExternaMm;
  const dir = recto(numero) ? cfg.margemExternaMm : cfg.margemInternaMm;
  const x0 = Math.min(esq, W / 3);
  const x1 = W - Math.min(dir, W / 3);
  const y0 = Math.min(cfg.margemSuperiorMm, H / 4);
  const y1 = H - Math.min(cfg.margemInferiorMm, H / 4);
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

/** Cabeçalho da página: devolve onde o conteúdo pode começar. */
function cabecalho(p: Pagina, titulo: string, sub = ''): number {
  const { x0, x1, y0 } = p.c;
  if (!titulo && !sub) return y0;
  let y = y0;
  if (titulo) {
    p.texto(x0, y + 4.5, titulo, 13, 'e', true);
    y += 7;
  }
  if (sub) {
    p.texto(x0, y + 3.5, sub, 8.5, 'e', false);
    y += 5.5;
  }
  p.linha(x0, y + 1, x1, y + 1, p.cfg.cor, 0.3);
  return y + 4;
}

function rodape(p: Pagina) {
  if (!p.cfg.numeracao) return;
  const y = p.H - Math.max(4, Math.min(p.cfg.margemInferiorMm, p.H / 4) / 2.6);
  p.texto(p.W / 2, y, String(p.numero), 7, 'c', false);
}

function pautado(p: Pagina) {
  const y = cabecalho(p, p.cfg.titulo);
  const e = Math.max(2.5, p.cfg.espacamentoMm);
  const n = Math.floor((p.c.y1 - y) / e);
  for (let k = 1; k <= n; k++) p.linha(p.c.x0, y + k * e, p.c.x1, y + k * e);
}

function pontilhado(p: Pagina) {
  const y = cabecalho(p, p.cfg.titulo);
  const e = Math.max(2.5, p.cfg.espacamentoMm);
  const nx = Math.floor(p.c.w / e);
  const ny = Math.floor((p.c.y1 - y) / e);
  const ox = p.c.x0 + (p.c.w - nx * e) / 2;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) p.ponto(ox + i * e, y + j * e, Math.max(0.35, p.cfg.espessuraMm * 2));
}

function quadriculado(p: Pagina) {
  const y = cabecalho(p, p.cfg.titulo);
  const e = Math.max(2.5, p.cfg.espacamentoMm);
  const nx = Math.floor(p.c.w / e);
  const ny = Math.floor((p.c.y1 - y) / e);
  const ox = p.c.x0 + (p.c.w - nx * e) / 2;
  for (let i = 0; i <= nx; i++) p.linha(ox + i * e, y, ox + i * e, y + ny * e);
  for (let j = 0; j <= ny; j++) p.linha(ox, y + j * e, ox + nx * e, y + j * e);
}

function liso(p: Pagina) {
  cabecalho(p, p.cfg.titulo);
}

/** Linhas de escrever entre y0 e y1. */
function linhasDe(p: Pagina, x0: number, x1: number, y0: number, y1: number, e: number) {
  const n = Math.floor((y1 - y0 - 1.5) / e);
  for (let k = 1; k <= n; k++) p.linha(x0, y0 + k * e, x1, y0 + k * e);
}

function titulosDaSemana(p: Pagina, indice: number): { ini: string; subtitulo: string } {
  const base = p.cfg.inicio ? inicioDaSemana(p.cfg.inicio, p.cfg.semanaComecaNaSegunda) : '';
  const ini = base ? somarDias(base, indice * 7) : '';
  return { ini, subtitulo: p.cfg.datado && ini ? `Semana de ${intervaloDaSemana(ini)}` : '' };
}

function semanal(p: Pagina, indice: number) {
  const t = titulosDaSemana(p, indice);
  let y = cabecalho(p, p.cfg.titulo || 'Semana', t.subtitulo || (p.cfg.datado ? '' : 'Semana de ____ a ____'));
  const { x0, x1, y1 } = p.c;
  // foco da semana
  p.texto(x0, y + 3, 'Foco da semana', 8, 'e', true);
  p.ret(x0, y + 4.5, x1 - x0, 13, p.cfg.cor, 0.25);
  y += 20;
  const ordem = p.cfg.semanaComecaNaSegunda ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const altura = (y1 - y) / 7;
  ordem.forEach((dow, k) => {
    const yy = y + k * altura;
    p.linha(x0, yy, x1, yy, p.cfg.cor, 0.3);
    const dia = t.ini && p.cfg.datado ? somarDias(t.ini, k) : '';
    p.texto(x0 + 1, yy + 4.2, DIAS_SEMANA[dow], 8, 'e', true);
    if (dia) p.texto(x1 - 1, yy + 4.2, String(partes(dia)[2]), 8, 'd', false);
    linhasDe(p, x0 + 1, x1, yy + 4.5, yy + altura, 6.5);
  });
  p.linha(x0, y1, x1, y1, p.cfg.cor, 0.3);
}

function mensal(p: Pagina, indice: number) {
  const base = p.cfg.inicio ? somarMeses(p.cfg.inicio, indice) : '';
  const [ano, mes] = partes(base);
  const sub = p.cfg.datado && base ? `${MESES[mes - 1]} de ${ano}` : 'Mês: ____________';
  const y = cabecalho(p, p.cfg.titulo || 'Mês', sub);
  const { x0, x1, y1, w } = p.c;
  const notas = Math.min(40, (y1 - y) * 0.25);
  const gy1 = y1 - notas - 3;
  const cab = 6;
  const colW = w / 7;
  const linhas = 6;
  const cel = (gy1 - y - cab) / linhas;
  const ordem = p.cfg.semanaComecaNaSegunda ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  ordem.forEach((dow, i) => p.texto(x0 + colW * i + colW / 2, y + 4.2, DIAS_CURTOS[dow], 7.5, 'c', true));
  p.ret(x0, y + cab, w, linhas * cel, p.cfg.cor, 0.3);
  for (let i = 1; i < 7; i++) p.linha(x0 + colW * i, y + cab, x0 + colW * i, y + cab + linhas * cel);
  for (let j = 1; j < linhas; j++) p.linha(x0, y + cab + cel * j, x1, y + cab + cel * j);
  if (p.cfg.datado && base) {
    const dow1 = diaDaSemana(base);
    const desloc = p.cfg.semanaComecaNaSegunda ? (dow1 + 6) % 7 : dow1;
    for (let d = 1; d <= diasNoMes(ano, mes); d++) {
      const pos = desloc + d - 1;
      const col = pos % 7;
      const lin = Math.floor(pos / 7);
      if (lin >= linhas) break;
      p.texto(x0 + colW * col + 1.2, y + cab + cel * lin + 3.4, String(d), 7, 'e', false);
    }
  }
  p.texto(x0, gy1 + 7, 'Notas do mês', 8, 'e', true);
  linhasDe(p, x0, x1, gy1 + 8, y1, 6.5);
}

function diario1(p: Pagina, indice: number) {
  const dia = p.cfg.inicio ? somarDias(p.cfg.inicio, indice) : '';
  const sub = p.cfg.datado && dia ? `${DIAS_SEMANA[diaDaSemana(dia)]}, ${dm(dia)}` : 'Dia: ____ / ____';
  let y = cabecalho(p, p.cfg.titulo || 'Meu dia', sub);
  const { x0, x1, y1, w } = p.c;
  const total = y1 - y;
  // prioridades
  p.texto(x0, y + 3, 'Prioridades', 8, 'e', true);
  const hp = total * 0.2;
  const ep = (hp - 9) / 3;
  for (let k = 0; k < 3; k++) {
    const yy = y + 5 + ep * (k + 1);
    p.ret(x0, yy - 3.2, 3, 3, p.cfg.cor, 0.25);
    p.linha(x0 + 5, yy, x1, yy);
  }
  y += hp;
  // agenda por hora (coluna) e anotações (coluna)
  const ha = total * 0.46;
  const horas = 16; // 6h às 21h
  p.texto(x0, y + 3, 'Agenda', 8, 'e', true);
  const eh = (ha - 5) / horas;
  const colAg = Math.min(w, w * 0.62);
  for (let k = 0; k < horas; k++) {
    const yy = y + 5 + eh * (k + 1);
    p.texto(x0, yy - 0.8, `${String(6 + k).padStart(2, '0')}h`, 5.5, 'e', false);
    p.linha(x0 + 6, yy, x0 + colAg, yy);
  }
  p.texto(x0 + colAg + 4, y + 3, 'Lembretes', 8, 'e', true);
  linhasDe(p, x0 + colAg + 4, x1, y + 4, y + ha, Math.max(5.5, eh * 1.4));
  y += ha;
  p.texto(x0, y + 4, 'Anotações', 8, 'e', true);
  linhasDe(p, x0, x1, y + 5, y1, 6.5);
}

function diario2(p: Pagina, indice: number) {
  let y = cabecalho(p, p.cfg.titulo);
  const { x0, x1, y1 } = p.c;
  const alt = (y1 - y) / 2;
  for (let k = 0; k < 2; k++) {
    const dia = p.cfg.inicio ? somarDias(p.cfg.inicio, indice * 2 + k) : '';
    const rot = p.cfg.datado && dia ? `${DIAS_SEMANA[diaDaSemana(dia)]}, ${dm(dia)}` : 'Dia: ____ / ____';
    const yy = y + k * alt;
    p.texto(x0, yy + 4, rot, 9, 'e', true);
    p.linha(x0, yy + 5.5, x1, yy + 5.5, p.cfg.cor, 0.3);
    linhasDe(p, x0, x1, yy + 5.5, yy + alt - 2, 7);
  }
  y += 0;
}

function habitos(p: Pagina, indice: number) {
  const base = p.cfg.inicio ? somarMeses(p.cfg.inicio, indice) : '';
  const [ano, mes] = partes(base);
  const sub = p.cfg.datado && base ? `${MESES[mes - 1]} de ${ano}` : 'Mês: ____________';
  const y = cabecalho(p, p.cfg.titulo || 'Hábitos do mês', sub);
  const { x0, x1, y1, w } = p.c;
  const nomeW = Math.min(40, w * 0.3);
  const colW = (w - nomeW) / 31;
  const n = Math.max(1, Math.round(p.cfg.habitos));
  const cab = 6;
  const lin = Math.min(9, (y1 - y - cab) / n);
  const alturaTabela = cab + lin * n;
  p.ret(x0, y, w, alturaTabela, p.cfg.cor, 0.3);
  p.linha(x0 + nomeW, y, x0 + nomeW, y + alturaTabela);
  p.texto(x0 + 1.2, y + 4.2, 'Hábito', 7.5, 'e', true);
  for (let d = 0; d < 31; d++) {
    const cx = x0 + nomeW + colW * d;
    if (d > 0) p.linha(cx, y, cx, y + alturaTabela, p.cfg.cor, 0.15);
    p.texto(cx + colW / 2, y + 4.2, String(d + 1), colW < 3 ? 4.5 : 5.5, 'c', false);
  }
  p.linha(x0, y + cab, x1, y + cab, p.cfg.cor, 0.3);
  for (let k = 1; k < n; k++) p.linha(x0, y + cab + lin * k, x1, y + cab + lin * k, p.cfg.cor, 0.15);
}

function checklist(p: Pagina) {
  const y = cabecalho(p, p.cfg.titulo || 'Checklist');
  const e = Math.max(6, p.cfg.espacamentoMm + 1);
  const n = Math.floor((p.c.y1 - y) / e);
  for (let k = 1; k <= n; k++) {
    const yy = y + k * e;
    p.ret(p.c.x0, yy - 3.6, 3.6, 3.6, p.cfg.cor, 0.3);
    p.linha(p.c.x0 + 6, yy, p.c.x1, yy);
  }
}

const PERGUNTAS_REFLEXAO = [
  'O que foi bem nesta semana?',
  'O que eu posso melhorar?',
  'O que eu aprendi?',
  'Pelo que sou grata?',
  'Intenções para a próxima semana',
];

function reflexao(p: Pagina, indice: number) {
  const t = titulosDaSemana(p, indice);
  const y = cabecalho(p, p.cfg.titulo || 'Reflexão da semana', t.subtitulo || (p.cfg.datado ? '' : 'Semana de ____ a ____'));
  const { x0, x1, y1 } = p.c;
  const alt = (y1 - y) / PERGUNTAS_REFLEXAO.length;
  PERGUNTAS_REFLEXAO.forEach((q, k) => {
    const yy = y + k * alt;
    p.texto(x0, yy + 4, q, 9, 'e', true);
    linhasDe(p, x0, x1, yy + 4.5, yy + alt - 1.5, 7);
  });
}

/** Gera todas as páginas do miolo (páginas ímpares com a margem da encadernação à esquerda, pares à direita). */
export function paginasDoMiolo(cfgEntrada: Partial<ConfigMiolo>): PaginaMiolo[] {
  const cfg: ConfigMiolo = { ...CONFIG_PADRAO, ...cfgEntrada };
  const { l, a } = TAMANHOS_MIOLO[cfg.tamanho] ?? TAMANHOS_MIOLO.A5;
  const total = Math.max(1, Math.min(400, Math.round(cfg.paginas)));
  const out: PaginaMiolo[] = [];
  for (let i = 0; i < total; i++) {
    const numero = i + 1;
    const p = new Pagina(cfg, numero, l, a, caixaDa(cfg, numero, l, a));
    switch (cfg.modelo) {
      case 'pautado': pautado(p); break;
      case 'pontilhado': pontilhado(p); break;
      case 'quadriculado': quadriculado(p); break;
      case 'liso': liso(p); break;
      case 'semanal': semanal(p, i); break;
      case 'mensal': mensal(p, i); break;
      case 'diario1': diario1(p, i); break;
      case 'diario2': diario2(p, i); break;
      case 'habitos': habitos(p, i); break;
      case 'checklist': checklist(p); break;
      case 'reflexao': reflexao(p, i); break;
    }
    rodape(p);
    out.push({ numero, larguraMm: l, alturaMm: a, itens: p.itens });
  }
  return out;
}

// ---------- prévia em SVG ----------

const PT_MM = 25.4 / 72;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n2 = (v: number) => String(Math.round(v * 100) / 100);

/** SVG de uma página (viewBox em mm). `pagina` já tem as peças; `fundo` desenha o papel. */
export function paginaParaSvg(pg: PaginaMiolo, fundo = '#FFFFFF'): string {
  const partesSvg: string[] = [`<rect x="0" y="0" width="${pg.larguraMm}" height="${pg.alturaMm}" fill="${fundo}"/>`];
  for (const e of pg.itens) {
    if (e.t === 'linha') partesSvg.push(`<line x1="${n2(e.x1)}" y1="${n2(e.y1)}" x2="${n2(e.x2)}" y2="${n2(e.y2)}" stroke="${e.cor}" stroke-width="${n2(e.esp)}"/>`);
    else if (e.t === 'ret') partesSvg.push(`<rect x="${n2(e.x)}" y="${n2(e.y)}" width="${n2(e.w)}" height="${n2(e.h)}" fill="${e.preenche ?? 'none'}" stroke="${e.cor}" stroke-width="${n2(e.esp)}"/>`);
    else if (e.t === 'ponto') partesSvg.push(`<circle cx="${n2(e.x)}" cy="${n2(e.y)}" r="${n2(e.d / 2)}" fill="${e.cor}"/>`);
    else {
      const anc = e.alinhar === 'c' ? 'middle' : e.alinhar === 'd' ? 'end' : 'start';
      const fam = e.fonte === 'serif' ? "'Times New Roman', Times, serif" : "Helvetica, Arial, sans-serif";
      partesSvg.push(`<text x="${n2(e.x)}" y="${n2(e.y)}" font-size="${n2(e.tam * PT_MM)}" fill="${e.cor}" text-anchor="${anc}" font-family="${fam}"${e.negrito ? ' font-weight="bold"' : ''}>${esc(e.texto)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pg.larguraMm} ${pg.alturaMm}" width="${pg.larguraMm}mm" height="${pg.alturaMm}mm">${partesSvg.join('')}</svg>`;
}
