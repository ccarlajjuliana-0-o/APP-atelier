import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AJUSTES_PADRAO, completarAjustes, custoHoraMaquinaCentavos, custoMaquinaCentavos, precificar, fluxoDoMes,
  totalFixasCentavos, equilibrio, type Despesa, type Ajustes,
} from './financeiro.ts';

const maq = { id: 'm1', nome: 'Impressora', valorCentavos: 300000, vidaUtilHoras: 3000, potenciaW: 150 };

test('custo por hora da máquina: desgaste mais energia', () => {
  // 3000 reais / 3000 h = 100 centavos/h; 0,15 kW × 90 centavos/kWh = 13,5
  assert.equal(custoHoraMaquinaCentavos(maq, 90), 113.5);
  assert.equal(custoMaquinaCentavos(120, maq, 90), 227);
  assert.equal(custoMaquinaCentavos(60, null, 90), 0);
  assert.equal(custoMaquinaCentavos(0, maq, 90), 0);
});

test('ajustes começam em branco onde depende de você', () => {
  const a = completarAjustes(undefined);
  assert.equal(a.multiplicadorEncadernacao, null);
  assert.equal(a.maquinas.length, 0);
  assert.equal(completarAjustes({ taxaMediaPct: 10 }).taxaMediaPct, 10);
});

test('sem multiplicador não há preço sugerido, mas o custo aparece', () => {
  const r = precificar({ linha: 'encadernacao', materiaisCentavos: 684, tempoImpressaoMin: 0, tempoTrabalhoMin: 60, precoAtualCentavos: 7500 }, AJUSTES_PADRAO);
  assert.equal(r.custo, 718); // 684 + 5%
  assert.equal(r.multiplicador, null);
  assert.ok(r.sugeridoPorCanal.every((x) => x === null));
  assert.equal(r.lucroAtual, 6782);
  assert.equal(r.horaAtual, 6782);
});

test('preço sugerido por canal com taxa', () => {
  const a: Ajustes = { ...AJUSTES_PADRAO, multiplicadorEncadernacao: 4, canais: [{ id: 'd', nome: 'Direta', taxaPct: 0 }, { id: 's', nome: 'Shopee', taxaPct: 20 }] };
  const r = precificar({ linha: 'encadernacao', materiaisCentavos: 1000, tempoImpressaoMin: 0, tempoTrabalhoMin: 0, precoAtualCentavos: null }, a);
  assert.equal(r.custo, 1050);
  assert.deepEqual(r.sugeridoPorCanal, [4200, 5250]);
  assert.equal(r.lucroAtual, null);
});

test('peça 3D: máquina entra no custo e falhas contam sobre o custo', () => {
  const a: Ajustes = { ...AJUSTES_PADRAO, multiplicador3d: 3, maquinas: [maq], maquina3dId: 'm1', kwhCentavos: 90 };
  const r = precificar({ linha: 'impressao3d', materiaisCentavos: 500, tempoImpressaoMin: 120, tempoTrabalhoMin: 0, precoAtualCentavos: null }, a);
  assert.equal(r.maquina, 227);
  assert.equal(r.custo, Math.round((500 + 227) * 1.3)); // 945
  assert.equal(r.sugeridoPorCanal[0], 945 * 3);
});

const desp = (o: Partial<Despesa>): Despesa => ({ id: 'x', tipo: 'avulsa', descricao: 'x', valorCentavos: 1000, data: '2026-11-05', ativo: true, atualizadoEm: '', ...o });

test('caixa do mês', () => {
  const f = fluxoDoMes(
    '2026-11',
    [{ data: '2026-11-12', valorCentavos: 15000, descricao: 'Pedido #1' }, { data: '2026-10-30', valorCentavos: 999, descricao: 'outro mês' }],
    [{ data: '2026-11-11', valorCentavos: 3600, descricao: 'Offset' }],
    [desp({ descricao: 'Fita' }), desp({ tipo: 'fixa', descricao: 'Internet', valorCentavos: 10000, data: '' }), desp({ descricao: 'arquivada', ativo: false }), desp({ descricao: 'Outubro', data: '2026-10-01' })],
  );
  assert.equal(f.entradas, 15000);
  assert.equal(f.saidas, 3600 + 1000 + 10000);
  assert.equal(f.resultado, 15000 - 14600);
  assert.equal(f.linhas[f.linhas.length - 1].origem, 'fixa');
  assert.equal(totalFixasCentavos([desp({ tipo: 'fixa', valorCentavos: 10000 }), desp({ tipo: 'fixa', valorCentavos: 5000, ativo: false })]), 10000);
});

test('ponto de equilíbrio', () => {
  const e = equilibrio(30000, 7500, 684, 10);
  assert.equal(e.contribuicaoPorPedido, 6066); // 7500 × 0,9 − 684
  assert.equal(e.pedidosNecessarios, 5);
  assert.equal(equilibrio(30000, 500, 684, 0).pedidosNecessarios, null);
  assert.equal(equilibrio(0, 7500, 684, 0).pedidosNecessarios, 0);
});
