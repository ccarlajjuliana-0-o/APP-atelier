import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomeDoBackup, dataDoNome, precisaFazerBackup, copiasParaApagar, tamanhoLegivel } from './backupNuvem.ts';

test('nome do backup e volta', () => {
  const d = new Date(2026, 10, 16, 18, 5);
  assert.equal(nomeDoBackup(d), 'backup-2026-11-16-1805.json');
  assert.equal(dataDoNome('backup-2026-11-16-1805.json')?.getTime(), d.getTime());
  assert.equal(dataDoNome('foto.png'), null);
  assert.equal(dataDoNome('backup-2026-13-40-9999.json'), null);
});

test('quando fazer backup', () => {
  const dia = 24 * 3600 * 1000;
  const agora = Date.UTC(2026, 10, 16);
  assert.equal(precisaFazerBackup({ ultimo: null, agora, dias: 7 }), true);
  assert.equal(precisaFazerBackup({ ultimo: agora - 3 * dia, agora, dias: 7 }), false);
  assert.equal(precisaFazerBackup({ ultimo: agora - 7 * dia, agora, dias: 7 }), true);
  assert.equal(precisaFazerBackup({ ultimo: agora - dia + 30_000, agora, dias: 1 }), true);
  assert.equal(precisaFazerBackup({ ultimo: NaN, agora, dias: 7 }), true);
});

test('guarda só as cópias mais recentes e nunca apaga o que não é backup', () => {
  const nomes = ['backup-2026-11-01-1000.json', 'backup-2026-11-03-1000.json', 'backup-2026-11-02-1000.json', 'outro.txt', 'backup-2026-11-04-1000.json'];
  assert.deepEqual(copiasParaApagar(nomes, 2).sort(), ['backup-2026-11-01-1000.json', 'backup-2026-11-02-1000.json']);
  assert.deepEqual(copiasParaApagar(nomes, 10), []);
  assert.deepEqual(copiasParaApagar(nomes, 0).sort(), ['backup-2026-11-01-1000.json', 'backup-2026-11-02-1000.json', 'backup-2026-11-03-1000.json']);
});

test('tamanho legível', () => {
  assert.equal(tamanhoLegivel(500), '500 B');
  assert.equal(tamanhoLegivel(2048), '2 KB');
  assert.equal(tamanhoLegivel(2.5 * 1024 * 1024), '2,5 MB');
});
