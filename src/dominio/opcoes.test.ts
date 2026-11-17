import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acrescimoDaOpcao, opcaoDisponivel, escolhasPadrao, alternarEscolha, acrescimoTotal, gruposPendentes, criarEscolha,
  type GrupoOpcoes, type OpcaoProduto,
} from './opcoes.ts';
import { necessidades, type ItemPedido } from './pedidos.ts';
import type { InfoMaterial } from './produtos.ts';

const op = (o: Partial<OpcaoProduto>): OpcaoProduto => ({ id: 'o', nome: 'Op', materialId: null, quantidade: 1, desperdicioPct: 0, acrescimoCentavos: null, padrao: false, ...o });
const info: Record<string, InfoMaterial> = {
  rosa: { nome: 'Wire-o rosa', custoMicro: 500_000, disponivel: 3 }, // 0,50 por unidade
  azul: { nome: 'Wire-o azul', custoMicro: 500_000, disponivel: 0 },
};
const cor: GrupoOpcoes = {
  id: 'g1', nome: 'Cor do wire-o', tipo: 'unica', obrigatorio: true,
  opcoes: [op({ id: 'rosa', nome: 'Rosa', materialId: 'rosa', padrao: true }), op({ id: 'azul', nome: 'Azul', materialId: 'azul' })],
};
const elastico: GrupoOpcoes = {
  id: 'g2', nome: 'Elástico', tipo: 'unica', obrigatorio: false,
  opcoes: [op({ id: 'sem', nome: 'Sem elástico' }), op({ id: 'com', nome: 'Com elástico', acrescimoCentavos: 300 })],
};

test('acréscimo automático = custo × multiplicador; manual prevalece', () => {
  assert.equal(acrescimoDaOpcao(cor.opcoes[0], info, 3), 150);
  assert.equal(acrescimoDaOpcao(elastico.opcoes[1], info, 3), 300);
  assert.equal(acrescimoDaOpcao(elastico.opcoes[0], info, 3), 0);
});

test('opção sem estoque some; sem material sempre aparece', () => {
  assert.equal(opcaoDisponivel(cor.opcoes[0], info), true);
  assert.equal(opcaoDisponivel(cor.opcoes[0], info, 4), false);
  assert.equal(opcaoDisponivel(cor.opcoes[1], info), false);
  assert.equal(opcaoDisponivel(elastico.opcoes[0], info), true);
});

test('escolhas padrão, troca em grupo único e soma', () => {
  let e = escolhasPadrao([cor, elastico], info, 3);
  assert.deepEqual(e.map((x) => x.opcaoId), ['rosa']);
  e = alternarEscolha(e, elastico, elastico.opcoes[1], info, 3);
  assert.equal(acrescimoTotal(e), 150 + 300);
  e = alternarEscolha(e, elastico, elastico.opcoes[0], info, 3);
  assert.equal(acrescimoTotal(e), 150);
  // grupo obrigatório de escolha única não pode ficar vazio
  assert.equal(alternarEscolha(e, cor, cor.opcoes[0], info, 3).length, e.length);
});

test('pendências ignoram grupo sem nada disponível', () => {
  assert.deepEqual(gruposPendentes([cor], [], info), ['Cor do wire-o']);
  assert.deepEqual(gruposPendentes([cor], [], { rosa: { ...info.rosa, disponivel: 0 }, azul: info.azul }), []);
});

test('escolhas entram nas necessidades de material', () => {
  const it: ItemPedido = {
    produtoId: 'p', descricao: 'x', quantidade: 2, precoUnitCentavos: 0, modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: '',
    escolhas: [criarEscolha(cor, cor.opcoes[0], info, 3)],
  };
  const n = necessidades([it], { p: [] }, { rosa: 3 });
  assert.deepEqual(n.map((x) => [x.materialId, x.necessario, x.reservar, x.falta]), [['rosa', 2, 2, 0]]);
});

import { definirTexto, definirOutro, trocarVariante, variantesDisponiveis, linhasDeEscolhas } from './opcoes.ts';
import { formularioPadrao } from './formularioPadrao.ts';

