import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fundoDaPaleta, PALETAS, FONTES_CORPO, FONTES_TITULO, FONTES_SCRIPT, variaveis, contraste, textoSobre, urlDasFontes, achar, PREFERENCIAS_PADRAO, remotoMaisNovo } from '../app/tema/tema.ts';

test('contraste: preto no branco é máximo e iguais é 1', () => {
  assert.ok(Math.abs(contraste('#000000', '#FFFFFF') - 21) < 0.01);
  assert.ok(Math.abs(contraste('#9168A0', '#9168A0') - 1) < 0.001);
});

test('todas as paletas têm texto legível sobre a cor principal, nos dois modos, e no menu', () => {
  for (const p of PALETAS) {
    for (const sistemaEscuro of [false, true]) {
      const v = variaveis({ ...PREFERENCIAS_PADRAO, paletaId: p.id, modo: sistemaEscuro ? 'escuro' : 'claro' }, false);
      assert.ok(contraste(v['--principal'], v['--sobre-principal']) >= 4.0, `${p.id} principal ${sistemaEscuro ? 'escuro' : 'claro'}: ${contraste(v['--principal'], v['--sobre-principal']).toFixed(2)}`);
      assert.ok(contraste(v['--menu'], v['--sobre-menu']) >= 7, `${p.id} menu ${sistemaEscuro ? 'escuro' : 'claro'}`);
      assert.ok(contraste(v['--menu-ativo'], v['--sobre-menu-ativo']) >= 4.0, `${p.id} menu ativo ${sistemaEscuro ? 'escuro' : 'claro'}`);
    }
  }
});

test('ids únicos nas paletas e nas fontes', () => {
  for (const lista of [PALETAS, FONTES_CORPO, FONTES_TITULO, FONTES_SCRIPT]) assert.equal(new Set(lista.map((x) => x.id)).size, lista.length);
  assert.ok(PALETAS.length >= 10);
});

test('cor livre do menu claro troca o texto do menu para escuro', () => {
  const v = variaveis({ ...PREFERENCIAS_PADRAO, modo: 'claro', menuLivre: '#F1CDD9' }, false);
  assert.equal(v['--menu'], '#F1CDD9');
  assert.equal(v['--sobre-menu'], '#3E3550');
  assert.equal(textoSobre('#24385C'), '#FFFFFF');
});

test('fontes: padrão, escolha e endereço do Google Fonts', () => {
  const v = variaveis({ ...PREFERENCIAS_PADRAO, fonteTitulo: 'playfair', fonteScript: 'inexistente' }, false);
  assert.ok(v['--fonte-titulo'].includes('Playfair Display'));
  assert.ok(v['--fonte-script'].includes('Great Vibes'));
  assert.ok(v['--fonte-corpo'].includes('Nunito'));
  assert.equal(achar(FONTES_CORPO, undefined).id, 'nunito');
  assert.equal(urlDasFontes([achar(FONTES_CORPO, 'sistema')]), '');
  const u = urlDasFontes([achar(FONTES_CORPO, 'lato'), achar(FONTES_TITULO, 'playfair'), achar(FONTES_CORPO, 'lato')]);
  assert.equal(u, 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@500;600;700&display=swap');
});

test('visual da nuvem só vale se for mais novo', () => {
  assert.equal(remotoMaisNovo(undefined, '2026-11-12T10:00:00Z'), true);
  assert.equal(remotoMaisNovo('2026-11-12T10:00:00Z', '2026-11-12T11:00:00Z'), true);
  assert.equal(remotoMaisNovo('2026-11-12T11:00:00Z', '2026-11-12T11:00:00Z'), false);
  assert.equal(remotoMaisNovo('2026-11-12T12:00:00Z', '2026-11-12T11:00:00Z'), false);
  assert.equal(remotoMaisNovo('2026-11-12T12:00:00Z', undefined), false);
});

test('fundo e texto livres ajustam o resto e a escala limita', () => {
  const v = variaveis({ ...PREFERENCIAS_PADRAO, modo: 'claro', fundoLivre: '#102030' }, false);
  assert.equal(v['--fundo'], '#102030');
  assert.equal(v['--texto'], '#FFFFFF');
  assert.ok(contraste(v['--texto'], v['--fundo']) >= 4.5);
  const w = variaveis({ ...PREFERENCIAS_PADRAO, modo: 'claro', textoLivre: '#222222' }, false);
  assert.equal(w['--texto'], '#222222');
  assert.equal(w['--fundo'], '#FBF7F4');
  assert.equal(variaveis({ ...PREFERENCIAS_PADRAO, escalaFonte: 999 }, false)['--escala'], '1.4');
  assert.equal(variaveis({ ...PREFERENCIAS_PADRAO }, false)['--escala'], '1');
});

test('texto ilegível sobre o fundo é ignorado', () => {
  const v = variaveis({ ...PREFERENCIAS_PADRAO, modo: 'claro', fundoLivre: '#99C0F0', textoLivre: '#99C0F0' }, false);
  assert.ok(contraste(v['--texto'], v['--fundo']) >= 4.5);
  const w = variaveis({ ...PREFERENCIAS_PADRAO, modo: 'claro', textoLivre: '#FBF7F4' }, false);
  assert.equal(w['--texto'], '#3E3550');
});

test('cada paleta tem fundo próprio legível nos dois modos; a da marca mantém o original', () => {
  for (const p of PALETAS) {
    for (const modo of ['claro', 'escuro'] as const) {
      const v = variaveis({ ...PREFERENCIAS_PADRAO, paletaId: p.id, modo }, false);
      assert.equal(v['--fundo'].toUpperCase(), fundoDaPaleta(p, modo === 'escuro').toUpperCase(), `${p.id} ${modo}`);
      assert.ok(contraste(v['--texto'], v['--fundo']) >= 7, `${p.id} ${modo} texto/fundo`);
      assert.ok(contraste(v['--texto'], v['--cartao']) >= 7, `${p.id} ${modo} texto/cartão`);
    }
  }
  assert.equal(variaveis({ ...PREFERENCIAS_PADRAO, paletaId: 'marca', modo: 'claro' }, false)['--fundo'], '#FBF7F4');
  assert.equal(variaveis({ ...PREFERENCIAS_PADRAO, paletaId: 'marca', modo: 'escuro' }, false)['--fundo'], '#1E1726');
  assert.notEqual(fundoDaPaleta(PALETAS.find((x) => x.id === 'mel')!, false), '#FBF7F4');
});
