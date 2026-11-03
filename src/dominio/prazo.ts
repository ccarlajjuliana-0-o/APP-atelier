// Prazo de entrega em dias úteis (feriados serão configuráveis depois).

export type TipoPedido = 'personalizado' | 'catalogo';

export const PRAZO_DIAS_UTEIS: Record<TipoPedido, { min: number; max: number }> = {
  personalizado: { min: 10, max: 20 },
  catalogo: { min: 3, max: 7 },
};

/** Datas no formato 'AAAA-MM-DD'. */
export function adicionarDiasUteis(inicio: string, dias: number): string {
  const [a, m, d] = inicio.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  let restantes = dias;
  while (restantes > 0) {
    data.setUTCDate(data.getUTCDate() + 1);
    const dia = data.getUTCDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }
  return data.toISOString().slice(0, 10);
}
