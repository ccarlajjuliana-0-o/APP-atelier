// Pacote do Estúdio de Miolos (mostruario-craft-notes-unique.json): leitura e filtros.

export const FORMATO_PACOTE = 'craft-notes-unique/mostruario';

export interface ItemPacote {
  id: string;
  tipo: 'modelo' | 'adesivo';
  nome: string;
  categoria: string;
  descricao: string;
  tamanhos: string[];
  tamanhoBase: { nome: string; largura_mm: number; altura_mm: number } | null;
  ordem: number;
  preview: string; // data URL
  atualizadoEm: string;
}

function texto(v: unknown, padrao = ''): string {
  return typeof v === 'string' ? v : padrao;
}

function lerItem(bruto: unknown, tipo: ItemPacote['tipo']): ItemPacote {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const id = texto(o.id);
  const preview = texto(o.preview);
  if (!id || !preview.startsWith('data:image/')) {
    throw new Error(`Item sem id ou sem prévia (${texto(o.nome, 'sem nome')}).`);
  }
  const base = o.tamanhoBase as Record<string, unknown> | null | undefined;
  return {
    id,
    tipo,
    nome: texto(o.nome, 'Sem nome'),
    categoria: texto(o.categoria),
    descricao: texto(o.descricao),
    tamanhos: Array.isArray(o.tamanhos) ? o.tamanhos.filter((t): t is string => typeof t === 'string') : [],
    tamanhoBase: base
      ? { nome: texto(base.nome), largura_mm: Number(base.largura_mm), altura_mm: Number(base.altura_mm) }
      : null,
    ordem: typeof o.ordem === 'number' ? o.ordem : 0,
    preview,
    atualizadoEm: texto(o.atualizadoEm, new Date().toISOString()),
  };
}

export function lerPacote(json: string): ItemPacote[] {
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (p.formato !== FORMATO_PACOTE) throw new Error('Este arquivo não é um pacote do Estúdio de Miolos.');
  const modelos = Array.isArray(p.modelos) ? p.modelos : [];
  const adesivos = Array.isArray(p.adesivos) ? p.adesivos : [];
  return [...modelos.map((m) => lerItem(m, 'modelo')), ...adesivos.map((a) => lerItem(a, 'adesivo'))];
}

/** Modelos visíveis para o tamanho escolhido (adesivos não dependem de tamanho). */
export function filtrar<T extends { tipo: string; visivel: boolean; tamanhos: string[]; ordem: number }>(
  itens: T[],
  tipo: 'modelo' | 'adesivo',
  tamanho?: string,
): T[] {
  return itens
    .filter((i) => i.tipo === tipo && i.visivel)
    .filter((i) => tipo === 'adesivo' || !tamanho || i.tamanhos.includes(tamanho))
    .sort((a, b) => a.ordem - b.ordem);
}

/** Ids que existiam e não vieram no novo pacote: ficam ocultos, não são apagados. */
export function idsParaOcultar(existentes: string[], novos: string[]): string[] {
  const set = new Set(novos);
  return existentes.filter((id) => !set.has(id));
}
