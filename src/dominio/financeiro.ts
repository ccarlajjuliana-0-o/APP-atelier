// Financeiro: ajustes de preço, máquinas, despesas, caixa do mês e ponto de equilíbrio.
// Valores em centavos inteiros. Nada aqui vem preenchido com números "de mercado": o que depende de você nasce em branco.
import { custoDoProdutoCentavos, lucroCentavos, precoSugeridoCentavos } from './preco.ts';
import type { Linha } from './produtos.ts';

export interface Maquina {
  id: string;
  nome: string;
  valorCentavos: number; // quanto custou
  vidaUtilHoras: number; // horas de uso até trocar
  potenciaW: number; // consumo médio em watts (para a energia)
}

export interface Canal {
  id: string;
  nome: string;
  taxaPct: number; // % que o canal fica da venda
}

export interface Ajustes {
  id: 'financeiro';
  multiplicadorEncadernacao: number | null; // preço = custo × multiplicador ÷ (1 − taxa)
  multiplicador3d: number | null;
  desperdicioEncadernacaoPct: number; // sobre os materiais
  desperdicio3dPct: number; // sobre o custo (falhas de impressão)
  taxaMediaPct: number; // taxa média de venda, usada no ponto de equilíbrio
  kwhCentavos: number; // tarifa de energia por kWh
  maquina3dId: string | null; // máquina usada nas peças 3D
  maquinas: Maquina[];
  canais: Canal[];
  atualizadoEm?: string; // usado na sincronização
}

export const AJUSTES_PADRAO: Ajustes = {
  id: 'financeiro',
  multiplicadorEncadernacao: null,
  multiplicador3d: null,
  desperdicioEncadernacaoPct: 5,
  desperdicio3dPct: 30,
  taxaMediaPct: 0,
  kwhCentavos: 0,
  maquina3dId: null,
  maquinas: [],
  canais: [
    { id: 'direta', nome: 'Venda direta (Pix ou dinheiro)', taxaPct: 0 },
    { id: 'shopee', nome: 'Shopee', taxaPct: 0 },
    { id: 'ml', nome: 'Mercado Livre', taxaPct: 0 },
    { id: 'cartao', nome: 'Cartão', taxaPct: 0 },
  ],
};

export function completarAjustes(a: Partial<Ajustes> | undefined): Ajustes {
  return { ...AJUSTES_PADRAO, ...(a ?? {}), id: 'financeiro' };
}

/** Custo de uma hora de máquina: desgaste (valor ÷ vida útil) + energia. Em centavos, com fração. */
export function custoHoraMaquinaCentavos(m: Maquina, kwhCentavos: number): number {
  const desgaste = m.vidaUtilHoras > 0 ? m.valorCentavos / m.vidaUtilHoras : 0;
  const energia = (Math.max(0, m.potenciaW) / 1000) * Math.max(0, kwhCentavos);
  return desgaste + energia;
}

export function custoMaquinaCentavos(minutos: number, m: Maquina | null, kwhCentavos: number): number {
  if (!m || !(minutos > 0)) return 0;
  return Math.round((custoHoraMaquinaCentavos(m, kwhCentavos) * minutos) / 60);
}

export interface EntradaPreco {
  linha: Linha;
  materiaisCentavos: number;
  tempoImpressaoMin: number;
  tempoTrabalhoMin: number;
  precoAtualCentavos: number | null;
}

export interface ResultadoPreco {
  materiais: number;
  maquina: number;
  custo: number; // materiais + máquina + desperdício
  multiplicador: number | null;
  /** Preço sugerido por canal (mesma ordem dos canais). null se o multiplicador não foi definido. */
  sugeridoPorCanal: (number | null)[];
  /** Lucro e margem no preço atual, sem taxa de canal. */
  lucroAtual: number | null;
  margemAtualPct: number | null;
  /** Lucro por hora de trabalho no preço atual. */
  horaAtual: number | null;
}

