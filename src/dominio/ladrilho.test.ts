import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoDoLadrilho, precisaLadrilho, ladoEmPx, avaliarQualidade } from './ladrilho.ts';

test('grade: um item no centro de uma célula, com o espaço em volta', () => {
  const p = planoDoLadrilho({ disposicao: 'grade', lado: 100, espaco: 20 });
  assert.equal(p.largura, 120);
  assert.equal(p.altura, 120);
  assert.deepEqual(p.itens, [{ x: 10, y: 10, lado: 100, giro: 0 }]);
  assert.equal(precisaLadrilho({ disposicao: 'grade', espaco: 0 }), false);
  assert.equal(precisaLadrilho({ disposicao: 'grade', espaco: 5 }), true);
  assert.equal(precisaLadrilho({ disposicao: 'diagonal', espaco: 0 }), true);
});

test('diagonal: duas linhas, a segunda deslocada meia célula (e a sobra volta pela esquerda)', () => {
  const p = planoDoLadrilho({ disposicao: 'diagonal', lado: 100, espaco: 0 });
  assert.equal(p.largura, 100);
  assert.equal(p.altura, 200);
  assert.equal(p.itens.length, 3);
  assert.equal(p.itens[1].x, 50);
  assert.equal(p.itens[1].y, 100);
  assert.equal(p.itens[2].x, -50);
});

test('aleatória: sempre igual, 16 itens, todos dentro do ladrilho', () => {
  const a = planoDoLadrilho({ disposicao: 'aleatoria', lado: 100, espaco: 10 });
  const b = planoDoLadrilho({ disposicao: 'aleatoria', lado: 100, espaco: 10 });
  assert.deepEqual(a, b);
  assert.equal(a.itens.length, 16);
  assert.equal(a.colunas, 4);
  for (const i of a.itens) {
    assert.ok(i.x >= -2 && i.y >= -2 && i.x + i.lado <= a.largura + 2 && i.y + i.lado <= a.altura + 2, JSON.stringify(i));
    assert.ok(Math.abs(i.giro) <= 18);
  }
  assert.notDeepEqual(a.itens.map((i) => i.giro), new Array(16).fill(0));
});

test('ladoEmPx: por tamanho ou por imagens por linha', () => {
  assert.equal(ladoEmPx({ medida: 'tamanho', tamanho: 180, porLinha: 4, areaLargura: 1200 }), 180);
  assert.equal(ladoEmPx({ medida: 'porLinha', tamanho: 180, porLinha: 4, areaLargura: 1200 }), 300);
  assert.equal(ladoEmPx({ medida: 'porLinha', tamanho: 180, porLinha: 1, areaLargura: 3000 }), 600);
});

test('qualidade: imagem pequena esticada fica "baixa"; grande e pequena na tela fica "ótima"', () => {
  const pequena = avaliarQualidade({ larguraImagem: 300, alturaImagem: 300, modo: 'repetida', unico: 100, lado: 400 });
  assert.equal(pequena.nivel, 'baixa');
  assert.equal(pequena.maxLado, 300);
  const boa = avaliarQualidade({ larguraImagem: 1000, alturaImagem: 1000, modo: 'repetida', unico: 100, lado: 160 });
  assert.equal(boa.nivel, 'otima');
  const capa = avaliarQualidade({ larguraImagem: 800, alturaImagem: 600, modo: 'unica', unico: 100, lado: 160 });
  assert.equal(capa.nivel, 'baixa');
  const menor = avaliarQualidade({ larguraImagem: 800, alturaImagem: 600, modo: 'unica', unico: 40, lado: 160 });
  assert.equal(menor.nivel, 'boa');
  assert.equal(avaliarQualidade({ larguraImagem: 1920, alturaImagem: 1080, modo: 'unica', unico: 100, lado: 160 }).nivel, 'boa');
  assert.equal(menor.maxPorcentagem, 57);
});
