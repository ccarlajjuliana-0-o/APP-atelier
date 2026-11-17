import { db, novoId } from './db.ts';
import { extrasPadrao, type ExtraCatalogo } from '../dominio/extras.ts';

/** Lista os extras; na primeira vez, cadastra os extras de encadernação que já vêm prontos. */
export async function listarExtras(): Promise<ExtraCatalogo[]> {
  if ((await db.extras.count()) === 0) await db.extras.bulkPut(extrasPadrao(new Date().toISOString()));
  return (await db.extras.toArray()).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function extraNovo(ordem: number): ExtraCatalogo {
  return { id: '', nome: '', precoCentavos: 0, materialId: null, quantidade: 1, variantes: [], pedeTexto: '', ativo: true, ordem, atualizadoEm: '' };
}

export async function salvarExtra(e: ExtraCatalogo): Promise<ExtraCatalogo> {
  const salvo = { ...e, id: e.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.extras.put(salvo);
  return salvo;
}
