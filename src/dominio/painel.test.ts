import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapasDoPedido, textoDoPrazoPedido, resumirPedidos, resumirDivulgacao, textoUltimaPublicacao, materiaisBaixos, type PedidoPainel } from './painel.ts';

const ped = (o: Partial<PedidoPainel>): PedidoPainel => ({ numero: 1, cliente: 'Ana', status: 'confirmado', totalCentavos: 10000, pagoCentavos: 5000, dataPrometida: '2026-11-20', ...o });

test('trilha do pedido', () => {
  assert.deepEqual(etapasDoPedido('em_producao').map((e) => [e.feita, e.atual]), [[true, false], [true, true], [false, false], [false, false]]);
  assert.ok(etapasDoPedido('orcamento').every((e) => !e.feita && !e.atual));
  assert.ok(etapasDoPedido('entregue').every((e) => e.feita));
});

test('texto do prazo', () => {
  assert.equal(textoDoPrazoPedido(-2), 'atrasado há 2 dia(s)');
  assert.equal(textoDoPrazoPedido(0), 'é hoje');
  assert.equal(textoDoPrazoPedido(1), 'amanhã');
  assert.equal(textoDoPrazoPedido(5), 'em 5 dias');
});

test('resumo de pedidos: andamento, atraso, a receber e entregas', () => {
  const hoje = '2026-11-12';
  const r = resumirPedidos([
    ped({ numero: 1, status: 'orcamento', pagoCentavos: 0, dataPrometida: null }),
    ped({ numero: 2, status: 'em_producao', dataPrometida: '2026-11-10' }), // atrasado, falta 50
    ped({ numero: 3, status: 'confirmado', dataPrometida: '2026-11-30' }),
    ped({ numero: 4, status: 'pronto', pagoCentavos: 10000, dataPrometida: '2026-11-25' }), // pago, pronto
    ped({ numero: 5, status: 'entregue', pagoCentavos: 6000 }), // entregue, falta 40
    ped({ numero: 6, status: 'cancelado', pagoCentavos: 0 }),
    ped({ numero: 7, status: 'confirmado', dataPrometida: '2026-11-14', pagoCentavos: 10000 }), // perto do prazo
  ], hoje);
  assert.equal(r.orcamentos, 1);
  assert.deepEqual(r.emAndamento.map((p) => p.numero), [2, 7, 3]);
  assert.equal(r.atrasados, 1);
  assert.equal(r.aReceber.totalCentavos, 5000 + 5000 + 4000);
  assert.deepEqual(r.aReceber.pedidos.map((p) => p.numero).sort(), [2, 3, 5]);
  assert.deepEqual(r.paraEntregar.map((p) => p.numero), [4, 2, 7]);
  assert.equal(r.emAndamento[0].dias, -2);
});

test('resumo vazio', () => {
  const r = resumirPedidos([], '2026-11-12');
  assert.equal(r.aReceber.totalCentavos, 0);
  assert.equal(r.emAndamento.length + r.paraEntregar.length + r.atrasados + r.orcamentos, 0);
});

test('divulgação: última, próxima, atrasadas e aviso', () => {
  const hoje = '2026-11-12';
  const r = resumirDivulgacao([
    { data: '2026-11-01', titulo: 'a', status: 'publicado' },
    { data: '2026-11-08', titulo: 'b', status: 'publicado' },
    { data: '2026-11-05', titulo: 'c', status: 'criando' }, // ficou para trás
    { data: '2026-11-15', titulo: 'd', status: 'pronto' },
    { data: '2026-11-13', titulo: 'e', status: 'descartado' },
  ], hoje);
  assert.deepEqual(r.ultima, { data: '2026-11-08', titulo: 'b', diasAtras: 4 });
  assert.deepEqual(r.proxima, { data: '2026-11-15', titulo: 'd', dias: 3 });
  assert.equal(r.atrasadas, 1);
  assert.equal(r.aviso, false);
  assert.equal(resumirDivulgacao([{ data: '2026-11-01', titulo: 'a', status: 'publicado' }], hoje).aviso, true);
  assert.equal(resumirDivulgacao([], hoje).aviso, true);
  assert.equal(resumirDivulgacao([], hoje).ultima, null);
  assert.equal(textoUltimaPublicacao(0), 'hoje');
  assert.equal(textoUltimaPublicacao(1), 'ontem');
  assert.equal(textoUltimaPublicacao(9), 'há 9 dias');
});

test('estoque baixo: do mais crítico ao menos', () => {
  const r = materiaisBaixos([
    { nome: 'B', unidade: 'folha', disponivel: 50, minimo: 100, ativo: true },
    { nome: 'A', unidade: 'g', disponivel: 0, minimo: 500, ativo: true },
    { nome: 'C', unidade: 'un', disponivel: 5, minimo: 5, ativo: true }, // no mínimo: ok
    { nome: 'D', unidade: 'un', disponivel: 0, minimo: 10, ativo: false }, // arquivado
    { nome: 'E', unidade: 'un', disponivel: 0, minimo: 0, ativo: true }, // sem mínimo
    { nome: 'F', unidade: 'un', disponivel: -3, minimo: 10, ativo: true },
  ]);
  assert.deepEqual(r.map((m) => m.nome), ['F', 'A', 'B']);
});
