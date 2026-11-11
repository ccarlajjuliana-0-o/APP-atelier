import { db, novoId, type Fornecedor } from './db.ts';
import { resumirFornecedor, type ResumoFornecedor } from '../dominio/fornecedores.ts';

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const lista = await db.fornecedores.toArray();
  return lista.map((f) => ({ ...f, ativo: f.ativo !== false })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarFornecedor(f: Fornecedor): Promise<Fornecedor> {
  const salvo = { ...f, id: f.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.fornecedores.put(salvo);
  return salvo;
}

export async function resumosPorFornecedor(nomes: string[]): Promise<Record<string, ResumoFornecedor>> {
  const compras = (await db.movimentacoes.toArray()).filter((m) => m.tipo === 'entrada');
  return Object.fromEntries(nomes.map((n) => [n, resumirFornecedor(compras, n)]));
}
