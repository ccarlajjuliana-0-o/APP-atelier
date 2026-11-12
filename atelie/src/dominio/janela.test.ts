import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitarJanela, janelaPadrao, lerJanelaGuardada } from './janela.ts';

test('janela padrão fica no canto inferior direito', () => {
  assert.deepEqual(janelaPadrao(1400, 800), { w: 440, h: 640, x: 940, y: 140 });
});

test('janela não passa das bordas nem fica pequena demais', () => {
  assert.deepEqual(limitarJanela({ x: -50, y: -50, w: 100, h: 100 }, 1000, 700), { x: 8, y: 8, w: 300, h: 320 });
  assert.deepEqual(limitarJanela({ x: 900, y: 600, w: 440, h: 640 }, 1000, 700), { x: 552, y: 52, w: 440, h: 640 });
  assert.deepEqual(limitarJanela({ x: 0, y: 0, w: 5000, h: 5000 }, 1000, 700), { x: 8, y: 8, w: 984, h: 684 });
});

test('tela pequena (celular): ocupa quase tudo', () => {
  const j = janelaPadrao(360, 640);
  assert.equal(j.w, 336);
  assert.ok(j.x >= 8 && j.x + j.w <= 352 && j.y >= 8 && j.y + j.h <= 632);
});

test('leitura do que foi guardado', () => {
  assert.deepEqual(lerJanelaGuardada('{"x":1,"y":2,"w":300,"h":400}'), { x: 1, y: 2, w: 300, h: 400 });
  assert.equal(lerJanelaGuardada('{"x":1}'), null);
  assert.equal(lerJanelaGuardada('lixo'), null);
  assert.equal(lerJanelaGuardada(null), null);
});
