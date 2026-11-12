import { db, novoId } from './db.ts';
import type { Publicacao } from '../dominio/divulgacao.ts';

export async function listarPublicacoes(): Promise<Publicacao[]> {
  const lista = await db.publicacoes.toArray();
  return lista.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}

/** Publicações não são apagadas: o que não vale mais fica como "descartado". */
export async function salvarPublicacao(p: Publicacao): Promise<Publicacao> {
  const salvo = { ...p, id: p.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.publicacoes.put(salvo);
  return salvo;
}
