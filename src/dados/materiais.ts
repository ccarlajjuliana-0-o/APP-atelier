import { db, novoId, type Material, type MovimentacaoRegistro } from './db.ts';
import { converterCompra, saldoDisponivel, saldoFisico } from '../dominio/estoque.ts';
import { MATERIAIS_INICIAIS, custoAposCompra } from '../dominio/materiais.ts';

export interface Saldo {
  fisico: number;
  disponivel: number;
}

export async function listarMateriais(): Promise<Material[]> {
  const lista = await db.materiais.toArray();
  return lista.map((x) => ({ ...x, ativo: x.ativo !== false })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function saldos(): Promise<Record<string, Saldo>> {
  const movs = await db.movimentacoes.toArray();
  const porMaterial: Record<string, MovimentacaoRegistro[]> = {};
  for (const mv of movs) (porMaterial[mv.materialId] ??= []).push(mv);
  const out: Record<string, Saldo> = {};
  for (const [id, lista] of Object.entries(porMaterial)) {
    out[id] = { fisico: saldoFisico(lista), disponivel: saldoDisponivel(lista) };
  }
  return out;
}

export async function carregarListaInicial(): Promise<number> {
  const existentes = new Set((await db.materiais.toArray()).map((x) => x.nome.toLowerCase()));
  const agora = new Date().toISOString();
  const novos: Material[] = MATERIAIS_INICIAIS.filter((i) => !existentes.has(i.nome.toLowerCase())).map((i) => ({
    ...i, id: novoId(), custoMedioMicro: 0, ativo: true, atualizadoEm: agora,
  }));
  await db.materiais.bulkAdd(novos);
  return novos.length;
}

export async function salvarMaterial(m: Material): Promise<void> {
  await db.materiais.put({ ...m, atualizadoEm: new Date().toISOString() });
}

export async function registrarCompra(
  materialId: string,
  embalagens: number,
  unidadesPorEmbalagem: number,
  valorTotalCentavos: number,
  fornecedor: string,
): Promise<void> {
  await db.transaction('rw', db.materiais, db.movimentacoes, async () => {
    const mat = await db.materiais.get(materialId);
    if (!mat) throw new Error('Material não encontrado.');
    const movs = await db.movimentacoes.where('materialId').equals(materialId).toArray();
    const { quantidade, custoUnitMicro } = converterCompra(embalagens, unidadesPorEmbalagem, valorTotalCentavos);
    const novoCusto = custoAposCompra(saldoFisico(movs), mat.custoMedioMicro, quantidade, custoUnitMicro);
    await db.movimentacoes.add({
      id: novoId(), materialId, tipo: 'entrada', quantidade, criadoEm: new Date().toISOString(),
      custoUnitMicro, valorTotalCentavos, fornecedor: fornecedor || undefined,
    });
    await db.materiais.update(materialId, { custoMedioMicro: novoCusto, atualizadoEm: new Date().toISOString() });
  });
}

/** Contagem física: grava a diferença como ajuste. Devolve a diferença (0 = nada a fazer). */
export async function ajustarSaldo(materialId: string, contagem: number, motivo: string): Promise<number> {
  return db.transaction('rw', db.movimentacoes, async () => {
    const movs = await db.movimentacoes.where('materialId').equals(materialId).toArray();
    const dif = contagem - saldoFisico(movs);
    if (dif !== 0) {
      await db.movimentacoes.add({
        id: novoId(), materialId, tipo: 'ajuste', quantidade: dif, criadoEm: new Date().toISOString(),
        observacao: motivo || undefined,
      });
    }
    return dif;
  });
}

export async function historico(materialId: string, limite = 12): Promise<MovimentacaoRegistro[]> {
  const movs = await db.movimentacoes.where('materialId').equals(materialId).toArray();
  return movs.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, limite);
}

export interface UltimaCompra {
  data: string;
  valorCentavos: number;
  fornecedor?: string;
}

export async function ultimasCompras(): Promise<Record<string, UltimaCompra>> {
  const entradas = (await db.movimentacoes.toArray()).filter((m) => m.tipo === 'entrada' && m.valorTotalCentavos !== undefined);
  const out: Record<string, UltimaCompra> = {};
  for (const m of entradas) {
    const atual = out[m.materialId];
    if (!atual || m.criadoEm > atual.data) out[m.materialId] = { data: m.criadoEm, valorCentavos: m.valorTotalCentavos ?? 0, fornecedor: m.fornecedor };
  }
  return out;
}
