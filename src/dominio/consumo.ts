// Ritmo de consumo de material, calculado das baixas feitas na produção.

export interface Baixa {
  quantidade: number;
  criadoEm: string; // ISO
}

const DIA_MS = 86_400_000;

/**
 * Consumo médio por dia nos últimos `janelaDias` dias.
 * Com pouco histórico, usa no mínimo 14 dias de base para não superestimar o ritmo.
 * Devolve 0 se não houver baixas na janela.
 */
export function ritmoPorDia(baixas: Baixa[], agora: Date, janelaDias = 90): number {
  const corte = agora.getTime() - janelaDias * DIA_MS;
  const recentes = baixas.filter((b) => new Date(b.criadoEm).getTime() >= corte);
  if (recentes.length === 0) return 0;
  const primeira = Math.min(...recentes.map((b) => new Date(b.criadoEm).getTime()));
  const dias = Math.min(janelaDias, Math.max(14, (agora.getTime() - primeira) / DIA_MS));
  return recentes.reduce((s, b) => s + b.quantidade, 0) / dias;
}

/** Quantos dias o saldo dura no ritmo atual. null se não há consumo para estimar. */
export function diasRestantes(disponivel: number, ritmo: number): number | null {
  if (!(ritmo > 0)) return null;
  return Math.max(0, Math.floor(Math.max(0, disponivel) / ritmo));
}
