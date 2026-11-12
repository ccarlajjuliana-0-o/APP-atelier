import { db, novoId } from './db.ts';
import type { TemaPersonalizado } from '../dominio/temas.ts';

export async function listarTemasPersonalizados(): Promise<TemaPersonalizado[]> {
  return (await db.temas.toArray()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Temas não são apagados: os que não servem mais ficam arquivados. */
export async function salvarTema(t: TemaPersonalizado): Promise<TemaPersonalizado> {
  const salvo = { ...t, id: t.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.temas.put(salvo);
  return salvo;
}

/** `null` volta à logo original do app. */
export async function salvarLogo(imagem: Blob | null): Promise<void> {
  await db.identidade.put({ id: 'logo', imagem, atualizadoEm: new Date().toISOString() });
}
