import { db, novoId } from './db.ts';
import { completarAjustes, type Ajustes, type CompraCaixa, type Despesa, type PagamentoCaixa } from '../dominio/financeiro.ts';
import { resumoProduto, type InfoMaterial } from '../dominio/produtos.ts';
import { totalCentavos } from '../dominio/pedidos.ts';

export async function carregarAjustes(): Promise<Ajustes> {
  return completarAjustes(await db.ajustes.get('financeiro'));
}

export async function salvarAjustes(a: Ajustes): Promise<void> {
  await db.ajustes.put({ ...a, id: 'financeiro' });
}

export async function listarDespesas(): Promise<Despesa[]> {
  const l = await db.despesas.toArray();
  return l.sort((a, b) => b.data.localeCompare(a.data) || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

export async function salvarDespesa(d: Despesa): Promise<Despesa> {
  const salvo = { ...d, id: d.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.despesas.put(salvo);
  return salvo;
}

/** AAAA-MM-DD no fuso do aparelho a partir de um instante ISO. */
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Tudo que entrou (pagamentos de pedidos) e saiu (compras de material), para o caixa. */
export async function dadosDoCaixa(): Promise<{ pagamentos: PagamentoCaixa[]; compras: CompraCaixa[] }> {
  const [pedidos, clientes, movs, materiais] = await Promise.all([
    db.pedidos.toArray(), db.clientes.toArray(), db.movimentacoes.toArray(), db.materiais.toArray(),
  ]);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const nomeMat = new Map(materiais.map((m) => [m.id, m.nome]));
  const pagamentos: PagamentoCaixa[] = [];
  for (const p of pedidos) {
    if (p.status === 'cancelado') continue; // pagamento de pedido cancelado: devolva e registre como despesa avulsa
    for (const g of p.pagamentos) {
      pagamentos.push({ data: g.data, valorCentavos: g.valorCentavos, descricao: `Pedido #${p.numero} · ${nomeCliente.get(p.clienteId ?? '') ?? 'cliente'}${g.observacao ? ` · ${g.observacao}` : ''}` });
    }
  }
  const compras: CompraCaixa[] = movs
    .filter((m) => m.tipo === 'entrada' && m.valorTotalCentavos !== undefined && m.valorTotalCentavos > 0)
    .map((m) => ({ data: dataLocal(m.criadoEm), valorCentavos: m.valorTotalCentavos ?? 0, descricao: `Compra: ${nomeMat.get(m.materialId) ?? 'material'}${m.fornecedor ? ` · ${m.fornecedor}` : ''}` }));
  return { pagamentos, compras };
}

/** Custo de material atual por produto, em centavos. */
export async function materiaisPorProduto(): Promise<Record<string, { materiais: number; semCusto: number }>> {
  const [produtos, materiais] = await Promise.all([db.produtos.toArray(), db.materiais.toArray()]);
  const info: Record<string, InfoMaterial> = {};
  for (const m of materiais) info[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: 0 };
  return Object.fromEntries(produtos.map((p) => {
    const r = resumoProduto(p.receita, info);
    return [p.id, { materiais: r.custoCentavos, semCusto: r.semCusto.length }];
  }));
}

export interface HistoricoPedidos {
  pedidos: number;
  ticketMedio: number;
  materialMedio: number;
}

/** Pedidos confirmados (não cancelados) dos últimos 90 dias: ticket médio e custo médio de material. */
export async function historicoDePedidos(): Promise<HistoricoPedidos> {
  const corte = Date.now() - 90 * 86_400_000;
  const [pedidos, custos] = await Promise.all([db.pedidos.toArray(), materiaisPorProduto()]);
  const validos = pedidos.filter((p) => p.status !== 'cancelado' && p.status !== 'orcamento' && new Date(p.criadoEm).getTime() >= corte);
  if (validos.length === 0) return { pedidos: 0, ticketMedio: 0, materialMedio: 0 };
  let total = 0;
  let material = 0;
  for (const p of validos) {
    total += totalCentavos(p.itens);
    for (const i of p.itens) if (i.produtoId) material += (custos[i.produtoId]?.materiais ?? 0) * i.quantidade;
  }
  return { pedidos: validos.length, ticketMedio: Math.round(total / validos.length), materialMedio: Math.round(material / validos.length) };
}
