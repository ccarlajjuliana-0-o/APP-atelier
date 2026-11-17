import test from 'node:test';
import assert from 'node:assert/strict';
import { dentroDoPrazo, diasDesdeEntrega, impedimentoDevolucao, pecasPendentes, pecaNova, textoPrazo, trocaPermitida, valorDasPecas } from './devolucoes.ts';

test('prazo de 7 dias corridos após a entrega', () => {
  assert.equal(diasDesdeEntrega('2026-11-10', '2026-11-17'), 7);
  assert.equal(dentroDoPrazo('2026-11-10', '2026-11-17'), true);
  assert.equal(dentroDoPrazo('2026-11-10', '2026-11-18'), false);
  assert.equal(dentroDoPrazo('2026-11-10', '2026-11-09'), false);
  assert.equal(diasDesdeEntrega('2026-02-27', '2026-03-02'), 3); // vira o mês
  assert.match(textoPrazo('2026-11-10', '2026-11-12'), /Dentro do prazo: 2 dias/);
  assert.match(textoPrazo('2026-11-10', '2026-11-20'), /Fora do prazo: 10 dias/);
});

test('troca só para defeito ou avaria', () => {
  assert.equal(trocaPermitida('defeito_fabricacao'), true);
  assert.equal(trocaPermitida('avaria_transporte'), true);
  assert.equal(trocaPermitida('mau_uso'), false);
  assert.equal(trocaPermitida('arrependimento'), false);
});

test('validação do registro de devolução', () => {
  const ok = { motivoTipo: 'arrependimento' as const, motivo: '', solucao: 'reembolso' as const, pecas: 1, reembolsoCentavos: 5000, pagoCentavos: 5000, dentroDoPrazo: true, aceitaForaDoPrazo: false };
  assert.equal(impedimentoDevolucao(ok), '');
  assert.match(impedimentoDevolucao({ ...ok, pecas: 0 }), /ao menos um item/);
  assert.match(impedimentoDevolucao({ ...ok, dentroDoPrazo: false }), /fora do prazo/);
  assert.equal(impedimentoDevolucao({ ...ok, dentroDoPrazo: false, aceitaForaDoPrazo: true }), '');
  assert.match(impedimentoDevolucao({ ...ok, solucao: 'novo_pedido' }), /só para defeito/);
  assert.equal(impedimentoDevolucao({ ...ok, motivoTipo: 'defeito_fabricacao', solucao: 'novo_pedido' }), '');
  assert.match(impedimentoDevolucao({ ...ok, reembolsoCentavos: 6000 }), /maior do que/);
  assert.match(impedimentoDevolucao({ ...ok, motivoTipo: 'outro' }), /motivo/);
});

test('valor das peças e pendências', () => {
  const a = pecaNova(0, 'Planner', 1, 7750);
  const b = { ...pecaNova(1, 'Árvore', 1, 3500), situacao: 'no_estoque' as const };
  assert.equal(valorDasPecas([a, b]), 11250);
  assert.equal(pecasPendentes([{ pecas: [a, b] } as never]), 1);
  assert.equal(pecasPendentes(undefined), 0);
});
