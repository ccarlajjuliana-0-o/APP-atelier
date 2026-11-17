import { test } from 'node:test';
import assert from 'node:assert/strict';
import { impedimentoParaPedido, orcamentoNovo, tipoDoPedido, totalDoOrcamento, evento } from './orcamentos.ts';
import { necessidades, type ItemPedido } from './pedidos.ts';
import { resumoFicha } from './produtos.ts';

const item = (o: Partial<ItemPedido> = {}): ItemPedido => ({
  produtoId: null, descricao: 'Agenda', quantidade: 2, precoUnitCentavos: 5000, modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: '', ...o,
});

test('só vira pedido com confirmação e/ou sinal', () => {
  const o = { ...orcamentoNovo(), clienteId: 'c1', itens: [item()] };
  assert.match(impedimentoParaPedido(o, false, 0) ?? '', /confirma/);
  assert.equal(impedimentoParaPedido(o, true, 0), null);
  assert.equal(impedimentoParaPedido(o, false, 5000), null);
  assert.match(impedimentoParaPedido({ ...o, clienteId: null }, true, 0) ?? '', /cliente/);
  assert.match(impedimentoParaPedido({ ...o, itens: [] }, true, 0) ?? '', /item/);
  assert.match(impedimentoParaPedido({ ...o, status: 'aprovado' }, true, 0) ?? '', /encerrado/);
});

test('tipo do pedido e total', () => {
  assert.equal(tipoDoPedido([item()]), 'catalogo');
  assert.equal(tipoDoPedido([item(), item({ personalizado: true })]), 'personalizado');
  assert.equal(totalDoOrcamento({ itens: [item()] }), 10000);
  assert.equal(evento('x', '2026-01-01T00:00:00Z').texto, 'x');
});

test('item personalizado também reserva o material das escolhas', () => {
  const it = item({ personalizado: true, quantidade: 3, escolhas: [{ grupoId: 'g', grupoNome: 'Cor do wire-o', opcaoId: 'o', opcaoNome: 'Rosa', materialId: 'wire-rosa', quantidade: 1, acrescimoCentavos: 0 }] });
  assert.deepEqual(necessidades([it], {}, { 'wire-rosa': 5 }).map((n) => [n.materialId, n.reservar]), [['wire-rosa', 3]]);
});

test('ficha resume em uma linha', () => {
  assert.equal(resumoFicha({ tipo: 'Planner diário', tamanho: 'A5', cor: 'Azul', encadernacao: 'Wire-o', folhas: '90' }), 'Planner diário · A5 · Azul · Wire-o · 90 folhas');
  assert.equal(resumoFicha(undefined), '');
});
