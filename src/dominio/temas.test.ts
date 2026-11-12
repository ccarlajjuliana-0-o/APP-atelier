import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMAS_PRONTOS, MOTIVOS, pascoa, completarTema, daBase, camadasDeFundo, fundosDoTema, dataDaRegra, temaDoDia, proximaDataDoTema, resolverTema, svgDoMotivo, clarear, type TemaPersonalizado,
} from './temas.ts';
import { contraste, textoSobre } from '../app/tema/tema.ts';
import { conferirComAMarca } from './divulgacao.ts';

test('Páscoa e datas móveis', () => {
  assert.equal(pascoa(2026), '2026-04-05');
  assert.equal(pascoa(2027), '2027-03-28');
  assert.equal(dataDaRegra({ tipo: 'pascoa', delta: -47 }, 2026), '2026-02-17'); // Terça de Carnaval
  assert.equal(dataDaRegra({ tipo: 'domingo', mes: 5, n: 2 }, 2026), '2026-05-10');
  assert.equal(dataDaRegra({ tipo: 'domingo', mes: 8, n: 2 }, 2026), '2026-08-09');
  assert.equal(dataDaRegra({ tipo: 'blackfriday' }, 2026), '2026-11-27');
  assert.equal(dataDaRegra({ tipo: 'fixa', mes: 12, dia: 25 }, 2026), '2026-12-25');
  assert.equal(dataDaRegra({ tipo: 'nenhuma' }, 2026), null);
});

test('janela do tema: 7 dias antes até 5 dias depois', () => {
  const t = [{ id: 'natal', regra: { tipo: 'fixa' as const, mes: 12, dia: 25 } }];
  assert.equal(temaDoDia(t, '2026-12-17'), null);
  assert.equal(temaDoDia(t, '2026-12-18')?.id, 'natal');
  assert.equal(temaDoDia(t, '2026-12-30')?.id, 'natal');
  assert.equal(temaDoDia(t, '2026-12-30')?.fim, '2026-12-30');
  assert.equal(temaDoDia(t, '2026-12-31'), null);
  assert.equal(temaDoDia(t, '2026-12-20', 3, 5), null); // janela configurável
});

test('janela que atravessa o ano (Ano Novo) e festividades sobrepostas', () => {
  const t = TEMAS_PRONTOS.map((x) => ({ id: x.id, regra: x.regra }));
  assert.equal(temaDoDia(t, '2027-01-04')?.id, 'anonovo');
  assert.equal(temaDoDia(t, '2026-12-27')?.id, 'natal'); // 2 dias depois do Natal, 5 antes do Ano Novo
  assert.equal(temaDoDia(t, '2026-12-29')?.id, 'anonovo'); // mais perto do Ano Novo
  assert.equal(temaDoDia(t, '2026-11-12'), null); // hoje: nenhuma festividade perto
  assert.equal(temaDoDia(t, '2026-11-21')?.id, 'blackfriday');
});

test('próxima data do tema', () => {
  assert.equal(proximaDataDoTema({ tipo: 'fixa', mes: 12, dia: 25 }, '2026-11-12'), '2026-12-25');
  assert.equal(proximaDataDoTema({ tipo: 'fixa', mes: 12, dia: 25 }, '2026-12-28'), '2026-12-25'); // ainda no período
  assert.equal(proximaDataDoTema({ tipo: 'fixa', mes: 12, dia: 25 }, '2026-12-31'), '2027-12-25');
});

const meu = (o: Partial<TemaPersonalizado>): TemaPersonalizado => ({
  ...daBase({ ...TEMAS_PRONTOS[0], regra: { tipo: 'nenhuma' } }),
  id: 'meu1', nome: 'Aniversário do atelier', regra: { tipo: 'fixa', mes: 11, dia: 15 }, cores: { principal: '#8A4F9E', principalEscuro: '#C398C8', apoio: '#F1CDD9', menu: '#4A2E5F' },
  motivo: 'nenhum', corMotivo: '#C398C8', saudacao: 'Parabéns, atelier!', ativo: true, atualizadoEm: '', ...o,
});

test('resolver: automático, manual, desligado e temas próprios', () => {
  assert.equal(resolverTema({}, [], '2026-11-12'), null);
  assert.equal(resolverTema({}, [], '2026-12-22')?.id, 'natal');
  assert.equal(resolverTema({}, [], '2026-12-22')?.manual, false);
  assert.equal(resolverTema({}, [], '2026-12-22')?.fim, '2026-12-30');
  assert.equal(resolverTema({ temaFestivo: 'desligado' }, [], '2026-12-22'), null);
  const manual = resolverTema({ temaFestivo: 'pascoa' }, [], '2026-11-12');
  assert.equal(manual?.id, 'pascoa');
  assert.equal(manual?.manual, true);
  assert.equal(manual?.fim, null);
  assert.equal(resolverTema({}, [meu({})], '2026-11-12')?.id, 'meu1'); // 15/11 está na janela (3 dias)
  assert.equal(resolverTema({}, [meu({ ativo: false })], '2026-11-12'), null);
  assert.equal(resolverTema({ temaFestivo: 'sumiu' }, [], '2026-11-12'), null);
  assert.equal(resolverTema({ temaDiasAntes: 1 }, [meu({})], '2026-11-12'), null);
});

