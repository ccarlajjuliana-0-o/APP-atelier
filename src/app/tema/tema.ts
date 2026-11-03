// Tema: modo claro/escuro/automático + paleta da marca (lilás e azul pastel) + cores livres.

export type Modo = 'claro' | 'escuro' | 'automatico';

export interface Paleta {
  id: string;
  nome: string;
  principal: string; // botões e itens ativos
  principalEscuro: string; // versão para o modo escuro
  apoio: string; // azul pastel: fundos suaves e etiquetas
}

export const PALETAS: Paleta[] = [
  { id: 'marca', nome: 'Lavanda e azul pervinca (marca)', principal: '#9168A0', principalEscuro: '#C398C8', apoio: '#92A8D1' },
  { id: 'rosa', nome: 'Lilás suave e rosa', principal: '#8A5BB0', principalEscuro: '#9B6DC2', apoio: '#F3D9EC' },
  { id: 'menta', nome: 'Azul e verde menta', principal: '#2F6DB3', principalEscuro: '#4A86CC', apoio: '#D3F0E4' },
];

export interface Preferencias {
  modo: Modo;
  paletaId: string;
  principalLivre?: string;
  apoioLivre?: string;
}

export const PREFERENCIAS_PADRAO: Preferencias = { modo: 'automatico', paletaId: 'marca' };

export function luminancia(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Texto escuro sobre cores claras, branco sobre cores escuras. */
export function textoSobre(hex: string): string {
  return luminancia(hex) > 0.62 ? '#3E3550' : '#FFFFFF';
}

export function modoEfetivo(modo: Modo, sistemaEscuro: boolean): 'claro' | 'escuro' {
  if (modo === 'automatico') return sistemaEscuro ? 'escuro' : 'claro';
  return modo;
}

export function variaveis(p: Preferencias, sistemaEscuro: boolean): Record<string, string> {
  const escuro = modoEfetivo(p.modo, sistemaEscuro) === 'escuro';
  const base = PALETAS.find((x) => x.id === p.paletaId) ?? PALETAS[0];
  const principal = p.principalLivre ?? (escuro ? base.principalEscuro : base.principal);
  const apoio = p.apoioLivre ?? base.apoio;
  return {
    '--fundo': escuro ? '#1E1726' : '#FBF7F4',
    '--cartao': escuro ? '#2A2036' : '#FFFFFF',
    '--texto': escuro ? '#F3ECF5' : '#3E3550',
    '--texto-suave': escuro ? '#B9AFC6' : '#6B6280',
    '--linha': escuro ? '#3A2E48' : '#F0E3E6',
    '--borda': escuro ? '#4C3E5C' : '#DCCBD3',
    '--neutro': escuro ? '#33283F' : '#F7E5E7',
    '--menu': escuro ? '#150F1B' : '#4A4E79',
    '--menu-ativo': escuro ? '#4A3A62' : '#9168A0',
    '--principal': principal,
    '--sobre-principal': textoSobre(principal),
    '--apoio': escuro ? apoio + '33' : apoio,
    '--sobre-apoio': escuro ? apoio : '#3E3550',
  };
}
