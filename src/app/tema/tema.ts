// Tema: modo claro/escuro/automático, paletas, cores livres e fontes.

export type Modo = 'claro' | 'escuro' | 'automatico';

export interface Paleta {
  id: string;
  nome: string;
  principal: string; // botões e itens ativos (modo claro)
  principalEscuro: string; // versão para o modo escuro
  apoio: string; // fundos suaves e etiquetas
  menu: string; // fundo do menu lateral (modo claro)
}

export const PALETAS: Paleta[] = [
  { id: 'marca', nome: 'Lavanda e azul pervinca (marca)', principal: '#9168A0', principalEscuro: '#C398C8', apoio: '#92A8D1', menu: '#4A4E79' },
  { id: 'rosa', nome: 'Lilás suave e rosa', principal: '#8A5BB0', principalEscuro: '#B48AD8', apoio: '#F3D9EC', menu: '#4A4E79' },
  { id: 'menta', nome: 'Azul e verde menta', principal: '#2F6DB3', principalEscuro: '#6FA8E8', apoio: '#D3F0E4', menu: '#4A4E79' },
  { id: 'sakura', nome: 'Sakura (rosa cerejeira)', principal: '#B65C85', principalEscuro: '#E7A6BE', apoio: '#F1CDD9', menu: '#5A3A52' },
  { id: 'salvia', nome: 'Sálvia (verde azulado)', principal: '#4F7F8C', principalEscuro: '#98B1C2', apoio: '#CFE0D6', menu: '#33505A' },
  { id: 'mel', nome: 'Mel (dourado suave)', principal: '#A6702D', principalEscuro: '#D8A776', apoio: '#F3E2C7', menu: '#5B4632' },
  { id: 'oceano', nome: 'Oceano (azul profundo)', principal: '#35609A', principalEscuro: '#8FA8D2', apoio: '#BFD4EC', menu: '#24385C' },
  { id: 'ameixa', nome: 'Ameixa (roxo e rosa)', principal: '#7A3E6E', principalEscuro: '#C58AB8', apoio: '#EBCFE3', menu: '#3C2244' },
  { id: 'pessego', nome: 'Pêssego (coral suave)', principal: '#C0605A', principalEscuro: '#EFA59F', apoio: '#F9D9CF', menu: '#5E3A3A' },
  { id: 'grafite', nome: 'Grafite (neutro)', principal: '#5B6275', principalEscuro: '#A9B1C7', apoio: '#DDE1EA', menu: '#2B2F3C' },
];

// ---------- fontes ----------

export interface Fonte {
  id: string;
  nome: string;
  familia: string; // valor do font-family
  google: string; // trecho da URL do Google Fonts ('' = já vem com o app)
}

export const FONTES_CORPO: Fonte[] = [
  { id: 'nunito', nome: 'Nunito (padrão)', familia: "'Nunito', system-ui, sans-serif", google: 'Nunito:wght@400;700' },
  { id: 'quicksand', nome: 'Quicksand', familia: "'Quicksand', system-ui, sans-serif", google: 'Quicksand:wght@400;500;600;700' },
  { id: 'comfortaa', nome: 'Comfortaa', familia: "'Comfortaa', system-ui, sans-serif", google: 'Comfortaa:wght@400;700' },
  { id: 'lato', nome: 'Lato', familia: "'Lato', system-ui, sans-serif", google: 'Lato:wght@400;700' },
  { id: 'dmsans', nome: 'DM Sans', familia: "'DM Sans', system-ui, sans-serif", google: 'DM+Sans:wght@400;500;700' },
  { id: 'mulish', nome: 'Mulish', familia: "'Mulish', system-ui, sans-serif", google: 'Mulish:wght@400;600;700' },
  { id: 'atkinson', nome: 'Atkinson (leitura fácil)', familia: "'Atkinson Hyperlegible', system-ui, sans-serif", google: 'Atkinson+Hyperlegible:wght@400;700' },
  { id: 'sistema', nome: 'Fonte do aparelho', familia: "system-ui, -apple-system, 'Segoe UI', sans-serif", google: '' },
];

