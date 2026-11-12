// Janela flutuante (Assistente): posição e tamanho sempre dentro da tela.
export interface Janela { x: number; y: number; w: number; h: number }

export const MIN_W = 300;
export const MIN_H = 320;
export const MARGEM = 8;

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Ajusta tamanho e posição para caber na tela (a barra de cima nunca fica fora do alcance). */
export function limitarJanela(j: Janela, largura: number, altura: number): Janela {
  const maxW = Math.max(1, largura - 2 * MARGEM);
  const maxH = Math.max(1, altura - 2 * MARGEM);
  const w = entre(Math.round(j.w), Math.min(MIN_W, maxW), maxW);
  const h = entre(Math.round(j.h), Math.min(MIN_H, maxH), maxH);
  return {
    w, h,
    x: entre(Math.round(j.x), MARGEM, largura - w - MARGEM),
    y: entre(Math.round(j.y), MARGEM, altura - h - MARGEM),
  };
}

/** Canto inferior direito, 440×640 (ou menor, se a tela for pequena). */
export function janelaPadrao(largura: number, altura: number): Janela {
  const w = Math.min(440, largura - 24);
  const h = Math.min(640, altura - 40);
  return limitarJanela({ w, h, x: largura - w - 20, y: altura - h - 20 }, largura, altura);
}

export function lerJanelaGuardada(bruto: string | null): Janela | null {
  if (!bruto) return null;
  try {
    const j = JSON.parse(bruto) as Partial<Janela>;
    return [j.x, j.y, j.w, j.h].every((n) => typeof n === 'number' && Number.isFinite(n)) ? (j as Janela) : null;
  } catch {
    return null;
  }
}
