import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataDoRegistro, nuvemSubstitui, precisaEnviar, emLotes, serializar, desserializar, TABELAS_SINCRONIZADAS } from './sync.ts';

test('data do registro: alteração, senão criação', () => {
  assert.equal(dataDoRegistro({ atualizadoEm: '2026-11-12T10:00:00.000Z' }), Date.parse('2026-11-12T10:00:00.000Z'));
  assert.equal(dataDoRegistro({ criadoEm: '2026-11-11T10:00:00.000Z' }), Date.parse('2026-11-11T10:00:00.000Z'));
  assert.equal(dataDoRegistro({}), 0);
  assert.equal(dataDoRegistro({ atualizadoEm: 'lixo' }), 0);
});

test('formatos de data diferentes comparam pelo instante', () => {
  const a = dataDoRegistro({ atualizadoEm: '2026-11-12T10:00:00.000Z' });
  const b = dataDoRegistro({ atualizadoEm: '2026-11-12T07:00:00.000-03:00' });
  assert.equal(a, b);
  assert.equal(nuvemSubstitui(b, a), false);
});

test('a versão mais recente vence', () => {
  assert.equal(nuvemSubstitui(10, null), true);
  assert.equal(nuvemSubstitui(10, 5), true);
  assert.equal(nuvemSubstitui(5, 10), false);
  assert.equal(nuvemSubstitui(10, 10), false);
});

test('só envia o que mudou depois do último envio', () => {
  assert.equal(precisaEnviar(11, 10), true);
  assert.equal(precisaEnviar(10, 10), false);
  assert.equal(precisaEnviar(5, 10), false);
  assert.equal(precisaEnviar(5, 0), true);
});

test('lotes', () => {
  assert.deepEqual(emLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(emLotes([], 3), []);
});

test('fotos viram texto e voltam', async () => {
  const b1 = new Blob(['a'], { type: 'image/jpeg' });
  const b2 = new Blob(['b'], { type: 'image/jpeg' });
  const ida = await serializar({ id: 'x', foto: b1, fotos: [b1, b2], vazio: [], nome: 'n' }, async (b) => `T:${await b.text()}`);
  assert.deepEqual(ida, { id: 'x', foto: { __blob: 'T:a' }, fotos: { __blob: ['T:a', 'T:b'] }, vazio: [], nome: 'n' });
  const volta = await desserializar(ida, async (t) => new Blob([t.slice(2)]));
  assert.equal(await (volta.foto as Blob).text(), 'a');
  assert.equal((volta.fotos as Blob[]).length, 2);
  assert.equal(await (volta.fotos as Blob[])[1].text(), 'b');
  assert.equal(volta.nome, 'n');
});

test('tabelas sincronizadas', () => {
  assert.ok(TABELAS_SINCRONIZADAS.includes('movimentacoes'));
  assert.ok(TABELAS_SINCRONIZADAS.includes('equipamentos'));
  assert.ok(TABELAS_SINCRONIZADAS.includes('publicacoes'));
  assert.ok(!(TABELAS_SINCRONIZADAS as readonly string[]).includes('fontes'));
});
