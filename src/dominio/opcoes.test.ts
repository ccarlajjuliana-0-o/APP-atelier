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
