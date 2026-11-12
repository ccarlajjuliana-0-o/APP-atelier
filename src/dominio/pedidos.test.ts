import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totalCentavos, entradaCentavos, situacaoPagamento, necessidades, atrasado, prazoPadraoDias, dataPrometida,
  podeCancelar, AVANCO, dataParaTexto, type ItemPedido,
} from './pedidos.ts';
import { ritmoPorDia, diasRestantes, diasComBaixa, MIN_DIAS_COM_BAIXA } from './consumo.ts';
import type { ItemProduto } from './produtos.ts';

const item = (o: Partial<ItemPedido>): ItemPedido => ({
  produtoId: 'planner', descricao: 'Planner A5', quantidade: 1, precoUnitCentavos: 7500,
  modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: '', ...o,
});

test('total e entrada de 50%', () => {
  const itens = [item({ quantidade: 2 }), item({ produtoId: null, quantidade: 1, precoUnitCentavos: 1999 })];
  assert.equal(totalCentavos(itens), 16999);
  assert.equal(entradaCentavos(16999), 8500);
});

test('situação do pagamento', () => {
  assert.equal(situacaoPagamento(10000, []), 'sem_pagamento');
  assert.equal(situacaoPagamento(10000, [{ data: '2026-11-01', valorCentavos: 2000, observacao: '' }]), 'parcial');
  assert.equal(situacaoPagamento(10000, [{ data: '2026-11-01', valorCentavos: 5000, observacao: '' }]), 'entrada_paga');
  assert.equal(
    situacaoPagamento(10000, [{ data: '2026-11-01', valorCentavos: 5000, observacao: '' }, { data: '2026-11-20', valorCentavos: 5000, observacao: '' }]),
    'quitado',
  );
});

test('prazo em dias úteis a partir da confirmação', () => {
  assert.equal(prazoPadraoDias('personalizado'), 20);
  assert.equal(prazoPadraoDias('catalogo'), 7);
  // quarta 11/11/2026 + 5 dias úteis = quarta 18/11
  assert.equal(dataPrometida('2026-11-11', 5), '2026-11-18');
  assert.equal(dataParaTexto('2026-11-18'), '18/11/2026');
});

test('atraso só vale para pedidos em andamento', () => {
  assert.equal(atrasado('em_producao', '2026-11-10', '2026-11-11'), true);
  assert.equal(atrasado('em_producao', '2026-11-11', '2026-11-11'), false);
  assert.equal(atrasado('entregue', '2026-11-01', '2026-11-11'), false);
  assert.equal(atrasado('orcamento', null, '2026-11-11'), false);
});

test('etapas e cancelamento', () => {
  assert.equal(AVANCO.orcamento?.para, 'confirmado');
  assert.equal(AVANCO.pronto?.para, 'entregue');
  assert.equal(AVANCO.entregue, undefined);
  assert.equal(podeCancelar('em_producao'), true);
  assert.equal(podeCancelar('pronto'), false);
});

const receita: ItemProduto[] = [
  { materialId: 'offset', quantidade: 100, desperdicioPct: 5, extra: false }, // 105 por unidade
  { materialId: 'wireo', quantidade: 1, desperdicioPct: 0, extra: false },
  { materialId: 'elastico', quantidade: 1, desperdicioPct: 0, extra: true },
];

test('necessidade de material: arredonda para cima e soma itens', () => {
  const n = necessidades([item({ quantidade: 2 })], { planner: receita }, { offset: 1000, wireo: 10, elastico: 5 });
  const por = Object.fromEntries(n.map((x) => [x.materialId, x]));
  assert.equal(por.offset.necessario, 210);
  assert.equal(por.offset.reservar, 210);
  assert.equal(por.offset.falta, 0);
  assert.equal(por.wireo.necessario, 2);
  assert.equal(por.elastico.extra, true);
});

test('falta: essencial reserva tudo, extra só até o estoque', () => {
  const n = necessidades([item({ quantidade: 3 })], { planner: receita }, { offset: 100, wireo: 0, elastico: 1 });
  const por = Object.fromEntries(n.map((x) => [x.materialId, x]));
  assert.equal(por.offset.reservar, 315);
  assert.equal(por.offset.falta, 215);
  assert.equal(por.wireo.reservar, 3);
  assert.equal(por.wireo.falta, 3);
  assert.equal(por.elastico.reservar, 1);
  assert.equal(por.elastico.falta, 2);
});

test('item avulso e produto sem receita não pedem material', () => {
  assert.deepEqual(necessidades([item({ produtoId: null }), item({ produtoId: 'sem' })], { sem: [] }, {}), []);
});

test('ritmo de consumo e dias restantes', () => {
  const agora = new Date('2026-11-11T12:00:00Z');
  const baixas = [
    { quantidade: 300, criadoEm: '2026-10-01T12:00:00Z' }, // 41 dias atrás
    { quantidade: 120, criadoEm: '2026-11-01T12:00:00Z' },
  ];
  const r = ritmoPorDia(baixas, agora);
  assert.ok(Math.abs(r - 420 / 41) < 0.01);
  assert.equal(diasRestantes(205, r), 20);
  assert.equal(diasRestantes(100, 0), null);
  assert.equal(ritmoPorDia([], agora), 0);
  // pouco histórico: base mínima de 14 dias
  assert.equal(ritmoPorDia([{ quantidade: 140, criadoEm: '2026-11-11T08:00:00Z' }], agora), 10);
  // fora da janela não conta
  assert.equal(ritmoPorDia([{ quantidade: 500, criadoEm: '2026-01-01T12:00:00Z' }], agora), 0);
});

test('previsão de duração só com histórico suficiente', () => {
  const b = (d: string) => ({ quantidade: 10, criadoEm: `${d}T12:00:00Z` });
  assert.equal(MIN_DIAS_COM_BAIXA, 3);
  assert.equal(diasComBaixa([b('2026-11-01'), b('2026-11-01')]), 1);
  assert.equal(diasComBaixa([b('2026-11-01'), b('2026-11-05'), b('2026-11-09')]), 3);
});
