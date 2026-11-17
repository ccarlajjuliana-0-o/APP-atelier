import { db, novoId, type FormularioRegistro } from './db.ts';
import { formularioPadrao } from '../dominio/formularioPadrao.ts';
import type { GrupoOpcoes } from '../dominio/opcoes.ts';

const ID = 'orcamento';

/** Perguntas do orçamento personalizado. Na primeira vez, já vêm as perguntas padrão. */
export async function carregarFormulario(): Promise<GrupoOpcoes[]> {
  const r = await db.formularios.get(ID);
  if (r) return r.grupos;
  const grupos = formularioPadrao(novoId);
  await db.formularios.put({ id: ID, grupos, atualizadoEm: new Date().toISOString() } satisfies FormularioRegistro);
  return grupos;
}

export async function salvarFormulario(grupos: GrupoOpcoes[]): Promise<void> {
  await db.formularios.put({ id: ID, grupos, atualizadoEm: new Date().toISOString() });
}

export async function restaurarFormularioPadrao(): Promise<GrupoOpcoes[]> {
  const grupos = formularioPadrao(novoId);
  await salvarFormulario(grupos);
  return grupos;
}
