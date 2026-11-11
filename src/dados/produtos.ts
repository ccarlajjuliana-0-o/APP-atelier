import { db, novoId, type Produto } from './db.ts';

export async function listarProdutos(): Promise<Produto[]> {
  const lista = await db.produtos.toArray();
  return lista.map((p) => ({ ...p, ativo: p.ativo !== false })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarProduto(p: Produto): Promise<Produto> {
  const salvo = { ...p, id: p.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.produtos.put(salvo);
  return salvo;
}

export async function duplicarProduto(p: Produto): Promise<Produto> {
  return salvarProduto({ ...p, id: '', nome: `${p.nome} (cópia)`, receita: p.receita.map((i) => ({ ...i })), perfil3d: p.perfil3d ? { ...p.perfil3d } : null });
}
