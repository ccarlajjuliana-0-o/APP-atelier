import { db, type MostruarioRegistro } from './db.ts';
import { nuvem } from './nuvem.ts';
import { lerPacote, idsParaOcultar } from '../dominio/mostruario.ts';

/** Importa o pacote no aparelho (sempre) e, se a nuvem estiver ligada, também no Supabase. */
export async function importarPacote(arquivo: File): Promise<{ total: number; nuvem: boolean }> {
  const itens = lerPacote(await arquivo.text());
  const registros: MostruarioRegistro[] = [];
  for (const it of itens) {
    const previa = await (await fetch(it.preview)).blob();
    const { preview: _p, ...resto } = it;
    registros.push({ ...resto, visivel: true, previa });
  }
  const existentes = (await db.mostruario.toArray()).filter((m) => !m.manual).map((m) => m.id);
  const ocultar = idsParaOcultar(existentes, registros.map((r) => r.id));
  await db.transaction('rw', db.mostruario, async () => {
    await db.mostruario.bulkPut(registros);
    for (const id of ocultar) await db.mostruario.update(id, { visivel: false });
  });

  let naNuvem = false;
  if (nuvem) {
    const sessao = await nuvem.auth.getSession();
    if (sessao.data.session) {
      for (const r of registros.filter((x) => x.tipo !== 'capa')) { // a tabela da nuvem só conhece miolos e adesivos
        const ext = r.previa.type === 'image/png' ? 'png' : 'jpg';
        const caminho = `${r.tipo}/${r.id}.${ext}`;
        const up = await nuvem.storage.from('mostruario').upload(caminho, r.previa, { upsert: true, contentType: r.previa.type });
        if (up.error) throw up.error;
        const { error } = await nuvem.from('mostruario_itens').upsert({
          id: r.id, tipo: r.tipo, nome: r.nome, categoria: r.categoria, descricao: r.descricao,
          tamanhos: r.tamanhos, tamanho_base: r.tamanhoBase, ordem: r.ordem,
          preview_path: caminho, visivel: true, atualizado_em: r.atualizadoEm,
        });
        if (error) throw error;
      }
      if (ocultar.length) await nuvem.from('mostruario_itens').update({ visivel: false }).in('id', ocultar);
      naNuvem = true;
    }
  }
  return { total: registros.length, nuvem: naNuvem };
}

/** Traz para o aparelho os modelos e adesivos que o Estúdio de Miolos enviou à nuvem (e esconde os que ele escondeu). */
export async function buscarDoEditor(): Promise<{ novos: number; atualizados: number }> {
  const r = { novos: 0, atualizados: 0 };
  if (!nuvem) return r;
  const sessao = await nuvem.auth.getSession();
  if (!sessao.data.session) return r;
  const { data, error } = await nuvem.from('mostruario_itens').select('*');
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.tipo !== 'modelo' && row.tipo !== 'adesivo') continue;
    const local = await db.mostruario.get(row.id);
    const nuvemEm = String(row.atualizado_em ?? '');
    if (local && local.atualizadoEm >= nuvemEm && local.visivel === !!row.visivel) continue;
    if (!row.visivel) {
      if (local) { await db.mostruario.update(row.id, { visivel: false, atualizadoEm: nuvemEm || local.atualizadoEm }); r.atualizados++; }
      continue;
    }
    if (local && local.atualizadoEm >= nuvemEm) { await db.mostruario.update(row.id, { visivel: true }); r.atualizados++; continue; }
    const baixa = await nuvem.storage.from('mostruario').download(row.preview_path);
    if (baixa.error || !baixa.data) continue;
    await db.mostruario.put({
      id: row.id, tipo: row.tipo, manual: true, nome: row.nome, categoria: row.categoria ?? '', descricao: row.descricao ?? '',
      tamanhos: row.tamanhos ?? [], tamanhoBase: row.tamanho_base ?? null, ordem: row.ordem ?? 0, visivel: true,
      previa: baixa.data, atualizadoEm: nuvemEm || new Date().toISOString(),
    });
    if (local) r.atualizados++; else r.novos++;
  }
  return r;
}