test('cantoneira: acréscimo fixo e só os tipos com estoque', () => {
  const inf: Record<string, InfoMaterial> = {
    dourada: { nome: 'Cantoneira dourada', custoMicro: 800_000, disponivel: 4 },
    prata: { nome: 'Cantoneira prata', custoMicro: 800_000, disponivel: 0 },
  };
  const cant = op({ id: 'c', nome: 'Cantoneira', acrescimoCentavos: 600, variantes: ['dourada', 'prata'] });
  const g: GrupoOpcoes = { id: 'g', nome: 'Extras', tipo: 'multipla', obrigatorio: false, opcoes: [cant] };
  assert.deepEqual(variantesDisponiveis(cant, inf), ['dourada']);
  const e = alternarEscolha([], g, cant, inf, 2);
  assert.equal(e[0].materialId, 'dourada');
  assert.equal(e[0].opcaoNome, 'Cantoneira · Cantoneira dourada');
  assert.equal(acrescimoTotal(e), 600);
  assert.equal(opcaoDisponivel(cant, { ...inf, dourada: { ...inf.dourada, disponivel: 0 } }), false);
  assert.equal(trocarVariante(e, g, cant, 'prata', inf, 2)[0].materialId, 'prata');
});

test('texto, Outro e linhas por pergunta', () => {
  const g: GrupoOpcoes = { id: 't', nome: 'Estilo', tipo: 'multipla', obrigatorio: true, permiteOutro: true, opcoes: [op({ id: 'a', nome: 'Fofo' })] };
  let e = definirTexto([], { ...g, tipo: 'email', nome: 'E-mail' }, 'a@b.com');
  assert.equal(e.length, 1);
  assert.equal(definirTexto(e, { ...g, tipo: 'email', nome: 'E-mail' }, ' ').length, 0);
  e = alternarEscolha([], g, g.opcoes[0], {}, 1);
  e = definirOutro(e, g, 'Boho');
  assert.deepEqual(linhasDeEscolhas(e), ['Estilo: Fofo, Boho']);
  assert.equal(definirOutro(e, g, null).length, 1);
  assert.deepEqual(gruposPendentes([{ ...g, tipo: 'texto' }], [], {}), ['Estilo']);
});

test('formulário padrão tem perguntas, seções e condições', () => {
  let n = 0;
  const m = formularioPadrao(() => `i${n++}`);
  assert.ok(m.length >= 20);
  assert.ok(m.some((g) => g.tipo === 'secao') && m.some((g) => g.mostrarSe));
  assert.equal(new Set(m.flatMap((g) => [g.id, ...g.opcoes.map((o) => o.id)])).size, n);
});

import { definirTextoDaOpcao } from './opcoes.ts';
test('extra que pede texto (nome na capa) com valor', () => {
  const nome = op({ id: 'n', nome: 'Nome na capa', acrescimoCentavos: 500, pedeTexto: 'Qual nome?' });
  const g: GrupoOpcoes = { id: 'x', nome: 'Extras', tipo: 'multipla', obrigatorio: false, opcoes: [nome] };
  let e = alternarEscolha([], g, nome, {}, 1);
  assert.deepEqual(gruposPendentes([g], e, {}), ['Extras (Qual nome?)']);
  e = definirTextoDaOpcao(e, g, nome, 'Maria', {}, 1);
  assert.equal(e[0].opcaoNome, 'Nome na capa: Maria');
  assert.equal(acrescimoTotal(e), 500);
  assert.deepEqual(gruposPendentes([g], e, {}), []);
});

import { grupoVisivel, podarEscolhas, adicionarAvulso, removerEscolha } from './opcoes.ts';
import { extrasComoGrupo, extrasPadrao } from './extras.ts';

test('perguntas condicionais: costura x wire-o x disco', () => {
  let n = 0;
  const m = formularioPadrao(() => `i${n++}`);
  const enc = m.find((g) => g.nome === 'Tipo de encadernação')!;
  const wireo = m.find((g) => g.nome === 'Cor do wire-o')!;
  const disco = m.find((g) => g.nome === 'Cor dos discos')!;
  const costura = m.find((g) => g.nome === 'Costura')!;
  const marcar = (nome: string) => alternarEscolha([], enc, enc.opcoes.find((o) => o.nome === nome)!, {}, 1);
  const w = marcar('Wire-o');
  assert.deepEqual([wireo, disco, costura].map((g) => grupoVisivel(g, m, w)), [true, false, false]);
  assert.deepEqual([wireo, disco, costura].map((g) => grupoVisivel(g, m, marcar('Costura'))), [false, false, true]);
  // trocar de wire-o para disco descarta a cor do wire-o
  const comCor = alternarEscolha(w, wireo, wireo.opcoes[0], {}, 1);
  const trocou = [...comCor.filter((e) => e.grupoId !== enc.id), ...marcar('Disco')];
  assert.equal(podarEscolhas(m, trocou).some((e) => e.grupoId === wireo.id), false);
  // pendências só das perguntas visíveis
  assert.ok(!gruposPendentes(m, marcar('Disco'), {}).includes('Cor do wire-o'));
  assert.ok(gruposPendentes(m, marcar('Disco'), {}).includes('Cor dos discos'));
});

