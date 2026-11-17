import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarPdf, larguraTexto } from './pdf.ts';
import { paginasDoMiolo } from './miolo.ts';
import { ordemLivreto, paginasImpostas, papelParaFolha, totalComBrancas } from './imposicao.ts';

test('largura do texto bate com as métricas oficiais', () => {
  assert.equal(Math.round(larguraTexto('Hello', 10, 'sans')), 23); // H722 e556 l222 l222 o556 = 2278 → 22.8
  assert.ok(larguraTexto('Hello', 10, 'sans', true) > larguraTexto('Hello', 10, 'sans'));
  assert.equal(larguraTexto('é', 10, 'sans'), larguraTexto('e', 10, 'sans'));
});

test('ordem do livreto: 8 páginas', () => {
  const o = ordemLivreto(8);
  const p = (l: (typeof o)[number]) => [l.esq === null ? 0 : l.esq + 1, l.dir === null ? 0 : l.dir + 1];
  assert.deepEqual(o.map(p), [[8, 1], [2, 7], [6, 3], [4, 5]]);
  assert.deepEqual(o.map((l) => l.lado), ['frente', 'verso', 'frente', 'verso']);
});

test('páginas em branco para completar múltiplo de 4', () => {
  assert.equal(totalComBrancas(10), 12);
  const o = ordemLivreto(10);
  assert.equal(o.length, 6);
  assert.deepEqual([o[0].esq, o[0].dir], [null, 0]); // página 12 inexistente → branco à esquerda da capa interna
  const usadas = o.flatMap((l) => [l.esq, l.dir]).filter((x) => x !== null).sort((a, b) => a! - b!);
  assert.deepEqual(usadas, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('cadernos: cada página aparece uma vez e fica dentro do seu caderno', () => {
  const o = ordemLivreto(40, 2); // 2 folhas = 8 páginas por caderno
  assert.equal(o.length, 20);
  const usadas = o.flatMap((l) => [l.esq, l.dir]).filter((x) => x !== null) as number[];
  assert.equal(new Set(usadas).size, 40);
  for (const l of o) assert.equal(Math.floor(l.esq! / 8), Math.floor(l.dir! / 8));
  assert.equal(Math.max(...o.map((l) => l.caderno)), 5);
  // as folhas de uma mesma folha física somam n+1 (frente e verso) e as páginas ímpares ficam à direita na frente
  assert.deepEqual(o.slice(0, 4).map((l) => [l.esq! + 1, l.dir! + 1]), [[8, 1], [2, 7], [6, 3], [4, 5]]);
});

test('folha aberta e papel necessário', () => {
  assert.equal(papelParaFolha(148, 210).papel, 'A4');
  assert.equal(papelParaFolha(105, 148).papel, 'A4');
  assert.equal(papelParaFolha(170, 230).papel, 'A3');
  assert.equal(papelParaFolha(210, 297).papel, 'A3');
});

test('PDF válido, com o número certo de páginas', () => {
  const pgs = paginasDoMiolo({ modelo: 'semanal', paginas: 6, datado: true, inicio: '2026-11-16', titulo: 'Planner Ânima' });
  const pdf = gerarPdf(pgs, 'Teste');
  const txt = Buffer.from(pdf).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4'));
  assert.ok(txt.trimEnd().endsWith('%%EOF'));
  assert.match(txt, /\/Count 6 /);
  const imp = gerarPdf(paginasImpostas(pgs, 0), 'Livreto');
  assert.match(Buffer.from(imp).toString('latin1'), /\/Count 4 /); // 6 páginas → 8 → 2 folhas × 2 lados
  assert.equal(paginasImpostas(pgs)[0].larguraMm, 296);
});