export const FONTES_TITULO: Fonte[] = [
  { id: 'quicksand', nome: 'Quicksand (padrão)', familia: "'Quicksand', 'Nunito', sans-serif", google: 'Quicksand:wght@500;600;700' },
  { id: 'nunito', nome: 'Nunito', familia: "'Nunito', sans-serif", google: 'Nunito:wght@400;700' },
  { id: 'comfortaa', nome: 'Comfortaa', familia: "'Comfortaa', sans-serif", google: 'Comfortaa:wght@400;700' },
  { id: 'fredoka', nome: 'Fredoka', familia: "'Fredoka', sans-serif", google: 'Fredoka:wght@500;600;700' },
  { id: 'playfair', nome: 'Playfair Display (clássica)', familia: "'Playfair Display', serif", google: 'Playfair+Display:wght@500;600;700' },
  { id: 'lora', nome: 'Lora (clássica)', familia: "'Lora', serif", google: 'Lora:wght@500;600;700' },
  { id: 'cormorant', nome: 'Cormorant Garamond (elegante)', familia: "'Cormorant Garamond', serif", google: 'Cormorant+Garamond:wght@500;600;700' },
];

export const FONTES_SCRIPT: Fonte[] = [
  { id: 'greatvibes', nome: 'Great Vibes (marca)', familia: "'Great Vibes', cursive", google: 'Great+Vibes' },
  { id: 'alexbrush', nome: 'Alex Brush', familia: "'Alex Brush', cursive", google: 'Alex+Brush' },
  { id: 'allura', nome: 'Allura', familia: "'Allura', cursive", google: 'Allura' },
  { id: 'parisienne', nome: 'Parisienne', familia: "'Parisienne', cursive", google: 'Parisienne' },
  { id: 'sacramento', nome: 'Sacramento', familia: "'Sacramento', cursive", google: 'Sacramento' },
  { id: 'dancing', nome: 'Dancing Script', familia: "'Dancing Script', cursive", google: 'Dancing+Script:wght@400;700' },
  { id: 'satisfy', nome: 'Satisfy', familia: "'Satisfy', cursive", google: 'Satisfy' },
];

export interface Preferencias {
  modo: Modo;
  paletaId: string;
  principalLivre?: string;
  apoioLivre?: string;
  menuLivre?: string;
  fundoLivre?: string; // cor do plano de fundo (vale no lugar do claro/escuro padrão)
  textoLivre?: string; // cor do texto
  escalaFonte?: number; // tamanho das letras, em % (padrão 100)
  fonteCorpo?: string;
  fonteTitulo?: string;
  fonteScript?: string;
  temaFestivo?: string; // 'automatico' (padrão), 'desligado' ou o id de um tema
  temaDiasAntes?: number;
  temaDiasDepois?: number;
  atualizadoEm?: string; // usado para sincronizar o visual entre aparelhos
}

export const ESCALA_MIN = 85;
export const ESCALA_MAX = 140;
export const escalaDe = (p: Preferencias): number => (typeof p.escalaFonte === 'number' && Number.isFinite(p.escalaFonte) ? Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, Math.round(p.escalaFonte))) : 100);

export const PREFERENCIAS_PADRAO: Preferencias = { modo: 'automatico', paletaId: 'marca' };

export const achar = (lista: Fonte[], id: string | undefined): Fonte => lista.find((f) => f.id === id) ?? lista[0];

/** Endereço único do Google Fonts para as famílias pedidas (vazio se não há nada a baixar). */
export function urlDasFontes(fontes: Fonte[]): string {
  const partes = [...new Set(fontes.map((f) => f.google).filter(Boolean))];
  return partes.length ? `https://fonts.googleapis.com/css2?${partes.map((p) => `family=${p}`).join('&')}&display=swap` : '';
}

