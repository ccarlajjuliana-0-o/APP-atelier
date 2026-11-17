// Imposição de livreto: reordena as páginas para imprimir frente e verso, dobrar ao meio e ficar na ordem certa.
import type { Elemento, PaginaMiolo } from './miolo.ts';

export interface LadoDaFolha {
  caderno: number; // 1, 2, 3...
  folha: number; // número da folha no total (1, 2, 3...)
  lado: 'frente' | 'verso';
  esq: number | null; // índice (0 = primeira página) da página à esquerda; null = em branco
  dir: number | null;
}

/** Total de páginas arredondado para cima até múltiplo de 4 (cada folha dobrada tem 4 páginas). */
export const totalComBrancas = (total: number): number => Math.max(4, Math.ceil(total / 4) * 4);

/**
 * Ordem das páginas no livreto. `folhasPorCaderno` = quantas folhas dobradas formam cada caderno (0 = um caderno só).
 * Dentro de cada caderno de n páginas: frente da folha i = [n-1-2i, 2i]; verso = [2i+1, n-2-2i].
 */
export function ordemLivreto(totalPaginas: number, folhasPorCaderno = 0): LadoDaFolha[] {
  const total = totalComBrancas(totalPaginas);
  const tam = folhasPorCaderno > 0 ? Math.max(1, Math.floor(folhasPorCaderno)) * 4 : total;
  const lados: LadoDaFolha[] = [];
  const real = (i: number) => (i < totalPaginas ? i : null);
  let folhaGlobal = 0;
  for (let ini = 0, caderno = 1; ini < total; ini += tam, caderno++) {
    const n = Math.min(tam, total - ini); // múltiplo de 4
    for (let i = 0; i < n / 4; i++) {
      folhaGlobal++;
      lados.push({ caderno, folha: folhaGlobal, lado: 'frente', esq: real(ini + n - 1 - 2 * i), dir: real(ini + 2 * i) });
      lados.push({ caderno, folha: folhaGlobal, lado: 'verso', esq: real(ini + 2 * i + 1), dir: real(ini + n - 2 - 2 * i) });
    }
  }
  return lados;
}

const FOLHAS: [string, number, number][] = [['A4', 297, 210], ['A3', 420, 297], ['A2', 594, 420]];

/** Menor papel que comporta a folha aberta (duas páginas lado a lado). */
export function papelParaFolha(larguraPaginaMm: number, alturaPaginaMm: number): { folha: { l: number; a: number }; papel: string } {
  const l = larguraPaginaMm * 2;
  const a = alturaPaginaMm;
  for (const [nome, pl, pa] of FOLHAS) if (l <= pl + 0.01 && a <= pa + 0.01) return { folha: { l, a }, papel: nome };
  return { folha: { l, a }, papel: 'maior que A2' };
}

function deslocar(itens: Elemento[], dx: number): Elemento[] {
  return itens.map((e) => {
    if (e.t === 'linha') return { ...e, x1: e.x1 + dx, x2: e.x2 + dx };
    return { ...e, x: e.x + dx };
  });
}

/** Folhas abertas (2 páginas lado a lado) prontas para o PDF. Marcas de dobra no topo e na base do meio. */
export function paginasImpostas(paginas: PaginaMiolo[], folhasPorCaderno = 0, marcas = true): PaginaMiolo[] {
  if (!paginas.length) return [];
  const w = paginas[0].larguraMm;
  const h = paginas[0].alturaMm;
  const cinza = '#8A8A8A';
  return ordemLivreto(paginas.length, folhasPorCaderno).map((lado, k) => {
    const itens: Elemento[] = [];
    if (lado.esq !== null) itens.push(...deslocar(paginas[lado.esq].itens, 0));
    if (lado.dir !== null) itens.push(...deslocar(paginas[lado.dir].itens, w));
    if (marcas) {
      itens.push({ t: 'linha', x1: w, y1: 0, x2: w, y2: 3, cor: cinza, esp: 0.2 });
      itens.push({ t: 'linha', x1: w, y1: h - 3, x2: w, y2: h, cor: cinza, esp: 0.2 });
    }
    return { numero: k + 1, larguraMm: w * 2, alturaMm: h, itens };
  });
}