test('desenho de fundo', () => {
  assert.equal(svgDoMotivo('nenhum', '#C398C8'), '');
  for (const m of Object.keys(MOTIVOS).filter((x) => x !== 'nenhum') as (keyof typeof MOTIVOS)[]) {
    const url = svgDoMotivo(m, '#E7A6BE');
    assert.ok(url.startsWith('data:image/svg+xml,'), m);
    assert.ok(decodeURIComponent(url).includes('<svg'), m);
  }
  assert.ok(decodeURIComponent(svgDoMotivo('flor', '"><script>')).includes('#C398C8')); // cor inválida não entra no desenho
});

test('temas prontos: ids únicos, textos na voz da marca e cores legíveis', () => {
  assert.equal(new Set(TEMAS_PRONTOS.map((t) => t.id)).size, TEMAS_PRONTOS.length);
  for (const t of TEMAS_PRONTOS) {
    assert.deepEqual(conferirComAMarca(t.saudacao, []), [], `${t.id}: ${t.saudacao}`);
    assert.ok(contraste(t.cores.principal, textoSobre(t.cores.principal)) >= 4, `${t.id} principal ${contraste(t.cores.principal, textoSobre(t.cores.principal)).toFixed(2)}`);
    assert.ok(contraste(t.cores.principalEscuro, textoSobre(t.cores.principalEscuro)) >= 4, `${t.id} principal escuro ${contraste(t.cores.principalEscuro, textoSobre(t.cores.principalEscuro)).toFixed(2)}`);
    assert.ok(contraste(t.cores.menu, textoSobre(t.cores.menu)) >= 7, `${t.id} menu`);
  }
});

test('clarear', () => {
  assert.equal(clarear('#000000'), '#616161');
  assert.equal(clarear('#FFFFFF'), '#ffffff');
});

test('completarTema preenche o que falta e limita valores', () => {
  const t = completarTema({ ...TEMAS_PRONTOS[0], veu: 5, tamanho: 9999, menuVeu: 200 } as never);
  assert.equal(t.modoImagem, 'unica');
  assert.equal(t.menuImagem, 'nenhuma');
  assert.equal(t.veu, 40);
  assert.equal(t.tamanho, 400);
  assert.equal(t.menuVeu, 95);
});

test('camadasDeFundo: imagem única cobre, repetida ladrilha', () => {
  const base = { url: 'blob:x', desenho: '', veu: 80, tamanho: 120, corVeu: 'var(--fundo)' };
  const u = camadasDeFundo({ ...base, modo: 'unica' })!;
  assert.match(u.tamanho, /cover/);
  const r = camadasDeFundo({ ...base, modo: 'repetida' })!;
  assert.match(r.tamanho, /120px/);
  assert.match(r.repeticao, /repeat$/);
  assert.equal(camadasDeFundo({ ...base, url: null, modo: 'unica' }), null);
});

test('fundosDoTema: menu nenhum / mesma / propria', () => {
  const a = daBase(TEMAS_PRONTOS[0]);
  assert.equal(fundosDoTema(a, { imagem: 'blob:a', menu: 'blob:m' }).menu, null);
  const mesma = fundosDoTema({ ...a, menuImagem: 'mesma' }, { imagem: 'blob:a', menu: 'blob:m' }).menu!;
  assert.match(mesma.camadas, /blob:a/);
  const propria = fundosDoTema({ ...a, menuImagem: 'propria' }, { imagem: 'blob:a', menu: 'blob:m' }).menu!;
  assert.match(propria.camadas, /blob:m/);
  assert.equal(fundosDoTema({ ...a, menuImagem: 'propria' }, { imagem: 'blob:a', menu: null }).menu, null);
});

test('tema pronto ajustado (mesmo id) substitui o original', () => {
  const orig = TEMAS_PRONTOS[0];
  const meuNatal = meu({ id: orig.id, nome: 'Meu ajuste', regra: orig.regra, veu: 60 });
  const r = resolverTema({ temaFestivo: orig.id }, [meuNatal], '2026-01-01')!;
  assert.equal(r.nome, 'Meu ajuste');
  assert.equal(r.ajustado, true);
  assert.equal(r.personalizado, false);
});