export function precificar(e: EntradaPreco, a: Ajustes): ResultadoPreco {
  const ehImpressao = e.linha === 'impressao3d';
  const maquina = ehImpressao ? custoMaquinaCentavos(e.tempoImpressaoMin, a.maquinas.find((m) => m.id === a.maquina3dId) ?? null, a.kwhCentavos) : 0;
  const custo = custoDoProdutoCentavos({
    materiaisCentavos: e.materiaisCentavos,
    desperdicioPercentual: ehImpressao ? a.desperdicio3dPct : a.desperdicioEncadernacaoPct,
    baseDoPercentual: ehImpressao ? 'custo' : 'materiais',
    extrasCentavos: maquina > 0 ? [maquina] : [],
  });
  const mult = ehImpressao ? a.multiplicador3d : a.multiplicadorEncadernacao;
  const valido = mult !== null && mult > 0;
  const sugeridoPorCanal = a.canais.map((c) => (valido && c.taxaPct < 100 ? precoSugeridoCentavos(custo, mult, c.taxaPct / 100) : null));
  const lucro = e.precoAtualCentavos !== null ? lucroCentavos(e.precoAtualCentavos, custo) : null;
  return {
    materiais: e.materiaisCentavos,
    maquina,
    custo,
    multiplicador: valido ? mult : null,
    sugeridoPorCanal,
    lucroAtual: lucro,
    margemAtualPct: lucro !== null && e.precoAtualCentavos ? (lucro / e.precoAtualCentavos) * 100 : null,
    horaAtual: lucro !== null && e.tempoTrabalhoMin > 0 ? Math.round((lucro * 60) / e.tempoTrabalhoMin) : null,
  };
}

// ---------- despesas e caixa ----------

export interface Despesa {
  id: string;
  tipo: 'fixa' | 'avulsa';
  descricao: string;
  valorCentavos: number; // fixa: por mês; avulsa: do lançamento
  data: string; // AAAA-MM-DD (só avulsa)
  ativo: boolean;
  atualizadoEm: string;
}

export function totalFixasCentavos(despesas: Despesa[]): number {
  return despesas.filter((d) => d.tipo === 'fixa' && d.ativo).reduce((s, d) => s + d.valorCentavos, 0);
}

export const mesDe = (dataISO: string): string => dataISO.slice(0, 7);

export interface LinhaCaixa {
  data: string; // AAAA-MM-DD ('' para despesa fixa do mês)
  tipo: 'entrada' | 'saida';
  origem: 'pedido' | 'compra' | 'despesa' | 'fixa';
  descricao: string;
  valorCentavos: number;
}

export interface FluxoMes {
  entradas: number;
  saidas: number;
  resultado: number;
  linhas: LinhaCaixa[];
}

export interface PagamentoCaixa { data: string; valorCentavos: number; descricao: string }
export interface CompraCaixa { data: string; valorCentavos: number; descricao: string }

/** Caixa do mês: pagamentos recebidos, compras de material, despesas avulsas e despesas fixas. */
export function fluxoDoMes(mes: string, pagamentos: PagamentoCaixa[], compras: CompraCaixa[], despesas: Despesa[]): FluxoMes {
  const linhas: LinhaCaixa[] = [];
  for (const p of pagamentos) if (mesDe(p.data) === mes) linhas.push({ data: p.data, tipo: 'entrada', origem: 'pedido', descricao: p.descricao, valorCentavos: p.valorCentavos });
  for (const c of compras) if (mesDe(c.data) === mes) linhas.push({ data: c.data, tipo: 'saida', origem: 'compra', descricao: c.descricao, valorCentavos: c.valorCentavos });
  for (const d of despesas) {
    if (!d.ativo) continue;
    if (d.tipo === 'avulsa' && mesDe(d.data) === mes) linhas.push({ data: d.data, tipo: 'saida', origem: 'despesa', descricao: d.descricao, valorCentavos: d.valorCentavos });
    if (d.tipo === 'fixa') linhas.push({ data: '', tipo: 'saida', origem: 'fixa', descricao: `${d.descricao} (fixa do mês)`, valorCentavos: d.valorCentavos });
  }
  linhas.sort((a, b) => (a.data === b.data ? 0 : a.data === '' ? 1 : b.data === '' ? -1 : a.data.localeCompare(b.data)));
  const entradas = linhas.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valorCentavos, 0);
  const saidas = linhas.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valorCentavos, 0);
  return { entradas, saidas, resultado: entradas - saidas, linhas };
}

// ---------- ponto de equilíbrio ----------

export interface Equilibrio {
  contribuicaoPorPedido: number;
  pedidosNecessarios: number | null; // null: contribuição zero ou negativa
}

/** Contribuição por pedido = ticket médio − taxa média − material médio. Equilíbrio = despesas fixas ÷ contribuição. */
export function equilibrio(custosFixosMes: number, ticketMedio: number, materialMedio: number, taxaMediaPct: number): Equilibrio {
  const contribuicao = Math.round(ticketMedio * (1 - taxaMediaPct / 100) - materialMedio);
  if (contribuicao <= 0) return { contribuicaoPorPedido: contribuicao, pedidosNecessarios: null };
  return { contribuicaoPorPedido: contribuicao, pedidosNecessarios: custosFixosMes > 0 ? Math.ceil(custosFixosMes / contribuicao) : 0 };
}
