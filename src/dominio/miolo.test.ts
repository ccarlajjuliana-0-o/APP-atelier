import test from 'node:test';
import assert from 'node:assert/strict';
import { diaDaSemana, diasNoMes, inicioDaSemana, intervaloDaSemana, paginaParaSvg, paginasDoMiolo, somarDias, somarMeses, type ModeloMiolo } from './miolo.ts';

test('calendário sem fuso', () => {
  assert.equal(diaDaSemana('2026-11-16'), 1); // segunda
  assert.equal(diaDaSemana('2026-11-15'), 0);
  assert.equal(somarDias('2026-02-27', 3), '2026-03-02');
  assert.equal(diasNoMes(2028, 2), 29);
  assert.equal(diasNoMes(2026, 11), 30);
  assert.equal(somarMeses('2026-11-01', 2), '2027-01-01');
  assert.equal(inicioDaSemana('2026-11-19', true), '2026-11-16');
  assert.equal(inicioDaSemana('2026-11-19', false), '2026-11-15');
  assert.equal(intervaloDaSemana('2026-11-16'), '16 a 22 de novembro');
  assert.equal(intervaloDaSemana('2026-11-30'), '30 de novembro a 6 de dezembro');
});

test('todas as páginas têm o tamanho certo, número e conteúdo dentro do papel', () => {
  const modelos: ModeloMiolo[] = ['pautado', 'pontilhado', 'quadriculado', 'liso', 'semanal', 'mensal', 'diario1', 'diario2', 'habitos', 'checklist', 'reflexao'];
  for (const modelo of modelos) for (const tamanho of ['A4', 'A5', 'A6', 'Colegial'] as const) {
    const pgs = paginasDoMiolo({ modelo, tamanho, paginas: 4, datado: true, inicio: '2026-11-16' });
    assert.equal(pgs.length, 4, modelo);
    for (const pg of pgs) {
      assert.ok(pg.itens.length > 0 || modelo === 'liso', `${modelo} ${tamanho} vazio`);
      for (const e of pg.itens) {
        const xs = e.t === 'linha' ? [e.x1, e.x2] : e.t === 'ret' ? [e.x, e.x + e.w] : [e.x];
        const ys = e.t === 'linha' ? [e.y1, e.y2] : e.t === 'ret' ? [e.y, e.y + e.h] : [e.y];
        for (const x of xs) assert.ok(x >= -0.01 && x <= pg.larguraMm + 0.01, `${modelo} ${tamanho} x=${x}`);
        for (const y of ys) assert.ok(y >= -0.01 && y <= pg.alturaMm + 0.01, `${modelo} ${tamanho} y=${y}`);
      }
    }
  }
});

test('margem da encadernação alterna: ímpares à esquerda, pares à direita', () => {
  const [p1, p2] = paginasDoMiolo({ modelo: 'quadriculado', paginas: 2, margemInternaMm: 20, margemExternaMm: 8 });
  const minX = (itens: typeof p1.itens) => Math.min(...itens.flatMap((e) => (e.t === 'linha' ? [e.x1, e.x2] : [])));
  const maxX = (itens: typeof p1.itens) => Math.max(...itens.flatMap((e) => (e.t === 'linha' ? [e.x1, e.x2] : [])));
  assert.ok(minX(p1.itens) >= 19 && minX(p2.itens) < 12);
  assert.ok(maxX(p2.itens) <= p2.larguraMm - 19 && maxX(p1.itens) > p1.larguraMm - 12);
});

test('modelos datados mostram as datas certas', () => {
  const sem = paginasDoMiolo({ modelo: 'semanal', paginas: 2, datado: true, inicio: '2026-11-18' });
  const textos = (i: number) => sem[i].itens.flatMap((e) => (e.t === 'texto' ? [e.texto] : []));
  assert.ok(textos(0).includes('Semana de 16 a 22 de novembro'));
  assert.ok(textos(1).includes('Semana de 23 a 29 de novembro'));
  const mes = paginasDoMiolo({ modelo: 'mensal', paginas: 2, datado: true, inicio: '2026-11-01' });
  const t = (i: number) => mes[i].itens.flatMap((e) => (e.t === 'texto' ? [e.texto] : []));
  assert.ok(t(0).includes('Novembro de 2026') && t(1).includes('Dezembro de 2026'));
  assert.equal(t(0).filter((x) => /^\d+$/.test(x)).length >= 30, true);
  const di = paginasDoMiolo({ modelo: 'diario1', paginas: 1, datado: true, inicio: '2026-11-17' });
  assert.ok(di[0].itens.some((e) => e.t === 'texto' && e.texto === 'Terça, 17 de novembro'));
  const nd = paginasDoMiolo({ modelo: 'semanal', paginas: 1, datado: false });
  assert.ok(nd[0].itens.some((e) => e.t === 'texto' && /____/.test(e.texto)));
});

test('SVG da página', () => {
  const [p] = paginasDoMiolo({ modelo: 'pautado', paginas: 1 });
  const svg = paginaParaSvg(p);
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 148 210"/);
  assert.ok(svg.includes('<line '));
});
