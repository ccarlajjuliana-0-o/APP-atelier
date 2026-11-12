import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarContexto, limitarMensagens, primeiroNome, type SnapshotAssistente } from './assistente.ts';

const base: SnapshotAssistente = {
  hoje: '2026-11-12',
  materiais: [
    { nome: 'Papel sulfite A4', unidade: 'folha', fisico: 120, disponivel: 100, minimo: 200, custoMicro: 30_000 },
    { nome: 'Fita de cetim', unidade: 'm', fisico: 5, disponivel: 5, minimo: 0, custoMicro: 0 },
  ],
  produtos: [{ nome: 'planner A5', linha: 'Encadernação', precoCentavos: 4500, custoCentavos: 1436, materiaisSemCusto: 1, sugerido: [{ canal: 'Venda direta', centavos: null }], margemPct: 68, horaCentavos: 3000, tempoTrabalhoMin: 60 }],
  pedidos: [{ numero: 2, cliente: 'Lawrence', status: 'em produção', totalCentavos: 10000, pagoCentavos: 5000, dataPrometida: '2026-11-20', atrasado: true, itens: '2× planner A5' }],
  caixaMes: { mes: '2026-11', entrou: 22500, saiu: 12500, fixas: 17990 },
  ajustes: { multiplicadorEncadernacao: null, multiplicador3d: 3, kwhCentavos: 0 },
  atencao: ['Encadernadora: lubrificar (vencida)'],
  publicacoes: [],
};

test('contexto traz valores em reais e sinaliza o que precisa de atenção', () => {
  const t = montarContexto(base);
  assert.ok(t.includes('Papel sulfite A4 | 120 folha | 100 | 200'));
  assert.ok(t.includes('ABAIXO DO MÍNIMO'));
  assert.ok(t.includes('sem custo'));
  assert.ok(t.includes('R$ 45,00'));
  assert.ok(t.includes('faltam custos de 1 material'));
  assert.ok(t.includes('falta R$ 50,00'));
  assert.ok(t.includes('ATRASADO'));
  assert.ok(t.includes('multiplicador encadernação: não definido'));
  assert.ok(t.includes('entrou R$ 225,00; saiu R$ 125,00'));
  assert.ok(t.includes('nenhuma planejada'));
});

test('contexto vazio não quebra', () => {
  const t = montarContexto({ ...base, materiais: [], produtos: [], pedidos: [], atencao: [] });
  assert.ok(t.includes('nenhum material cadastrado') && t.includes('nenhum pedido em aberto') && t.includes('nada pedindo atenção'));
});

test('só o primeiro nome do cliente sai do aparelho', () => {
  assert.equal(primeiroNome('  Maria da Silva Souza '), 'Maria');
  assert.equal(primeiroNome(''), 'cliente');
});

test('conversa: mantém o fim, corta textos longos e começa pelo usuário', () => {
  const msgs = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content: `m${i}` }));
  const r = limitarMensagens(msgs);
  assert.ok(r.length <= 12 && r[0].role === 'user' && r[r.length - 1].content === 'm19');
  assert.equal(limitarMensagens([{ role: 'user', content: 'x'.repeat(9000) }])[0].content.length, 4000);
  assert.deepEqual(limitarMensagens([{ role: 'assistant', content: 'oi' }, { role: 'user', content: '  ' }]), []);
});

test('contexto informa a tela aberta, quando há', () => {
  assert.ok(montarContexto({ ...base, tela: 'Pedidos' }).includes('Tela aberta no app agora: Pedidos'));
  assert.ok(!montarContexto(base).includes('Tela aberta'));
});
