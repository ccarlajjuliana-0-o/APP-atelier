import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centavosParaTexto } from './dinheiro.ts';
import {
  saldoFisico, saldoReservado, saldoDisponivel, custoMedioPonderado, converterCompra, abaixoDoMinimo,
  type Movimentacao,
} from './estoque.ts';
import { custoMaterialCentavos, quantosDaParaProduzir, type ItemReceita } from './receita.ts';
import { custoDoProdutoCentavos, precoSugeridoCentavos, lucroCentavos, horaImplicitaCentavos } from './preco.ts';
import { adicionarDiasUteis } from './prazo.ts';
import { pedidosParaEquilibrio, resultadoDoPeriodo } from './equilibrio.ts';

test('formata reais', () => {
  assert.equal(centavosParaTexto(26980), 'R$ 269,80');
  assert.equal(centavosParaTexto(144000), 'R$ 1.440,00');
  assert.equal(centavosParaTexto(-5), '-R$ 0,05');
});

test('saldo é a soma das movimentações; reserva só sai na baixa', () => {
  const movs: Movimentacao[] = [
    { materialId: 'offset', tipo: 'entrada', quantidade: 1700 },
    { materialId: 'offset', tipo: 'reserva', quantidade: 42 },
  ];
  assert.equal(saldoFisico(movs), 1700);
  assert.equal(saldoReservado(movs), 42);
  assert.equal(saldoDisponivel(movs), 1658);
  movs.push({ materialId: 'offset', tipo: 'baixa', quantidade: 42 });
  assert.equal(saldoFisico(movs), 1658);
  assert.equal(saldoReservado(movs), 0);
});

test('cancelar o pedido devolve o material reservado', () => {
  const movs: Movimentacao[] = [
    { materialId: 'x', tipo: 'entrada', quantidade: 10 },
    { materialId: 'x', tipo: 'reserva', quantidade: 4 },
    { materialId: 'x', tipo: 'liberacao', quantidade: 4 },
  ];
  assert.equal(saldoDisponivel(movs), 10);
});

test('custo médio ponderado do wire-o azul (6 un a R$ 2,20 + compra)', () => {
  // 6 un a 2,20 e +10 un a 2,69 => média ~2,49 (exemplo do protótipo)
  const novo = custoMedioPonderado(6, 2_200_000, 10, 2_690_000);
  assert.equal(novo, 2_506_250);
});

test('converte resma em folhas', () => {
  const r = converterCompra(1, 500, 3000); // 1 resma de 500 folhas por R$ 30,00
  assert.equal(r.quantidade, 500);
  assert.equal(r.custoUnitMicro, 60_000); // R$ 0,06 por folha
});

test('alerta de reposição', () => {
  assert.equal(abaixoDoMinimo(6, 10), true);
  assert.equal(abaixoDoMinimo(42, 20), false);
});

test('quantos dá para produzir: só essenciais limitam, extras avisam', () => {
  const itens: ItemReceita[] = [
    { materialId: 'offset', quantidade: 40, custoUnitMicro: 60_000, essencial: true },
    { materialId: 'wireo', quantidade: 1, custoUnitMicro: 2_000_000, essencial: true },
    { materialId: 'cantoneira', quantidade: 4, custoUnitMicro: 590_000, essencial: false },
  ];
  const r = quantosDaParaProduzir(itens, { offset: 1700, wireo: 30, cantoneira: 0 });
  assert.equal(r.quantidade, 30);
  assert.equal(r.limitante, 'wireo');
  assert.deepEqual(r.extrasEmFalta, ['cantoneira']);
});

test('custo de material da receita', () => {
  const itens: ItemReceita[] = [
    { materialId: 'a', quantidade: 40, custoUnitMicro: 60_000, essencial: true }, // 2,40
    { materialId: 'b', quantidade: 2, custoUnitMicro: 125_000, essencial: true }, // 0,25
  ];
  assert.equal(custoMaterialCentavos(itens), 265);
});

test('planner A5: custo R$ 7,89 e preço sugerido ×7 = R$ 55,23', () => {
  const custo = custoDoProdutoCentavos({ materiaisCentavos: 694, desperdicioPercentual: 5, baseDoPercentual: 'materiais', extrasCentavos: [60] });
  assert.equal(custo, 789);
  assert.equal(precoSugeridoCentavos(custo, 7), 5523);
  assert.equal(precoSugeridoCentavos(custo, 7, 0.14), 6422);
  const lucro = lucroCentavos(6200, custo);
  assert.equal(lucro, 5411);
  assert.equal(horaImplicitaCentavos(lucro, 1.5), 3607);
});

test('porta-lápis 3D: custo R$ 16,46 com 30% de falhas e ×1,75 = R$ 28,81', () => {
  const custo = custoDoProdutoCentavos({ materiaisCentavos: 926, desperdicioPercentual: 30, baseDoPercentual: 'custo', extrasCentavos: [40, 300] });
  assert.equal(custo, 1646);
  assert.equal(precoSugeridoCentavos(custo, 1.75), 2881);
});

test('prazo em dias úteis pula fim de semana', () => {
  assert.equal(adicionarDiasUteis('2026-10-30', 1), '2026-11-02'); // sexta -> segunda
  assert.equal(adicionarDiasUteis('2026-10-30', 5), '2026-11-06');
  assert.equal(adicionarDiasUteis('2026-10-30', 10), '2026-11-13');
});

test('ponto de equilíbrio de outubro: 7 pedidos e resultado R$ 350,20', () => {
  const contribuicaoMedia = 62000 / 14; // R$ 620,00 em 14 pedidos
  assert.equal(pedidosParaEquilibrio(26980, contribuicaoMedia), 7);
  assert.equal(resultadoDoPeriodo(62000, 26980), 35020);
});
