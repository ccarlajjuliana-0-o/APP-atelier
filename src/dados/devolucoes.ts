import { db, novoId, type Pedido } from './db.ts';
import { avancarPedido, hojeLocal, pedidoNovo, salvarPedido } from './pedidos.ts';
import { pagoCentavos } from '../dominio/pedidos.ts';
import {
  dentroDoPrazo, impedimentoDevolucao, pecaNova, type Devolucao, type MeioDevolucao, type MotivoDevolucao, type SituacaoPeca, type SolucaoDevolucao,
} from '../dominio/devolucoes.ts';

export interface EntradaDevolucao {
  solicitadaEm: string;
  motivoTipo: MotivoDevolucao;
  motivo: string;
  meio: MeioDevolucao;
  meioDetalhe: string;
  solucao: SolucaoDevolucao;
  indices: number[]; // itens do pedido que voltam
  reembolsoCentavos: number;
  aceitaForaDoPrazo: boolean;
}

/**
 * Registra a devolução de um pedido entregue. No reembolso, os itens saem do total e o valor entra como pagamento negativo;
 * na troca, nasce um novo pedido igual (sem cobrança) já confirmado, com o material reservado.
 */
export async function registrarDevolucao(pedidoId: string, e: EntradaDevolucao): Promise<{ pedido: Pedido; novo: Pedido | null }> {
  const p = await db.pedidos.get(pedidoId);
  if (!p) throw new Error('Pedido não encontrado.');
  if (p.status !== 'entregue' || !p.entregueEm) throw new Error('Só pedidos entregues podem ter devolução.');
  const validos = new Set(p.itens.map((i, k) => ({ i, k })).filter((x) => !x.i.cancelado && !x.i.devolvido).map((x) => x.k));
  const indices = [...new Set(e.indices)].filter((k) => validos.has(k)).sort((a, b) => a - b);
  const prazoOk = dentroDoPrazo(p.entregueEm, e.solicitadaEm);
  const erro = impedimentoDevolucao({
    motivoTipo: e.motivoTipo, motivo: e.motivo, solucao: e.solucao, pecas: indices.length, reembolsoCentavos: e.solucao === 'reembolso' ? Math.round(e.reembolsoCentavos) : 0,
    pagoCentavos: pagoCentavos(p.pagamentos), dentroDoPrazo: prazoOk, aceitaForaDoPrazo: e.aceitaForaDoPrazo,
  });
  if (erro) throw new Error(erro);

  const pecas = indices.map((k) => {
    const i = p.itens[k];
    return pecaNova(k, i.descricao, i.quantidade, Math.round(i.quantidade * i.precoUnitCentavos));
  });
  const dev: Devolucao = {
    id: novoId(), solicitadaEm: e.solicitadaEm, dentroDoPrazo: prazoOk, motivoTipo: e.motivoTipo, motivo: e.motivo.trim(),
    meio: e.meio, meioDetalhe: e.meioDetalhe.trim(), solucao: e.solucao, reembolsoCentavos: 0, novoPedidoId: null, novoPedidoNumero: null,
    pecas, criadoEm: new Date().toISOString(),
  };

  let novo: Pedido | null = null;
  let pedido: Pedido = { ...p };
  if (e.solucao === 'novo_pedido') {
    const base = pedidoNovo(0);
    const copia = indices.map((k) => ({ ...p.itens[k], precoUnitCentavos: 0, precoBaseCentavos: 0, cancelado: false, devolvido: false }));
    novo = await salvarPedido({
      ...base, clienteId: p.clienteId, tipo: p.tipo, itens: copia, prazoDias: p.prazoDias,
      observacoes: `Troca sem custo da devolução do pedido #${p.numero}.`,
    });
    novo = await avancarPedido(novo.id);
    dev.novoPedidoId = novo.id;
    dev.novoPedidoNumero = novo.numero;
  } else {
    const r = Math.round(e.reembolsoCentavos);
    dev.reembolsoCentavos = r;
    pedido = {
      ...p,
      itens: p.itens.map((i, k) => (indices.includes(k) ? { ...i, devolvido: true } : i)),
      pagamentos: [...p.pagamentos, { data: hojeLocal(), valorCentavos: -r, observacao: `Reembolso da devolução do pedido #${p.numero}` }],
    };
  }
  pedido = { ...pedido, devolucoes: [...(p.devolucoes ?? []), dev], atualizadoEm: new Date().toISOString() };
  await db.pedidos.put(pedido);
  return { pedido, novo };
}

export type ResultadoPeca = 'ok' | 'conserto' | 'perda';

/**
 * Dá entrada na peça que voltou: em bom estado volta ao estoque (soma em "prontos" do catálogo),
 * com defeito vai para conserto, ou vira perda e é lançada como despesa avulsa (desperdício).
 */
export async function darEntradaPeca(
  pedidoId: string, devolucaoId: string, pecaPos: number,
  r: { data: string; resultado: ResultadoPeca; nota: string; perdaCentavos: number },
): Promise<Pedido> {
  return db.transaction('rw', [db.pedidos, db.produtos, db.despesas], async () => {
    const p = await db.pedidos.get(pedidoId);
    const dev = p?.devolucoes?.find((d) => d.id === devolucaoId);
    const peca = dev?.pecas[pecaPos];
    if (!p || !dev || !peca) throw new Error('Devolução não encontrada.');
    if (peca.situacao !== 'a_caminho' && peca.situacao !== 'em_conserto') throw new Error('Esta peça já foi avaliada.');
    if (r.resultado === 'conserto' && peca.situacao === 'em_conserto') throw new Error('Esta peça já está em conserto.');
    const agora = new Date().toISOString();
    const item = p.itens[peca.indice];
    let situacao: SituacaoPeca = peca.situacao;
    if (r.resultado === 'ok') {
      situacao = 'no_estoque';
      const prod = item?.produtoId ? await db.produtos.get(item.produtoId) : undefined;
      if (prod) await db.produtos.put({ ...prod, prontos: (prod.prontos ?? 0) + peca.quantidade, atualizadoEm: agora });
    } else if (r.resultado === 'conserto') {
      situacao = 'em_conserto';
    } else {
      situacao = 'perda';
      if (r.perdaCentavos > 0) {
        await db.despesas.put({
          id: novoId(), tipo: 'avulsa', descricao: `Desperdício (devolução do pedido #${p.numero}): ${peca.descricao}`,
          valorCentavos: Math.round(r.perdaCentavos), data: r.data, ativo: true, atualizadoEm: agora,
        });
      }
    }
    const nota = [peca.nota, r.nota.trim() && `${r.data.split('-').reverse().join('/')}: ${r.nota.trim()}`].filter(Boolean).join(' · ');
    const novaPeca = { ...peca, situacao, recebidaEm: peca.recebidaEm ?? r.data, nota, perdaCentavos: situacao === 'perda' ? Math.round(r.perdaCentavos) : 0 };
    const devolucoes = (p.devolucoes ?? []).map((d) => (d.id === devolucaoId ? { ...d, pecas: d.pecas.map((x, k) => (k === pecaPos ? novaPeca : x)) } : d));
    const novo: Pedido = { ...p, devolucoes, atualizadoEm: agora };
    await db.pedidos.put(novo);
    return novo;
  });
}
