import test from 'node:test';
import assert from 'node:assert/strict';
import { escolhasDaSolicitacao, ehRotaPublica, infoPublica, linkPublico, montarPublicacao, pendentesPublicos, problemaNoEnvio } from './publico.ts';
import type { GrupoOpcoes } from './opcoes.ts';
import type { ExtraCatalogo } from './extras.ts';

const info = {
  wire: { nome: 'Wire-o preto', custoMicro: 100_000, disponivel: 10 },
  wireSem: { nome: 'Wire-o rosa', custoMicro: 100_000, disponivel: 0 },
  c1: { nome: 'Cantoneira dourada', custoMicro: 0, disponivel: 5 },
  c2: { nome: 'Cantoneira prata', custoMicro: 0, disponivel: 0 },
};
const op = (id: string, nome: string, extra: object = {}) => ({ id, nome, materialId: null, quantidade: 0, desperdicioPct: 0, acrescimoCentavos: 0, padrao: false, ...extra });
const grupos: GrupoOpcoes[] = [
  { id: 'g-tipo', nome: 'Tipo', tipo: 'unica', obrigatorio: true, opcoes: [op('a', 'Caderno'), op('b', 'Agenda')] },
  { id: 'g-wire', nome: 'Cor do wire-o', tipo: 'unica', obrigatorio: true, opcoes: [
    op('w1', 'Preto', { materialId: 'wire', quantidade: 1, desperdicioPct: 10, acrescimoCentavos: 300 }),
    op('w2', 'Rosa', { materialId: 'wireSem', quantidade: 1, acrescimoCentavos: 300 }),
  ] },
  { id: 'g-agenda', nome: 'Datada?', tipo: 'unica', obrigatorio: true, mostrarSe: { grupoId: 'g-tipo', opcaoIds: ['b'] }, opcoes: [op('d1', 'Datada'), op('d2', 'Não datada')] },
  { id: 'g-nome', nome: 'Seu apelido', tipo: 'texto', obrigatorio: false, opcoes: [] },
];
const extras: ExtraCatalogo[] = [
  { id: 'extra-cant', nome: 'Cantoneira', precoCentavos: 600, materialId: null, quantidade: 4, variantes: ['c1', 'c2'], ativo: true, ordem: 1 } as unknown as ExtraCatalogo,
  { id: 'extra-nome', nome: 'Nome na capa', precoCentavos: 0, materialId: null, quantidade: 0, variantes: [], pedeTexto: 'Qual nome?', ativo: true, ordem: 2 } as unknown as ExtraCatalogo,
];

test('a cópia pública esconde o que não tem estoque e não leva dados internos', () => {
  const pub = montarPublicacao(grupos, extras, info, 2, '2026-11-16T10:00:00Z');
  const wire = pub.grupos.find((g) => g.id === 'g-wire')!;
  assert.deepEqual(wire.opcoes.map((o) => o.nome), ['Preto']);
  assert.equal(wire.opcoes[0].materialId, null);
  assert.equal(wire.opcoes[0].quantidade, 0);
  assert.equal(wire.opcoes[0].desperdicioPct, 0);
  const cant = pub.grupos.find((g) => g.id === '__extras')!.opcoes.find((o) => o.id === 'extra-cant')!;
  assert.deepEqual(cant.variantes, ['c1']);
  assert.equal(cant.acrescimoCentavos, 600);
  assert.deepEqual(pub.nomes, { c1: 'Cantoneira dourada' });
  assert.equal(JSON.stringify(pub).includes('wireSem'), false);
  assert.equal(pub.grupos.find((g) => g.id === 'g-agenda')!.mostrarSe !== undefined, true);
});

