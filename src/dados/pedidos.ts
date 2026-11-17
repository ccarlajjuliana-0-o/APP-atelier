import { db, novoId, type Cliente, type Pedido, type MovimentacaoRegistro } from './db.ts';
import { saldoDisponivel } from '../dominio/estoque.ts';
import { ajustarReservas, dataPrometida, itensAtivos, necessidades, totalCentavos, type Pagamento, type StatusPedido } from '../dominio/pedidos.ts';
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
export async function cancelarPedido(id: string, reembolsoCentavos = 0): Promise<void> {
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
    const pagamentos = comReembolso(p, reembolsoCentavos, `Reembolso do cancelamento do pedido #${p.numero}`);
    await db.pedidos.put({ ...p, pagamentos, status: 'cancelado' as StatusPedido, reservas: [], atualizadoEm: agora });
  });
}

/** Acrescenta um pagamento negativo (reembolso) ao pedido; nunca reembolsa mais do que foi pago. */
function comReembolso(p: Pedido, reembolsoCentavos: number, observacao: string): Pagamento[] {
  const r = Math.round(reembolsoCentavos);
  if (!(r > 0)) return p.pagamentos;
  if (r > pagoDoPedido(p)) throw new Error('O reembolso não pode ser maior do que o valor já pago.');
  return [...p.pagamentos, { data: hojeLocal(), valorCentavos: -r, observacao }];
}

/**
 * Cancelamento parcial: os itens marcados continuam listados como cancelados, o total diminui e o material
 * reservado a mais é liberado. Se todos os itens ativos forem marcados, o pedido inteiro é cancelado.
 * Devolve o pedido e quanto já foi pago além do novo total (para devolver ou abater).
 */
export async function cancelarItens(id: string, indices: number[], reembolsoCentavos = 0): Promise<{ pedido: Pedido; pagoAMaisCentavos: number; inteiro: boolean }> {
  const antes = await db.pedidos.get(id);
  if (!antes) throw new Error('Pedido não encontrado.');
  const ativos = antes.itens.map((i, k) => ({ i, k })).filter((x) => !x.i.cancelado);
  const alvo = new Set(indices.filter((k) => ativos.some((a) => a.k === k)));
  if (alvo.size === 0) throw new Error('Escolha ao menos um item para cancelar.');
  if (alvo.size === ativos.length) {
    await cancelarPedido(id, reembolsoCentavos);
    const depois = (await db.pedidos.get(id))!;
    return { pedido: depois, pagoAMaisCentavos: Math.max(0, pagoDoPedido(depois)), inteiro: true };
  }
  return db.transaction('rw', [db.pedidos, db.movimentacoes, db.produtos], async () => {
    const p = await db.pedidos.get(id);
    if (!p) throw new Error('Pedido não encontrado.');
    if (p.status === 'pronto' || p.status === 'entregue' || p.status === 'cancelado') throw new Error('Este pedido já não pode ser alterado aqui.');
    const agora = new Date().toISOString();
    const itens = p.itens.map((i, k) => (alvo.has(k) ? { ...i, cancelado: true } : i));
    let reservas = p.reservas;
    if (p.status !== 'orcamento' && p.reservas.length) {
      const ids = [...new Set(itens.map((i) => i.produtoId).filter((x): x is string => !!x))];
      const produtos = await db.produtos.bulkGet(ids);
      const receitas = Object.fromEntries(produtos.filter((x) => !!x).map((x) => [x!.id, x!.receita]));
      const disp = Object.fromEntries(Object.entries(agrupar(await db.movimentacoes.toArray())).map(([mid, l]) => [mid, saldoDisponivel(l)]));
      const aj = ajustarReservas(itensAtivos(itens), receitas, p.reservas, disp);
      for (const l of aj.liberar) {
        await db.movimentacoes.add({ id: novoId(), materialId: l.materialId, tipo: 'liberacao', quantidade: l.quantidade, criadoEm: agora, observacao: `Cancelamento parcial do pedido #${p.numero}` });
      }
      reservas = aj.reservas;
    }
    const nomes = [...alvo].map((k) => p.itens[k].descricao).join(', ');
    const novoTotal = totalCentavos(itens);
    const pagamentos = comReembolso(p, reembolsoCentavos, `Reembolso do cancelamento parcial do pedido #${p.numero}`);
    const pagoAMais = Math.max(0, pagamentos.reduce((t, x) => t + x.valorCentavos, 0) - novoTotal);
    const dinheiro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
    const nota = `Cancelamento parcial em ${hojeLocal().split('-').reverse().join('/')}: ${nomes}.${reembolsoCentavos > 0 ? ` Reembolsado ${dinheiro(Math.round(reembolsoCentavos))}.` : ''}${pagoAMais > 0 ? ` Já pago a mais: ${dinheiro(pagoAMais)} (devolver ou abater).` : ''}`;
    const novo: Pedido = { ...p, itens, pagamentos, reservas, observacoes: [p.observacoes, nota].filter(Boolean).join(' '), atualizadoEm: agora };
    await db.pedidos.put(novo);
    return { pedido: novo, pagoAMaisCentavos: pagoAMais, inteiro: false };
  });
}

function pagoDoPedido(p: Pedido): number {
  return p.pagamentos.reduce((s, x) => s + x.valorCentavos, 0);
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

/**
 * "Pedir novamente": cria um pedido novo com os mesmos itens (inclusive os que foram cancelados antes).
 * Se a cliente confirmou e/ou deu sinal, já confirma e reserva o material; senão fica como orçamento.
 */
export async function repetirPedido(id: string, confirmou: boolean, sinalCentavos: number): Promise<Pedido> {
  const orig = await db.pedidos.get(id);
  if (!orig) throw new Error('Pedido não encontrado.');
  const itens = orig.itens.map((i) => ({ ...i, cancelado: false, devolvido: false }));
  if (itens.length === 0) throw new Error('Este pedido não tem itens para repetir.');
  let ped = await salvarPedido({
    ...pedidoNovo(0), clienteId: orig.clienteId, tipo: orig.tipo, itens, prazoDias: orig.prazoDias,
    observacoes: `Repetição do pedido #${orig.numero}.`,
  });
  if (confirmou || sinalCentavos > 0) {
    ped = await avancarPedido(ped.id);
    if (sinalCentavos > 0) {
      ped = await registrarPagamento(ped.id, { data: hojeLocal(), valorCentavos: Math.round(sinalCentavos), observacao: `Sinal (repetição do pedido #${orig.numero})` });
    }
  }
  return ped;
}

/** Reembolso avulso, para pedido já cancelado (ou pago a mais): entra como pagamento negativo. */
export async function reembolsarPedido(id: string, centavos: number): Promise<Pedido> {
  return db.transaction('rw', db.pedidos, async () => {
    const p = await db.pedidos.get(id);
    if (!p) throw new Error('Pedido não encontrado.');
    if (!(Math.round(centavos) > 0)) throw new Error('Informe o valor do reembolso.');
    const pagamentos = comReembolso(p, centavos, `Reembolso do pedido #${p.numero}`);
    const novo = { ...p, pagamentos, atualizadoEm: new Date().toISOString() };
    await db.pedidos.put(novo);
    return novo;
  });
}
