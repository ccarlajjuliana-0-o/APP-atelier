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
  const dados = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    materiais: await db.materiais.toArray(),
    movimentacoes: await db.movimentacoes.toArray(),
    fontes,
    escritas,
    mostruario,
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
  await db.transaction('rw', [db.materiais, db.movimentacoes, db.fontes, db.escritas, db.mostruario], async () => {
    await db.materiais.bulkPut(dados.materiais ?? []);
    await db.movimentacoes.bulkPut(dados.movimentacoes ?? []);
    await db.fontes.bulkPut(fontes);
    await db.escritas.bulkPut(escritas);
    await db.mostruario.bulkPut(mostruario);
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
