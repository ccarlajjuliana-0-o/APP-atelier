// Painel da tela Início: resumos rápidos de pedidos, pagamentos, entregas, divulgação e estoque.
import { atrasado, type StatusPedido } from './pedidos.ts';
import { diasEntre } from './equipamentos.ts';

export interface PedidoPainel {
  numero: number;
  cliente: string;
  status: StatusPedido;
  totalCentavos: number;
  pagoCentavos: number;
  dataPrometida: string | null;
}

export interface Etapa { nome: string; feita: boolean; atual: boolean }

const ETAPAS: { status: StatusPedido; nome: string }[] = [
  { status: 'confirmado', nome: 'Confirmado' },
  { status: 'em_producao', nome: 'Em produção' },
  { status: 'pronto', nome: 'Pronto' },
  { status: 'entregue', nome: 'Entregue' },
];

/** Trilha do pedido: etapas já passadas ficam marcadas e a atual é destacada. Orçamento ainda não começou. */
export function etapasDoPedido(status: StatusPedido): Etapa[] {
  const pos = ETAPAS.findIndex((e) => e.status === status);
  return ETAPAS.map((e, i) => ({ nome: e.nome, feita: pos >= 0 && i <= pos, atual: i === pos }));
}

/** "atrasado há 2 dia(s)", "é hoje", "amanhã", "em 5 dias". */
export function textoDoPrazoPedido(dias: number): string {
  if (dias < 0) return `atrasado há ${-dias} dia(s)`;
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

export interface PedidoComPrazo extends PedidoPainel {
  dias: number | null; // até o prazo (negativo = atrasado); null sem prazo
  atrasado: boolean;
  falta: number;
}

const comPrazo = (p: PedidoPainel, hoje: string): PedidoComPrazo => ({
  ...p,
  dias: p.dataPrometida ? diasEntre(hoje, p.dataPrometida) : null,
  atrasado: atrasado(p.status, p.dataPrometida, hoje),
  falta: Math.max(0, p.totalCentavos - p.pagoCentavos),
});

const porPrazo = (a: PedidoComPrazo, b: PedidoComPrazo) => (a.dias ?? 9999) - (b.dias ?? 9999) || a.numero - b.numero;

export interface ResumoPedidos {
  orcamentos: number;
  emAndamento: PedidoComPrazo[]; // confirmado e em produção, com a trilha
  atrasados: number;
  aReceber: { totalCentavos: number; pedidos: PedidoComPrazo[] };
  paraEntregar: PedidoComPrazo[]; // prontos e os que vencem em até `diasAviso` dias (ou já venceram)
}

export function resumirPedidos(pedidos: PedidoPainel[], hoje: string, diasAviso = 3): ResumoPedidos {
  const todos = pedidos.filter((p) => p.status !== 'cancelado').map((p) => comPrazo(p, hoje));
  const abertos = todos.filter((p) => p.status === 'confirmado' || p.status === 'em_producao' || p.status === 'pronto');
  const aReceber = todos.filter((p) => p.status !== 'orcamento' && p.falta > 0).sort(porPrazo);
  return {
    orcamentos: todos.filter((p) => p.status === 'orcamento').length,
    emAndamento: abertos.filter((p) => p.status !== 'pronto').sort(porPrazo),
    atrasados: abertos.filter((p) => p.atrasado).length,
    aReceber: { totalCentavos: aReceber.reduce((s, p) => s + p.falta, 0), pedidos: aReceber },
    paraEntregar: abertos
      .filter((p) => p.status === 'pronto' || (p.dias !== null && p.dias <= diasAviso))
      .sort((a, b) => (a.status === 'pronto' ? 0 : 1) - (b.status === 'pronto' ? 0 : 1) || porPrazo(a, b)),
  };
}

// ---------- divulgação ----------

export interface PostPainel { data: string; titulo: string; status: string }

export interface ResumoDivulgacao {
  ultima: { data: string; titulo: string; diasAtras: number } | null;
  proxima: { data: string; titulo: string; dias: number } | null;
  atrasadas: number; // planejadas para uma data que já passou e ainda não publicadas
  aviso: boolean; // faz tempo sem publicar
}

export const DIAS_SEM_POSTAR = 7;

export function resumirDivulgacao(posts: PostPainel[], hoje: string): ResumoDivulgacao {
  const publicados = posts.filter((p) => p.status === 'publicado' && p.data <= hoje).sort((a, b) => b.data.localeCompare(a.data));
  const pendentes = posts.filter((p) => p.status !== 'publicado' && p.status !== 'descartado');
  const futuras = pendentes.filter((p) => p.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const u = publicados[0];
  const x = futuras[0];
  const ultima = u ? { data: u.data, titulo: u.titulo, diasAtras: diasEntre(u.data, hoje) } : null;
  return {
    ultima,
    proxima: x ? { data: x.data, titulo: x.titulo, dias: diasEntre(hoje, x.data) } : null,
    atrasadas: pendentes.filter((p) => p.data < hoje).length,
    aviso: !ultima || ultima.diasAtras >= DIAS_SEM_POSTAR,
  };
}

export function textoUltimaPublicacao(diasAtras: number): string {
  if (diasAtras <= 0) return 'hoje';
  if (diasAtras === 1) return 'ontem';
  return `há ${diasAtras} dias`;
}

// ---------- estoque ----------

export interface MaterialBaixo { nome: string; unidade: string; disponivel: number; minimo: number }

/** Materiais abaixo do mínimo, dos mais críticos (menor proporção do mínimo) para os menos. */
export function materiaisBaixos(materiais: (MaterialBaixo & { ativo: boolean })[]): MaterialBaixo[] {
  return materiais
    .filter((m) => m.ativo && m.minimo > 0 && m.disponivel < m.minimo)
    .map(({ nome, unidade, disponivel, minimo }) => ({ nome, unidade, disponivel, minimo }))
    .sort((a, b) => a.disponivel / a.minimo - b.disponivel / b.minimo || a.nome.localeCompare(b.nome, 'pt-BR'));
}
