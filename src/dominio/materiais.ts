// Materiais: unidades, categorias, lista inicial sugerida e leitura de números em português.

export type Unidade = 'folha' | 'g' | 'un' | 'm' | 'ml';
export type Categoria = 'papel' | 'capa' | 'encadernacao' | 'impressao' | 'filamento' | 'embalagem';

export const UNIDADES: Record<Unidade, { singular: string; plural: string }> = {
  folha: { singular: 'folha', plural: 'folhas' },
  g: { singular: 'g', plural: 'g' },
  un: { singular: 'un', plural: 'un' },
  m: { singular: 'm', plural: 'm' },
  ml: { singular: 'ml', plural: 'ml' },
};

export const CATEGORIAS: Record<Categoria, string> = {
  papel: 'Papéis',
  capa: 'Capas',
  encadernacao: 'Encadernação',
  impressao: 'Tintas',
  filamento: 'Filamentos',
  embalagem: 'Embalagens',
};

export interface MaterialInicial {
  nome: string;
  categoria: Categoria;
  unidade: Unidade;
  essencial: boolean;
  minimo: number;
  embalagemNome: string;
  embalagemQtd: number;
}

const m = (
  categoria: Categoria, nome: string, unidade: Unidade, embalagemNome: string, embalagemQtd: number,
  minimo: number, essencial = false,
): MaterialInicial => ({ categoria, nome, unidade, essencial, minimo, embalagemNome, embalagemQtd });

/** Sugestão para começar. Preços ficam em branco: o custo nasce da primeira compra registrada. */
export const MATERIAIS_INICIAIS: MaterialInicial[] = [
  m('papel', 'Sulfite A4 75 g', 'folha', 'resma', 500, 500, true),
  m('papel', 'Offset A4 90 g', 'folha', 'resma', 500, 250, true),
  m('papel', 'Pólen A4 80 g', 'folha', 'resma', 500, 200),
  m('papel', 'Couchê fosco A4 170 g (divisórias)', 'folha', 'pacote', 50, 20),
  m('papel', 'Cartão A4 250 g (capas leves)', 'folha', 'pacote', 50, 20),
  m('papel', 'Papel adesivo fosco A4', 'folha', 'pacote', 50, 20),
  m('papel', 'Papel decorado para capa', 'folha', 'pacote', 10, 5),
  m('capa', 'Papelão paraná 2 mm', 'folha', 'pacote', 10, 10, true),
  m('capa', 'Courino para capa', 'm', 'metro', 1, 2),
  m('encadernacao', 'Wire-o 2:1 – 5/8" (até 120 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 3/4" (até 140 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 7/8" (até 180 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 1" (até 200 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 1 1/8" (até 250 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 1 1/4" (até 270 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 1 3/8" (até 300 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 2:1 – 1 1/2" (até 330 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 1/4" (até 25 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 5/16" (até 50 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 3/8" (até 60 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 7/16" (até 85 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 1/2" (até 95 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Wire-o 3:1 – 9/16" (até 110 folhas)', 'un', 'caixa', 100, 20),
  m('encadernacao', 'Elástico chato 12 mm', 'm', 'rolo', 10, 5),
  m('encadernacao', 'Fita de cetim (marcador)', 'm', 'rolo', 10, 5),
  m('encadernacao', 'Linha encerada', 'm', 'rolo', 100, 20),
  m('encadernacao', 'Cola PVA para encadernação', 'g', 'frasco', 500, 200),
  m('encadernacao', 'Filme de laminação A4', 'un', 'pacote', 100, 20),
  m('impressao', 'Tinta EcoTank preta', 'ml', 'frasco', 70, 70, true),
  m('impressao', 'Tinta EcoTank ciano', 'ml', 'frasco', 70, 70),
  m('impressao', 'Tinta EcoTank magenta', 'ml', 'frasco', 70, 70),
  m('impressao', 'Tinta EcoTank amarela', 'ml', 'frasco', 70, 70),
  m('filamento', 'PLA lilás', 'g', 'rolo', 1000, 250, true),
  m('filamento', 'PLA azul bebê', 'g', 'rolo', 1000, 250, true),
  m('filamento', 'PLA rosa claro', 'g', 'rolo', 1000, 250),
  m('filamento', 'PLA branco', 'g', 'rolo', 1000, 250, true),
  m('filamento', 'PLA silk dourado', 'g', 'rolo', 1000, 250),
  m('embalagem', 'Saco celofane', 'un', 'pacote', 100, 20),
  m('embalagem', 'Etiqueta / tag do produto', 'un', 'pacote', 50, 20),
  m('embalagem', 'Cartão de agradecimento', 'un', 'pacote', 50, 20),
];

/** Lê "12,50", "1.250,5" ou "12.5". Devolve NaN se não for número. */
export function lerNumero(texto: string): number {
  let t = texto.trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
}

/** Custo médio depois de uma compra. Se o custo atual é desconhecido (0), vale o custo da compra. */
export function custoAposCompra(
  saldoAtual: number, custoAtualMicro: number, quantidadeComprada: number, custoUnitCompraMicro: number,
): number {
  const saldoConhecido = custoAtualMicro > 0 ? Math.max(0, saldoAtual) : 0;
  const total = saldoConhecido + quantidadeComprada;
  if (total <= 0) return custoUnitCompraMicro;
  return Math.round((saldoConhecido * custoAtualMicro + quantidadeComprada * custoUnitCompraMicro) / total);
}

export function formatarQuantidade(valor: number, unidade: Unidade): string {
  const n = valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const u = UNIDADES[unidade];
  return `${n} ${valor === 1 ? u.singular : u.plural}`;
}

/** Custo unitário em micro-reais, com quantas casas forem úteis: R$ 0,0520 por folha. */
export function microParaTexto(micro: number): string {
  const reais = micro / 1_000_000;
  const casas = reais >= 1 ? 2 : reais >= 0.1 ? 3 : 4;
  return 'R$ ' + reais.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