test('pendências públicas respeitam condições e textos pedidos', () => {
  const pub = montarPublicacao(grupos, extras, info, 1, 'x');
  assert.deepEqual(pendentesPublicos(pub, []), ['Tipo', 'Cor do wire-o']);
  const base = [
    { grupoId: 'g-tipo', grupoNome: 'Tipo', opcaoId: 'b', opcaoNome: 'Agenda', materialId: null, quantidade: 0, acrescimoCentavos: 0 },
    { grupoId: 'g-wire', grupoNome: 'Cor', opcaoId: 'w1', opcaoNome: 'Preto', materialId: null, quantidade: 0, acrescimoCentavos: 300 },
  ];
  assert.deepEqual(pendentesPublicos(pub, base), ['Datada?']);
  const comNome = [...base, { grupoId: '__extras', grupoNome: 'Extras', opcaoId: 'extra-nome', opcaoNome: 'Nome na capa', materialId: null, quantidade: 0, acrescimoCentavos: 0, texto: '' }];
  assert.match(pendentesPublicos(pub, comNome).join('|'), /Qual nome/);
  assert.equal(infoPublica(pub).c1.disponivel > 1000, true);
});

test('envio da cliente vira escolhas com os preços de hoje, ignorando o que não existe', () => {
  const r = escolhasDaSolicitacao([...grupos, { id: '__extras', nome: 'Extras', tipo: 'multipla', obrigatorio: false, opcoes: [op('extra-nome', 'Nome na capa', { pedeTexto: 'Qual nome?', acrescimoCentavos: 0 }), op('extra-cant', 'Cantoneira', { variantes: ['c1'], acrescimoCentavos: 600 })] }], [
    { grupoId: 'g-tipo', opcaoId: 'b', opcaoNome: 'qualquer coisa' },
    { grupoId: 'g-wire', opcaoId: 'w1', opcaoNome: 'Preto' },
    { grupoId: 'g-agenda', opcaoId: 'd1', opcaoNome: 'Datada' },
    { grupoId: 'g-nome', opcaoId: '__texto', opcaoNome: 'Lu' },
    { grupoId: '__extras', opcaoId: 'extra-nome', opcaoNome: 'x', texto: 'Ana' },
    { grupoId: '__extras', opcaoId: 'extra-cant', opcaoNome: 'x', materialId: 'c1' },
    { grupoId: 'g-fantasma', opcaoId: 'z', opcaoNome: 'Invasora' },
    { grupoId: 'g-wire', opcaoId: 'w-fantasma', opcaoNome: 'Outra' },
  ], info, 2);
  assert.deepEqual(r.ignoradas, ['Invasora', 'Outra']);
  const nomes = r.escolhas.map((e) => e.opcaoNome);
  assert.deepEqual(nomes, ['Agenda', 'Preto', 'Datada', 'Lu', 'Nome na capa: Ana', 'Cantoneira · Cantoneira dourada']);
  assert.equal(r.escolhas.find((e) => e.opcaoId === 'w1')!.acrescimoCentavos, 300);
  assert.equal(r.escolhas.find((e) => e.opcaoId === 'extra-cant')!.materialId, 'c1');
});

test('pergunta que deixa de aparecer perde a resposta; escolha única mantém a última', () => {
  const r = escolhasDaSolicitacao(grupos, [
    { grupoId: 'g-tipo', opcaoId: 'a', opcaoNome: 'Caderno' },
    { grupoId: 'g-agenda', opcaoId: 'd1', opcaoNome: 'Datada' },
    { grupoId: 'g-wire', opcaoId: 'w1', opcaoNome: 'Preto' },
    { grupoId: 'g-wire', opcaoId: 'w1', opcaoNome: 'Preto' },
  ], info, 1);
  assert.deepEqual(r.escolhas.map((e) => e.opcaoNome), ['Caderno', 'Preto']);
});

test('conferência do envio e link', () => {
  assert.match(problemaNoEnvio({ nome: '', contato: 'x', quantidade: 1 }, []), /nome/);
  assert.match(problemaNoEnvio({ nome: 'A', contato: '', quantidade: 1 }, []), /WhatsApp/);
  assert.match(problemaNoEnvio({ nome: 'A', contato: 'x', quantidade: 0 }, []), /quantidade/);
  assert.match(problemaNoEnvio({ nome: 'A', contato: 'x', quantidade: 1 }, ['Tipo']), /Tipo/);
  assert.equal(problemaNoEnvio({ nome: 'A', contato: 'x', quantidade: 1 }, []), '');
  assert.equal(linkPublico('https://x.github.io', '/APP-atelier/'), 'https://x.github.io/APP-atelier/#/pedido');
  assert.equal(ehRotaPublica('#/pedido'), true);
  assert.equal(ehRotaPublica('#/outro'), false);
});
