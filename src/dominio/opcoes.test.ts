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
import { modeloAgenda } from './modeloAgenda.ts';

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

test('modelo da agenda tem perguntas e seções', () => {
  let n = 0;
  const m = modeloAgenda(() => `i${n++}`);
  assert.ok(m.length >= 20);
  assert.ok(m.some((g) => g.tipo === 'secao') && m.some((g) => g.tipo === 'email'));
  assert.equal(new Set(m.flatMap((g) => [g.id, ...g.opcoes.map((o) => o.id)])).size, n);
});
