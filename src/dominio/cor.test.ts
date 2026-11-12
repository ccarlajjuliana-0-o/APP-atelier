import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarHex, hexParaRgb, rgbParaHex, rgbParaHsv, hsvParaRgb } from './cor.ts';

test('normalizarHex aceita 3 e 6 dígitos, com ou sem #', () => {
  assert.equal(normalizarHex('#59f7ff'), '#59F7FF');
  assert.equal(normalizarHex('59F7FF'), '#59F7FF');
  assert.equal(normalizarHex('#abc'), '#AABBCC');
  assert.equal(normalizarHex(' #12345 '), null);
  assert.equal(normalizarHex('zzzzzz'), null);
  assert.equal(normalizarHex(''), null);
});

test('hex ↔ rgb', () => {
  assert.deepEqual(hexParaRgb('#59F7FF'), [89, 247, 255]);
  assert.equal(rgbParaHex([89, 247, 255]), '#59F7FF');
  assert.equal(rgbParaHex([300, -5, 7.4]), '#FF0007');
});

test('rgb ↔ hsv ida e volta', () => {
  for (const hex of ['#59F7FF', '#9168A0', '#000000', '#FFFFFF', '#FBF7F4', '#E7A6BE', '#FF0000']) {
    const volta = rgbParaHex(hsvParaRgb(rgbParaHsv(hexParaRgb(hex))));
    assert.equal(volta, hex);
  }
  const v = rgbParaHsv([255, 0, 0]);
  assert.equal(v.h, 0);
  assert.equal(v.s, 1);
  assert.equal(v.v, 1);
});
