import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  semanasDoMes, mesSeguinte, nomeDoMes, datasComemorativas, proximasDatas, limparHashtags, gerarLegenda, conferirComAMarca,
  resumirResultados, engajamento, enderecoSeguro, textoParaCopiar, METRICAS_ZERADAS, TIPOS_LEGENDA, type Publicacao, type TipoLegenda,
} from './divulgacao.ts';

test('calendário de novembro de 2026 (começa em um domingo)', () => {
  const semanas = semanasDoMes('2026-11');
  assert.equal(semanas.length, 5);
  assert.equal(semanas[0][0].data, '2026-11-01');
  assert.equal(semanas[0][0].doMes, true);
  assert.equal(semanas[4][6].data, '2026-12-05');
  assert.equal(semanas[4][6].doMes, false);
  assert.ok(semanas.every((s) => s.length === 7));
});

test('calendário completa as pontas com dias do mês vizinho', () => {
  const semanas = semanasDoMes('2026-12'); // 1º de dezembro de 2026 é terça
  assert.equal(semanas[0][0].data, '2026-11-29');
  assert.equal(semanas[0][0].doMes, false);
  assert.equal(semanas[0][2].data, '2026-12-01');
});

test('navegação e nome do mês', () => {
  assert.equal(mesSeguinte('2026-12', 1), '2027-01');
  assert.equal(mesSeguinte('2026-01', -1), '2025-12');
  assert.equal(nomeDoMes('2026-11'), 'novembro de 2026');
});

test('datas comemorativas de 2026', () => {
  const d = Object.fromEntries(datasComemorativas(2026).map((x) => [x.nome, x.data]));
  assert.equal(d['Dia das Mães'], '2026-05-10');
  assert.equal(d['Dia dos Pais'], '2026-08-09');
  assert.equal(d['Black Friday'], '2026-11-27');
  assert.equal(d['Dia dos Namorados'], '2026-06-12');
  assert.equal(d['Natal'], '2026-12-25');
});

test('próximas datas olham o ano seguinte', () => {
  const p = proximasDatas('2026-12-20', 90);
  assert.deepEqual(p.map((x) => x.nome), ['Natal', 'Volta às aulas (início de fevereiro)', 'Dia Internacional da Mulher']);
});

test('hashtags: normaliza, tira repetidas e símbolos', () => {
  assert.deepEqual(limparHashtags('#Planner, planner  #Papelaria-Personalizada! ##café'), ['#planner', '#papelariapersonalizada', '#café']);
  assert.deepEqual(limparHashtags(''), []);
});

test('toda legenda sugerida passa na conferência da marca (exceto o que precisa ser completado)', () => {
  for (const tipo of Object.keys(TIPOS_LEGENDA) as TipoLegenda[]) {
    for (let v = 0; v < 3; v++) {
      for (const linha of ['encadernacao', 'impressao3d'] as const) {
        const r = gerarLegenda({ tipo, produto: 'planner A5', linha, tema: 'Dia das Mães', variacao: v });
        const avisos = conferirComAMarca(r.legenda, r.hashtags).filter((a) => !a.includes('colchetes'));
        assert.deepEqual(avisos, [], `${tipo} v${v} ${linha}: ${avisos.join(' | ')}`);
        assert.ok(r.hashtags.length <= 5 && r.hashtags.includes('#craftnotesunique'));
      }
    }
  }
});

test('legenda usa o nome do produto e o da data', () => {
  assert.ok(gerarLegenda({ tipo: 'lancamento', produto: 'planner A5', linha: 'encadernacao', tema: '', variacao: 0 }).legenda.toLowerCase().includes('planner a5'));
  assert.ok(gerarLegenda({ tipo: 'data', produto: '', linha: null, tema: 'Dia dos Pais', variacao: 1 }).legenda.startsWith('Dia dos Pais'));
  assert.ok(gerarLegenda({ tipo: 'processo', produto: 'marcador', linha: 'impressao3d', tema: '', variacao: 0 }).legenda.includes('camada por camada'));
});

test('conferência aponta o que foge da marca', () => {
  assert.equal(conferirComAMarca('Um caderno feito com carinho 🌸', ['#craftnotesunique']).length, 0);
  assert.ok(conferirComAMarca('🌸📖✨💜 lindo', []).some((a) => a.includes('emojis')));
  assert.ok(conferirComAMarca('COMPRE AGORA', []).some((a) => a.includes('caixa-alta')));
  assert.ok(conferirComAMarca('Últimas unidades!!!', []).length >= 2);
  assert.ok(conferirComAMarca('Prezado cliente', []).some((a) => a.includes('corporativos')));
  assert.ok(conferirComAMarca('oi', ['#a', '#b', '#c', '#d', '#e', '#f']).some((a) => a.includes('hashtags')));
  assert.ok(conferirComAMarca('Veja [completar]', []).some((a) => a.includes('colchetes')));
});

const post = (o: Partial<Publicacao>): Publicacao => ({
  id: 'x', titulo: 't', canal: 'instagram_feed', data: '2026-11-12', hora: '', status: 'publicado', tipo: '', produtoId: null, legenda: '', hashtags: [],
  link: '', observacoes: '', metricas: { ...METRICAS_ZERADAS }, atualizadoEm: '', ...o,
});

test('resultados: soma só publicados e acha o melhor', () => {
  const a = post({ id: 'a', metricas: { ...METRICAS_ZERADAS, alcance: 500, curtidas: 40, comentarios: 3, salvamentos: 10, compartilhamentos: 2, mensagens: 4 } });
  const b = post({ id: 'b', metricas: { ...METRICAS_ZERADAS, alcance: 300, curtidas: 90, mensagens: 1 } });
  const c = post({ id: 'c', status: 'ideia', metricas: { ...METRICAS_ZERADAS, alcance: 9999, curtidas: 9999 } });
  assert.equal(engajamento(a.metricas), 55);
  const r = resumirResultados([a, b, c]);
  assert.equal(r.publicados, 2);
  assert.equal(r.alcance, 800);
  assert.equal(r.engajamento, 145);
  assert.equal(r.mensagens, 5);
  assert.equal(r.melhor?.id, 'b');
  assert.equal(resumirResultados([post({})]).melhor, null);
});

test('endereço seguro e texto para copiar', () => {
  assert.equal(enderecoSeguro('instagram.com/p/abc'), 'https://instagram.com/p/abc');
  assert.equal(enderecoSeguro('javascript:alert(1)'), null);
  assert.equal(enderecoSeguro(''), null);
  assert.equal(textoParaCopiar({ legenda: 'Oi ', hashtags: ['#a', '#b'] }), 'Oi\n\n#a #b');
  assert.equal(textoParaCopiar({ legenda: '', hashtags: ['#a'] }), '#a');
});

test('legenda sugerida começa com letra maiúscula', () => {
  assert.ok(gerarLegenda({ tipo: 'lancamento', produto: 'planner A5', linha: 'encadernacao', tema: '', variacao: 0 }).legenda.startsWith('Planner A5 chegou'));
  assert.ok(gerarLegenda({ tipo: 'lancamento', produto: 'caderno', linha: null, tema: '', variacao: 1 }).legenda.startsWith('Novidade'));
});
