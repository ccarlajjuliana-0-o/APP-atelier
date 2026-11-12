// Conversões de cor para o seletor (RGB, HSV e código hexadecimal).

export type Rgb = [number, number, number];
export interface Hsv { h: number; s: number; v: number } // h 0–360, s e v 0–1

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Aceita "#RGB", "#RRGGBB" (com ou sem #, qualquer caixa) e devolve "#RRGGBB" em maiúsculas; senão, null. */
export function normalizarHex(texto: string): string | null {
  const t = texto.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(t)) return '#' + t.split('').map((c) => c + c).join('').toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return '#' + t.toUpperCase();
  return null;
}

export function hexParaRgb(hex: string): Rgb {
  const n = parseInt((normalizarHex(hex) ?? '#000000').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbParaHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(limitar(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbParaHsv([r, g, b]: Rgb): Hsv {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvParaRgb({ h, s, v }: Hsv): Rgb {
  const H = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
