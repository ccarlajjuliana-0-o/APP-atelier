import { db, novoId, type Pedido } from './db.ts';
import { avancarPedido, pedidoNovo, registrarPagamento, salvarPedido, hojeLocal } from './pedidos.ts';
import { evento, impedimentoParaPedido, tipoDoPedido, totalDoOrcamento, type Orcamento } from '../dominio/orcamentos.ts';
import { prazoPadraoDias } from '../dominio/pedidos.ts';

export async function listarOrcamentos(): Promise<Orcamento[]> {
  return (await db.orcamentos.toArray()).sort((a, b) => b.numero - a.numero);
}

/** Cria ou atualiza. O número é definido na criação e o histórico ganha um registro. */
export async function salvarOrcamento(o: Orcamento, nota?: string): Promise<Orcamento> {
  return db.transaction('rw', db.orcamentos, async () => {
    const agora = new Date().toISOString();
    const novo = !o.id;
    const numero = novo ? (await db.orcamentos.toArray()).reduce((m, x) => Math.max(m, x.numero), 0) + 1 : o.numero;
    const historico = [...o.historico];
    if (novo) historico.push(evento(`Orçamento criado${o.canal ? ` (pedido feito por ${o.canal})` : ''}.`, agora));
    else if (nota) historico.push(evento(nota, agora));
    const salvo: Orcamento = { ...o, id: o.id || novoId(), numero, historico, criadoEm: o.criadoEm || agora, atualizadoEm: agora };
    await db.orcamentos.put(salvo);
    return salvo;
  });
}

export async function recusarOrcamento(id: string, motivo: string): Promise<void> {
  const o = await db.orcamentos.get(id);
  if (!o || o.status !== 'aberto') throw new Error('Orçamento não está em aberto.');
  await db.orcamentos.put({ ...o, status: 'recusado', motivo, historico: [...o.historico, evento(`Não fechou${motivo ? `: ${motivo}` : ''}.`)], atualizadoEm: new Date().toISOString() });
}

export async function reabrirOrcamento(id: string): Promise<void> {
  const o = await db.orcamentos.get(id);
  if (!o || o.status !== 'recusado') return;
  await db.orcamentos.put({ ...o, status: 'aberto', historico: [...o.historico, evento('Reaberto.')], atualizadoEm: new Date().toISOString() });
}

/**
 * Gera o pedido (já confirmado, com o material reservado) a partir do orçamento.
 * Exige a confirmação da cliente e/ou o sinal; o sinal vira o primeiro pagamento do pedido.
 */
export async function converterEmPedido(id: string, confirmou: boolean, sinalCentavos: number): Promise<Pedido> {
  const o = await db.orcamentos.get(id);
  if (!o) throw new Error('Orçamento não encontrado.');
  const erro = impedimentoParaPedido(o, confirmou, sinalCentavos);
  if (erro) throw new Error(erro);
  const tipo = tipoDoPedido(o.itens);
  const base = pedidoNovo(0);
  let ped = await salvarPedido({
    ...base, clienteId: o.clienteId, tipo, itens: o.itens, prazoDias: prazoPadraoDias(tipo),
    observacoes: [o.observacoes, `Veio do orçamento #${o.numero}.`].filter(Boolean).join(' '),
    orcamentoId: o.id, orcamentoNumero: o.numero,
  });
  ped = await avancarPedido(ped.id); // confirma e reserva o material
  if (sinalCentavos > 0) {
    ped = await registrarPagamento(ped.id, { data: hojeLocal(), valorCentavos: Math.round(sinalCentavos), observacao: `Sinal do orçamento #${o.numero}` });
  }
  const texto = `Virou o pedido #${ped.numero}${confirmou ? ' (cliente confirmou)' : ''}${sinalCentavos > 0 ? `, sinal recebido` : ''}.`;
  await db.orcamentos.put({ ...o, status: 'aprovado', pedidoId: ped.id, pedidoNumero: ped.numero, historico: [...o.historico, evento(texto)], atualizadoEm: new Date().toISOString() });
  return ped;
}

export { totalDoOrcamento };
