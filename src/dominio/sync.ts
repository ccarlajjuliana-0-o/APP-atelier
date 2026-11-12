// Regras da sincronização. Valem para um único usuário em vários aparelhos:
// - cada registro tem uma data de alteração; ao encontrar duas versões, vale a mais recente;
// - movimentações de estoque só se acrescentam (nunca mudam), então basta juntar as dos dois lados;
// - nada é apagado: arquivar é só uma alteração.

/** Tabelas locais que vão para a nuvem. Fontes, escritas e mostruário ficam de fora (o mostruário já tem a sua própria nuvem). */
export const TABELAS_SINCRONIZADAS = [
  'materiais', 'movimentacoes', 'fornecedores', 'produtos', 'clientes', 'pedidos', 'despesas', 'ajustes',
] as const;
export type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];

/** Data de alteração de um registro (movimentações usam a data de criação). */
export function dataDoRegistro(r: { atualizadoEm?: string; criadoEm?: string }): number {
  const t = r.atualizadoEm || r.criadoEm || '';
  const n = new Date(t).getTime();
  return Number.isNaN(n) ? 0 : n;
}

/** A versão da nuvem deve substituir a local? Só se a local não existe ou é mais antiga. */
export function nuvemSubstitui(remoto: number, local: number | null): boolean {
  return local === null || remoto > local;
}

/** O registro local precisa ir para a nuvem? Só se foi alterado depois do último envio. */
export function precisaEnviar(registro: number, ultimoEnvio: number): boolean {
  return registro > ultimoEnvio;
}

export function emLotes<T>(lista: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

/** Troca Blobs (fotos) por um marcador com o conteúdo em texto, e o inverso. `converter` faz a leitura de cada Blob. */
export const MARCA_BLOB = '__blob';

export async function serializar(obj: Record<string, unknown>, paraTexto: (b: Blob) => Promise<string>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof Blob !== 'undefined' && v instanceof Blob) out[k] = { [MARCA_BLOB]: await paraTexto(v) };
    else if (Array.isArray(v) && v.length > 0 && typeof Blob !== 'undefined' && v.every((x) => x instanceof Blob)) {
      out[k] = { [MARCA_BLOB]: await Promise.all((v as Blob[]).map(paraTexto)) };
    } else out[k] = v;
  }
  return out;
}

export async function desserializar(obj: Record<string, unknown>, deTexto: (t: string) => Promise<Blob>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && MARCA_BLOB in (v as object)) {
      const c = (v as Record<string, unknown>)[MARCA_BLOB];
      out[k] = Array.isArray(c) ? await Promise.all((c as string[]).map(deTexto)) : await deTexto(c as string);
    } else out[k] = v;
  }
  return out;
}
