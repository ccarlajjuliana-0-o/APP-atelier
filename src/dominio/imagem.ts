/** Tamanho final de uma foto: o maior lado vira `max`, sem ampliar e mantendo a proporção. */
export function escalaMax(largura: number, altura: number, max: number): { w: number; h: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { w: largura, h: altura };
  const k = max / maior;
  return { w: Math.max(1, Math.round(largura * k)), h: Math.max(1, Math.round(altura * k)) };
}