test('extras: valores combinados, avulso somando e remoção', () => {
  const ex = extrasPadrao('2026-01-01');
  const g = extrasComoGrupo(ex);
  const val = (nome: string) => g.opcoes.find((o) => o.nome === nome)!;
  let e = alternarEscolha([], g, val('Cantoneira'), {}, 1);
  e = alternarEscolha(e, g, val('Elástico'), {}, 1);
  e = alternarEscolha(e, g, val('Bolso canguru'), {}, 1);
  assert.equal(acrescimoTotal(e), 600 + 500 + 650);
  e = adicionarAvulso(e, 'x', 'Chaveiro', 800);
  assert.equal(acrescimoTotal(e), 600 + 500 + 650 + 800);
  e = removerEscolha(e, g.id, '__avulso:x');
  assert.equal(acrescimoTotal(e), 1750);
});

test('versão: acompanhamentos com limite conforme Premium ou Deluxe/Master', () => {
  let n = 0;
  const m = formularioPadrao(() => `i${n++}`);
  const por = (nome: string) => m.filter((g) => g.nome.startsWith(nome));
  const tipo = m.find((g) => g.nome.startsWith('Caderno,'))!;
  const [vGeral, vPlanner] = por('Qual versão');
  const [ate3, ate5] = por('Quais acompanhamentos');
  const marca = (g: GrupoOpcoes, inicio: string, es: ReturnType<typeof alternarEscolha> = []) => alternarEscolha(es, g, g.opcoes.find((o) => o.nome.startsWith(inicio))!, {}, 1);
  // planner + Premium
  let e = marca(tipo, 'Planner');
  assert.ok(grupoVisivel(vPlanner, m, e) && !grupoVisivel(vGeral, m, e));
  assert.ok(vPlanner.opcoes[0].nome.includes('miolo de anotações ou check list'));
  assert.ok(!grupoVisivel(ate3, m, e) && !grupoVisivel(ate5, m, e));
  e = marca(vPlanner, 'Premium', e);
  assert.ok(grupoVisivel(ate3, m, e) && !grupoVisivel(ate5, m, e));
  // caderno + Master
  let c = marca(tipo, 'Caderno');
  c = marca(vGeral, 'Master', c);
  assert.ok(grupoVisivel(ate5, m, c) && !grupoVisivel(ate3, m, c));
  // essential não tem acompanhamentos
  assert.ok(!grupoVisivel(ate3, m, marca(vGeral, 'Essential', marca(tipo, 'Caderno'))));
  // limite de 3
  let r = e;
  for (const o of ate3.opcoes.slice(0, 5)) r = alternarEscolha(r, ate3, o, {}, 1);
  assert.equal(r.filter((x) => x.grupoId === ate3.id).length, 3);
});

test('agenda datada abre "como"; sem opção indiferente', () => {
  let n = 0;
  const m = formularioPadrao(() => `i${n++}`);
  const tipo = m.find((g) => g.nome.startsWith('Caderno,'))!;
  const datada = m.find((g) => g.nome === 'Você prefere a agenda:')!;
  const como = m.find((g) => g.nome.startsWith('Datada: como'))!;
  assert.ok(!datada.opcoes.some((o) => /indiferente/i.test(o.nome)));
  let e = alternarEscolha([], tipo, tipo.opcoes.find((o) => o.nome === 'Agenda')!, {}, 1);
  assert.ok(!grupoVisivel(como, m, e));
  e = alternarEscolha(e, datada, datada.opcoes.find((o) => o.nome === 'Datada')!, {}, 1);
  assert.ok(grupoVisivel(como, m, e));
  // a arte da capa vem antes de cores e estilo, e estes são de escolha única
  const nomes = m.map((g) => g.nome);
  assert.ok(nomes.indexOf('Como você prefere definir a arte da capa?') < nomes.indexOf('Quais cores você mais gosta?'));
  assert.equal(m.find((g) => g.nome === 'Quais cores você mais gosta?')!.tipo, 'unica');
  assert.equal(m.find((g) => g.nome === 'Você prefere um estilo mais:')!.tipo, 'unica');
  assert.ok(m.some((g) => g.nome === 'Tipo de bordas do miolo'));
  assert.ok(!nomes.some((x) => /Cultura|Reflexão & Desenvolvimento/.test(x)));
});
