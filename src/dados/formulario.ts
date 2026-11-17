import { db, novoId } from './db.ts';
import { VERSAO_FORMULARIO, formularioPadrao } from '../dominio/formularioPadrao.ts';
import type { GrupoOpcoes } from '../dominio/opcoes.ts';

const ID = 'orcamento';

async function gravar(grupos: GrupoOpcoes[], editado: boolean): Promise<void> {
  await db.formularios.put({ id: ID, grupos, versao: VERSAO_FORMULARIO, editado, atualizadoEm: new Date().toISOString() });
}

/**
 * Perguntas do orçamento personalizado. Na primeira vez vêm as perguntas padrão; se ainda não foram editadas
 * e o padrão ganhou uma versão nova, elas são atualizadas.
 */
export async function carregarFormulario(): Promise<GrupoOpcoes[]> {
  const r = await db.formularios.get(ID);
  if (r && (r.editado || (r.versao ?? 0) >= VERSAO_FORMULARIO)) return r.grupos;
  const grupos = formularioPadrao(novoId);
  await gravar(grupos, false);
  return grupos;
}

/** Salva as perguntas editadas pela dona. */
export async function salvarFormulario(grupos: GrupoOpcoes[]): Promise<void> {
  await gravar(grupos, true);
}

export async function restaurarFormularioPadrao(): Promise<GrupoOpcoes[]> {
  const grupos = formularioPadrao(novoId);
  await gravar(grupos, false);
  return grupos;
}
