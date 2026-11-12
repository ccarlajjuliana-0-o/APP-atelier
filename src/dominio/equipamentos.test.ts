import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarEquipamento, custoDeUso, rotuloDaUnidade, somarDias, diasEntre, proximaDaTarefa, situacaoDaTarefa, pendencias, textoDoPrazo, maquinaDoEquipamento,
  comMaquinasDosEquipamentos, TAREFAS_SUGERIDAS, TIPOS_EQUIPAMENTO, type Equipamento,
} from './equipamentos.ts';
import { AJUSTES_PADRAO, precificar } from './financeiro.ts';

const eq = (o: Partial<Equipamento>): Equipamento => ({
  id: 'e1', nome: 'Impressora', tipo: 'impressora3d', modelo: '', dataCompra: '2026-01-10', valorCentavos: 300000, alimentacao: 'eletrico',
  vidaUtil: 3000, vidaUtilUnidade: 'horas', vidaUtilRotulo: '', potenciaW: 150, usarNoCusto: true, tarefas: [], historico: [], observacoes: '', ativo: true, atualizadoEm: '', ...o,
});

test('datas: soma e diferença em dias', () => {
  assert.equal(somarDias('2026-11-12', 30), '2026-12-12');
  assert.equal(somarDias('2026-12-20', 20), '2027-01-09');
  assert.equal(diasEntre('2026-11-12', '2026-11-20'), 8);
  assert.equal(diasEntre('2026-11-12', '2026-11-10'), -2);
});

test('próxima manutenção: última vez, senão compra, senão hoje', () => {
  const t = { id: 't', descricao: 'x', intervaloDias: 30, ultimaEm: '2026-10-20' };
  assert.equal(proximaDaTarefa(t, '2026-01-10', '2026-11-12'), '2026-11-19');
  assert.equal(proximaDaTarefa({ ...t, ultimaEm: null }, '2026-01-10', '2026-11-12'), '2026-02-09');
  assert.equal(proximaDaTarefa({ ...t, ultimaEm: null }, null, '2026-11-12'), '2026-12-12');
});

test('situação da tarefa', () => {
  assert.equal(situacaoDaTarefa('2026-11-11', '2026-11-12'), 'vencida');
  assert.equal(situacaoDaTarefa('2026-11-12', '2026-11-12'), 'em_breve');
  assert.equal(situacaoDaTarefa('2026-11-19', '2026-11-12'), 'em_breve');
  assert.equal(situacaoDaTarefa('2026-11-20', '2026-11-12'), 'em_dia');
});

test('pendências ordenadas, sem equipamentos arquivados', () => {
  const e = eq({
    tarefas: [
      { id: 'a', descricao: 'Limpar', intervaloDias: 30, ultimaEm: '2026-10-01' }, // venceu 31/10
      { id: 'b', descricao: 'Lubrificar', intervaloDias: 90, ultimaEm: '2026-11-10' }, // longe
      { id: 'c', descricao: 'Nivelar', intervaloDias: 30, ultimaEm: '2026-10-18' }, // 17/11: em breve
    ],
  });
  const p = pendencias([e, eq({ id: 'e2', ativo: false, tarefas: [{ id: 'z', descricao: 'z', intervaloDias: 1, ultimaEm: null }] })], '2026-11-12');
  assert.deepEqual(p.map((x) => [x.tarefaId, x.situacao, x.dias]), [['a', 'vencida', -12], ['c', 'em_breve', 5]]);
  assert.equal(textoDoPrazo(-12), 'atrasada há 12 dia(s)');
  assert.equal(textoDoPrazo(0), 'vence hoje');
  assert.equal(textoDoPrazo(5), 'vence em 5 dias');
});

test('equipamento vira máquina do Financeiro só se marcado e com vida útil', () => {
  assert.equal(maquinaDoEquipamento(eq({}))?.id, 'e1');
  assert.equal(maquinaDoEquipamento(eq({ usarNoCusto: false })), null);
  assert.equal(maquinaDoEquipamento(eq({ vidaUtil: 0 })), null);
  assert.equal(maquinaDoEquipamento(eq({ vidaUtilUnidade: 'ciclos' })), null);
  assert.equal(maquinaDoEquipamento(eq({ alimentacao: 'manual' }))?.potenciaW, 0);
  assert.equal(maquinaDoEquipamento(eq({ ativo: false })), null);
});

test('o custo por hora do equipamento entra no preço das peças 3D', () => {
  const a = comMaquinasDosEquipamentos({ ...AJUSTES_PADRAO, multiplicador3d: 3, kwhCentavos: 90, maquina3dId: 'e1' }, [eq({})]);
  assert.equal(a.maquinas.length, 1);
  const r = precificar({ linha: 'impressao3d', materiaisCentavos: 500, tempoImpressaoMin: 120, tempoTrabalhoMin: 0, precoAtualCentavos: null }, a);
  assert.equal(r.maquina, 227);
  // não duplica se a máquina já está nos ajustes
  assert.equal(comMaquinasDosEquipamentos(a, [eq({})]).maquinas.length, 1);
});

test('sugestões existem para todos os tipos', () => {
  for (const t of Object.keys(TIPOS_EQUIPAMENTO) as (keyof typeof TIPOS_EQUIPAMENTO)[]) assert.ok(TAREFAS_SUGERIDAS[t].length > 0);
});

test('registros antigos ganham os campos novos', () => {
  const antigo = { ...eq({}), vidaUtilHoras: 2000, potenciaW: 100 } as unknown as Equipamento;
  delete (antigo as Partial<Equipamento>).vidaUtil;
  delete (antigo as Partial<Equipamento>).alimentacao;
  delete (antigo as Partial<Equipamento>).vidaUtilUnidade;
  const n = normalizarEquipamento(antigo);
  assert.equal(n.vidaUtil, 2000);
  assert.equal(n.vidaUtilUnidade, 'horas');
  assert.equal(n.alimentacao, 'eletrico');
  const manual = normalizarEquipamento({ ...antigo, potenciaW: 0 } as Equipamento);
  assert.equal(manual.alimentacao, 'manual');
});

test('custo de uso: horas com energia, ciclos e outra unidade só desgaste', () => {
  const horas = custoDeUso(eq({}), 90);
  assert.equal(horas?.por, 'hora');
  assert.equal(horas?.centavos, 113.5); // 300000/3000 + 0,15 kW × 90
  const manualHoras = custoDeUso(eq({ alimentacao: 'manual' }), 90);
  assert.equal(manualHoras?.centavos, 100);
  const ciclos = custoDeUso(eq({ alimentacao: 'manual', valorCentavos: 50000, vidaUtil: 10000, vidaUtilUnidade: 'ciclos' }), 90);
  assert.equal(ciclos?.por, 'ciclo');
  assert.equal(ciclos?.centavos, 5);
  const outra = custoDeUso(eq({ alimentacao: 'manual', valorCentavos: 50000, vidaUtil: 5000, vidaUtilUnidade: 'outro', vidaUtilRotulo: 'furo' }), 90);
  assert.equal(outra?.por, 'furo');
  assert.equal(outra?.centavos, 10);
  // energia só conta em horas
  assert.equal(custoDeUso(eq({ vidaUtilUnidade: 'ciclos', vidaUtil: 3000 }), 90)?.centavos, 100);
  assert.equal(custoDeUso(eq({ vidaUtil: 0 }), 90), null);
  assert.equal(custoDeUso(eq({ valorCentavos: 0 }), 90), null);
  assert.equal(rotuloDaUnidade({ vidaUtilUnidade: 'outro', vidaUtilRotulo: '' }), 'uso');
});
