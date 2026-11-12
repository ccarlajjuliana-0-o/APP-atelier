import { db } from './db.ts';

// Backup manual: um arquivo .json com todos os dados. Arquivos (fontes, escritas) vão como texto base64.

function blobParaBase64(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsDataURL(b);
  });
}

async function base64ParaBlob(url: string): Promise<Blob> {
  const resp = await fetch(url);
  return resp.blob();
}

export async function exportarTudo(): Promise<Blob> {
  const fontes = await Promise.all(
    (await db.fontes.toArray()).map(async (f) => ({ ...f, arquivo: await blobParaBase64(f.arquivo) })),
  );
  const escritas = await Promise.all(
    (await db.escritas.toArray()).map(async (e) => ({ ...e, imagem: await blobParaBase64(e.imagem) })),
  );
  const mostruario = await Promise.all(
    (await db.mostruario.toArray()).map(async (m) => ({ ...m, previa: await blobParaBase64(m.previa) })),
  );
  const materiais = await Promise.all(
    (await db.materiais.toArray()).map(async (m) => ({ ...m, foto: m.foto ? await blobParaBase64(m.foto) : null })),
  );
  const produtos = await Promise.all(
    (await db.produtos.toArray()).map(async (p) => ({ ...p, fotos: await Promise.all((p.fotos ?? []).map(blobParaBase64)) })),
  );
  const equipamentos = await Promise.all(
    (await db.equipamentos.toArray()).map(async (e) => ({ ...e, fotos: await Promise.all((e.fotos ?? []).map(blobParaBase64)) })),
  );
  const publicacoes = await Promise.all(
    (await db.publicacoes.toArray()).map(async (p) => ({ ...p, imagens: await Promise.all((p.imagens ?? []).map(blobParaBase64)) })),
  );
  const dados = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    materiais,
    movimentacoes: await db.movimentacoes.toArray(),
    fontes,
    escritas,
    mostruario,
    produtos,
    fornecedores: await db.fornecedores.toArray(),
    clientes: await db.clientes.toArray(),
    pedidos: await db.pedidos.toArray(),
    despesas: await db.despesas.toArray(),
    ajustes: await db.ajustes.toArray(),
    equipamentos,
    publicacoes,
    preferencias: await db.preferencias.toArray(),
  };
  return new Blob([JSON.stringify(dados)], { type: 'application/json' });
}

export async function importarTudo(arquivo: File): Promise<void> {
  const dados = JSON.parse(await arquivo.text());
  if (dados.versao !== 1) throw new Error('Arquivo de backup de versão desconhecida.');
  const fontes = await Promise.all(
    (dados.fontes ?? []).map(async (f: any) => ({ ...f, arquivo: await base64ParaBlob(f.arquivo) })),
  );
  const escritas = await Promise.all(
    (dados.escritas ?? []).map(async (e: any) => ({ ...e, imagem: await base64ParaBlob(e.imagem) })),
  );
  const mostruario = await Promise.all(
    (dados.mostruario ?? []).map(async (m: any) => ({ ...m, previa: await base64ParaBlob(m.previa) })),
  );
  const materiais = await Promise.all(
    (dados.materiais ?? []).map(async (m: any) => ({ ...m, foto: m.foto ? await base64ParaBlob(m.foto) : null })),
  );
  const produtos = await Promise.all(
    (dados.produtos ?? []).map(async (p: any) => ({ ...p, fotos: await Promise.all((p.fotos ?? []).map(base64ParaBlob)) })),
  );
  const equipamentos = await Promise.all(
    (dados.equipamentos ?? []).map(async (e: any) => ({ ...e, fotos: await Promise.all((e.fotos ?? []).map(base64ParaBlob)) })),
  );
  const publicacoes = await Promise.all(
    (dados.publicacoes ?? []).map(async (p: any) => ({ ...p, imagens: await Promise.all((p.imagens ?? []).map(base64ParaBlob)) })),
  );
  await db.transaction('rw', [db.materiais, db.movimentacoes, db.fontes, db.escritas, db.mostruario, db.produtos, db.fornecedores, db.clientes, db.pedidos, db.despesas, db.ajustes, db.equipamentos, db.publicacoes, db.preferencias], async () => {
    await db.materiais.bulkPut(materiais);
    await db.movimentacoes.bulkPut(dados.movimentacoes ?? []);
    await db.fontes.bulkPut(fontes);
    await db.escritas.bulkPut(escritas);
    await db.mostruario.bulkPut(mostruario);
    await db.produtos.bulkPut(produtos);
    await db.fornecedores.bulkPut(dados.fornecedores ?? []);
    await db.clientes.bulkPut(dados.clientes ?? []);
    await db.pedidos.bulkPut(dados.pedidos ?? []);
    await db.despesas.bulkPut(dados.despesas ?? []);
    await db.ajustes.bulkPut(dados.ajustes ?? []);
    await db.equipamentos.bulkPut(equipamentos);
    await db.publicacoes.bulkPut(publicacoes);
    await db.preferencias.bulkPut(dados.preferencias ?? []);
  });
}

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