// ---------- cores ----------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Luminância relativa (WCAG). */
function luminanciaWcag(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminanciaWcag(a), luminanciaWcag(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TEXTO_ESCURO = '#3E3550';

/** Entre branco e o texto escuro da marca, a cor que mais contrasta com o fundo. */
export function textoSobre(hex: string): string {
  return contraste(hex, '#FFFFFF') >= contraste(hex, TEXTO_ESCURO) ? '#FFFFFF' : TEXTO_ESCURO;
}

export function misturar(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('');
}

export function modoEfetivo(modo: Modo, sistemaEscuro: boolean): 'claro' | 'escuro' {
  if (modo === 'automatico') return sistemaEscuro ? 'escuro' : 'claro';
  return modo;
}

const MENU_ESCURO = '#150F1B';

export interface CoresDoTema { principal: string; principalEscuro: string; apoio: string; menu: string }

/** `tema`: cores de um tema festivo ativo; quando há, valem no lugar da paleta e das cores livres. */
export function variaveis(p: Preferencias, sistemaEscuro: boolean, tema?: CoresDoTema | null): Record<string, string> {
  const escuro = modoEfetivo(p.modo, sistemaEscuro) === 'escuro';
  const base = PALETAS.find((x) => x.id === p.paletaId) ?? PALETAS[0];
  const principal = tema ? (escuro ? tema.principalEscuro : tema.principal) : p.principalLivre ?? (escuro ? base.principalEscuro : base.principal);
  const apoio = tema ? tema.apoio : p.apoioLivre ?? base.apoio;
  const menu = tema ? (escuro ? MENU_ESCURO : tema.menu) : p.menuLivre ?? (escuro ? MENU_ESCURO : base.menu);
  const menuAtivo = escuro ? misturar(principal, MENU_ESCURO, 0.62) : principal;
  const cor = {
    fundo: escuro ? '#1E1726' : '#FBF7F4',
    cartao: escuro ? '#2A2036' : '#FFFFFF',
    texto: escuro ? '#F3ECF5' : '#3E3550',
    suave: escuro ? '#B9AFC6' : '#6B6280',
    linha: escuro ? '#3A2E48' : '#F0E3E6',
    borda: escuro ? '#4C3E5C' : '#DCCBD3',
    neutro: escuro ? '#33283F' : '#F7E5E7',
  };
  // Fundo e/ou texto escolhidos por você: o resto (cartões, linhas, texto suave) se ajusta a eles.
  if (p.fundoLivre || p.textoLivre) {
    const fundo = p.fundoLivre ?? cor.fundo;
    const texto = p.textoLivre ?? (p.fundoLivre ? textoSobre(fundo) : cor.texto);
    const claro = luminancia(fundo) > 0.5;
    cor.fundo = fundo;
    cor.texto = texto;
    cor.cartao = p.fundoLivre ? misturar(fundo, '#FFFFFF', claro ? 0.6 : 0.07) : cor.cartao;
    cor.suave = misturar(texto, fundo, 0.35);
    cor.linha = misturar(fundo, texto, 0.1);
    cor.borda = misturar(fundo, texto, 0.2);
    cor.neutro = misturar(fundo, texto, 0.06);
  }
  return {
    '--escala': String(escalaDe(p) / 100),
    '--fundo': cor.fundo,
    '--cartao': cor.cartao,
    '--texto': cor.texto,
    '--texto-suave': cor.suave,
    '--linha': cor.linha,
    '--borda': cor.borda,
    '--neutro': cor.neutro,
    '--menu': menu,
    '--sobre-menu': textoSobre(menu),
    '--menu-ativo': menuAtivo,
    '--sobre-menu-ativo': textoSobre(menuAtivo),
    '--principal': principal,
    '--sobre-principal': textoSobre(principal),
    '--apoio': escuro ? apoio + '33' : apoio,
    '--sobre-apoio': escuro ? apoio : '#3E3550',
    '--fonte-corpo': achar(FONTES_CORPO, p.fonteCorpo).familia,
    '--fonte-titulo': achar(FONTES_TITULO, p.fonteTitulo).familia,
    '--fonte-script': achar(FONTES_SCRIPT, p.fonteScript).familia,
  };
}

/** O visual vindo da nuvem vale se for mais novo do que o guardado neste aparelho. */
export function remotoMaisNovo(local: string | undefined, remoto: string | undefined): boolean {
  return !!remoto && (!local || remoto > local);
}
