import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BYTES_QR, qrMatriz, qrSvg } from './qr.ts';

test('tamanho do QR cresce com o texto e tem os três localizadores', () => {
  const pequeno = qrMatriz('A');
  assert.equal(pequeno.length, 21);
  const link = qrMatriz('https://x.github.io/APP-atelier/#/pedido');
  assert.equal(link.length, 29);
  for (const [r, c] of [[0, 0], [0, link.length - 7], [link.length - 7, 0]]) {
    assert.equal(link[r][c], true);
    assert.equal(link[r + 3][c + 3], true);
    assert.equal(link[r + 1][c + 1], false);
  }
  assert.equal(link[link.length - 8][8], true); // módulo escuro fixo
  assert.equal(qrMatriz('x'.repeat(MAX_BYTES_QR)).length, 57);
  assert.throws(() => qrMatriz('x'.repeat(MAX_BYTES_QR + 1)), /grande demais/);
});

test('é determinístico e gera SVG', () => {
  assert.deepEqual(qrMatriz('oi'), qrMatriz('oi'));
  const svg = qrSvg('oi');
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 232 232"/); // (21 + 8) × 8
});
