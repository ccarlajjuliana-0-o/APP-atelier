import { db, novoId, type Cliente, type Pedido, type MovimentacaoRegistro } from './db.ts';
import { saldoDisponivel } from '../dominio/estoque.ts';
import { dataPrometida, necessidades, totalCentavos, type Pagamento, type StatusPedido } from '../dominio/pedidos.ts';
import { MIN_DIAS_COM_BAIXA, diasComBaixa, diasRestantes, ritmoPorDia } from '../dominio/consumo.ts';

/** Data de hoje no fuso do aparelho, no formato AAAA-MM-DD. */
export function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- clientes ----------

export async function listarClientes(): Promise<Cliente[]> {
  const lista = await db.clientes.toArray();
  return lista.map((c) => ({ ...c, ativo: c.ativo !== false })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarCliente(c: Cliente): Promise<Cliente> {
  const salvo = { ...c, id: c.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.clientes.put(salvo);
  return salvo;
}

export interface ResumoCliente {
  pedidos: number;
  totalCentavos: number;
  ultimo: string | null;
}

export async function resumosPorCliente(): Promise<Record<string, ResumoCliente>> {
  const out: Record<string, ResumoCliente> = {};
  for (const p of await db.pedidos.toArray()) {
    if (!p.clienteId || p.status === 'cancelado' || p.status === 'orcamento') continue;
    const r = (out[p.clienteId] ??= { pedidos: 0, totalCentavos: 0, ultimo: null });
    r.pedidos += 1;
    r.totalCentavos += totalCentavos(p.itens);
    if (!r.ultimo || p.criadoEm > r.ultimo) r.ultimo = p.criadoEm;
  }
  return out;
}

// ---------- pedidos ----------

export async function listarPedidos(): Promise<Pedido[]> {
  const lista = await db.pedidos.toArray();
  return lista.sort((a, b) => b.numero - a.numero);
}

export function pedidoNovo(numero: number): Pedido {
  return {
    id: '', numero, clienteId: null, tipo: 'personalizado', status: 'orcamento', itens: [], observacoes: '',
    prazoDias: 20, criadoEm: '', confirmadoEm: null, dataPrometida: null, entregueEm: null,
    pagamentos: [], reservas: [], atualizadoEm: '',
  };
}

export async function proximoNumero(): Promise<number> {
  const todos = await db.pedidos.toArray();
  return todos.reduce((m, p) => Math.max(m, p.numero), 0) + 1;
}

/** Cria ou atualiza o pedido. O número é definido na criação. */
export async function salvarPedido(p: Pedido): Promise<Pedido> {
  return db.transaction('rw', db.pedidos, async () => {
    const agora = new Date().toISOString();
    const numero = p.id ? p.numero : (await db.pedidos.toArray()).reduce((m, x) => Math.max(m, x.numero), 0) + 1;
    const salvo: Pedido = { ...p, id: p.id || novoId(), numero, criadoEm: p.criadoEm || agora, atualizadoEm: agora };
    await db.pedidos.put(salvo);
    return salvo;
  });
}

function agrupar(movs: MovimentacaoRegistro[]): Record<string, MovimentacaoRegistro[]> {
  const out: Record<string, MovimentacaoRegistro[]> = {};
  for (const m of movs) (out[m.materialId] ??= []).push(m);
  return out;
}

/** Material disponível (físico menos reservado) por material. */
export async function disponiveis(): Promise<Record<string, number>> {
  const por = agrupar(await db.movimentacoes.toArray());
  return Object.fromEntries(Object.entries(por).map(([id, l]) => [id, saldoDisponivel(l)]));
}

/**
 * Faz o pedido andar uma etapa.
 * - confirmado: reserva o material e fixa a data prometida;
 * - pronto: dá baixa no material reservado;
 * - entregue: registra a data.
 */
export async function avancarPedido(id: string): Promise<Pedido> {
  return db.transaction('rw', [db.pedidos, db.movimentacoes, db.produtos], async () => {
    const p = await db.pedidos.get(id);
    if (!p) throw new Error('Pedido não encontrado.');
    const agora = new Date().toISOString();
    const hoje = hojeLocal();
    let novo: Pedido = { ...p, atualizadoEm: agora };

    if (p.status === 'orcamento') {
      if (p.itens.length === 0) throw new Error('Inclua ao menos um item antes de confirmar.');
      const ids = [...new Set(p.itens.map((i) => i.produtoId).filter((x): x is string => !!x))];
      const produtos = await db.produtos.bulkGet(ids);
      const receitas = Object.fromEntries(produtos.filter((x) => !!x).map((x) => [x!.id, x!.receita]));
      const disp = Object.fromEntries(
        Object.entries(agrupar(await db.movimentacoes.toArray())).map(([mid, l]) => [mid, saldoDisponivel(l)]),
      );
      const reservas = necessidades(p.itens, receitas, disp).filter((n) => n.reservar > 0);
      for (const r of reservas) {
        await db.movimentacoes.add({
          id: novoId(), materialId: r.materialId, tipo: 'reserva', quantidade: r.reservar, criadoEm: agora,
          observacao: `Pedido #${p.numero}`,
        });
      }
      novo = {
        ...novo, status: 'confirmado', confirmadoEm: hoje, dataPrometida: dataPrometida(hoje, p.prazoDias),
        reservas: reservas.map((r) => ({ materialId: r.materialId, quantidade: r.reservar })),
      };
    } else if (p.status === 'confirmado') {
      novo.status = 'em_producao';
    } else if (p.status === 'em_producao') {
      for (const r of p.reservas) {
        await db.movimentacoes.add({
          id: novoId(), materialId: r.materialId, tipo: 'baixa', quantidade: r.quantidade, criadoEm: agora,
          observacao: `Pedido #${p.numero}`,
        });
      }
      novo = { ...novo, status: 'pronto', reservas: [] };
    } else if (p.status === 'pronto') {
      novo = { ...novo, status: 'entregue', entregueEm: hoje };
    } else {
      throw new Error('Este pedido não tem próxima etapa.');
    }
    await db.pedidos.put(novo);
    return novo;
  });
}

/** Cancela e libera o material ainda reservado. Pedido pronto ou entregue não cancela. */
export async function cancelarPedido(id: string): Promise<void> {
  await db.transaction('rw', [db.pedidos, db.movimentacoes], async () => {
    const p = await db.pedidos.get(id);
    if (!p) throw new Error('Pedido não encontrado.');
    if (p.status === 'pronto' || p.status === 'entregue' || p.status === 'cancelado') {
      throw new Error('Este pedido já não pode ser cancelado aqui.');
    }
    const agora = new Date().toISOString();
    for (const r of p.reservas) {
      await db.movimentacoes.add({
        id: novoId(), materialId: r.materialId, tipo: 'liberacao', quantidade: r.quantidade, criadoEm: agora,
        observacao: `Cancelamento do pedido #${p.numero}`,
      });
    }
    await db.pedidos.put({ ...p, status: 'cancelado' as StatusPedido, reservas: [], atualizadoEm: agora });
  });
}

export async function registrarPagamento(id: string, pagamento: Pagamento): Promise<Pedido> {
  return db.transaction('rw', db.pedidos, async () => {
    const p = await db.pedidos.get(id);
    if (!p) throw new Error('Pedido não encontrado.');
    const novo = { ...p, pagamentos: [...p.pagamentos, pagamento], atualizadoEm: new Date().toISOString() };
    await db.pedidos.put(novo);
    return novo;
  });
}

// ---------- ritmo de consumo ----------

export interface Duracao {
  ritmoPorDia: number;
  dias: number | null;
  acabaEm: string | null; // AAAA-MM-DD
}

/** Quanto tempo cada material dura no ritmo dos últimos 90 dias (só com baixas em 3 dias diferentes ou mais). */
export async function duracaoDosMateriais(): Promise<Record<string, Duracao>> {
  const agora = new Date();
  const por = agrupar(await db.movimentacoes.toArray());
  const out: Record<string, Duracao> = {};
  for (const [id, lista] of Object.entries(por)) {
    const baixas = lista.filter((m) => m.tipo === 'baixa');
    if (diasComBaixa(baixas) < MIN_DIAS_COM_BAIXA) continue; // pouco histórico: não estima
    const ritmo = ritmoPorDia(baixas, agora);
    const dias = diasRestantes(saldoDisponivel(lista), ritmo);
    let acabaEm: string | null = null;
    if (dias !== null) {
      const d = new Date(agora.getTime() + dias * 86_400_000);
      acabaEm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    out[id] = { ritmoPorDia: ritmo, dias, acabaEm };
  }
  return out;
}
