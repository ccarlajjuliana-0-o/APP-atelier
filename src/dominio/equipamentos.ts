// Equipamentos: cadastro das máquinas e ferramentas, manutenção por prazo e ligação com o custo por hora do Financeiro.
import type { Ajustes, Maquina } from './financeiro.ts';

export type TipoEquipamento = 'impressora3d' | 'encadernacao' | 'impressao' | 'corte' | 'ferramenta' | 'outro';

export const TIPOS_EQUIPAMENTO: Record<TipoEquipamento, string> = {
  impressora3d: 'Impressora 3D',
  encadernacao: 'Encadernação (prensa, perfuradora, guilhotina…)',
  impressao: 'Impressora de papel',
  corte: 'Corte e vinco',
  ferramenta: 'Ferramenta',
  outro: 'Outro',
};

export type Alimentacao = 'eletrico' | 'manual';
export const ALIMENTACOES: Record<Alimentacao, string> = { eletrico: 'Elétrico', manual: 'Manual' };

export type UnidadeVida = 'horas' | 'ciclos' | 'outro';
export const UNIDADES_VIDA: Record<UnidadeVida, string> = { horas: 'Horas de uso', ciclos: 'Ciclos', outro: 'Outra unidade' };

export interface Tarefa {
  id: string;
  descricao: string;
  intervaloDias: number; // de quantos em quantos dias
  ultimaEm: string | null; // AAAA-MM-DD da última vez feita
}

export interface RegistroManutencao {
  data: string;
  descricao: string;
  observacao: string;
  custoCentavos: number;
}

export interface Equipamento {
  id: string;
  nome: string;
  tipo: TipoEquipamento;
  modelo: string;
  dataCompra: string | null;
  valorCentavos: number;
  alimentacao: Alimentacao; // manual não gasta energia
  vidaUtil: number; // quanto o equipamento aguenta, na unidade abaixo (0 = não calcula o desgaste)
  vidaUtilUnidade: UnidadeVida;
  vidaUtilRotulo: string; // nome da unidade quando for "outro", no singular (ex.: furo, folha, metro)
  potenciaW: number; // consumo médio em watts (só elétrico)
  usarNoCusto: boolean; // aparece como máquina no Financeiro (custo das peças 3D; só com vida útil em horas)
  tarefas: Tarefa[];
  historico: RegistroManutencao[];
  fotos?: Blob[];
  observacoes: string;
  ativo: boolean;
  atualizadoEm: string;
}

/** Sugestões editáveis de manutenção. Os prazos são um ponto de partida: ajuste conforme o manual e o seu uso. */
export const TAREFAS_SUGERIDAS: Record<TipoEquipamento, { descricao: string; intervaloDias: number }[]> = {
  impressora3d: [
    { descricao: 'Limpar o bico e a mesa', intervaloDias: 30 },
    { descricao: 'Lubrificar eixos e fusos', intervaloDias: 90 },
    { descricao: 'Conferir a tensão das correias', intervaloDias: 90 },
    { descricao: 'Nivelar a mesa', intervaloDias: 30 },
  ],
  encadernacao: [
    { descricao: 'Limpar e lubrificar o mecanismo', intervaloDias: 90 },
    { descricao: 'Conferir lâminas e pinos', intervaloDias: 180 },
  ],
  impressao: [
    { descricao: 'Limpeza dos roletes e cabeçote', intervaloDias: 60 },
    { descricao: 'Imprimir teste de bicos', intervaloDias: 30 },
  ],
  corte: [
    { descricao: 'Trocar ou afiar a lâmina', intervaloDias: 90 },
    { descricao: 'Limpar a base de corte', intervaloDias: 30 },
  ],
  ferramenta: [{ descricao: 'Limpar e guardar com cuidado', intervaloDias: 90 }],
  outro: [{ descricao: 'Revisão geral', intervaloDias: 180 }],
};

// ---------- datas (AAAA-MM-DD, sem fuso) ----------

function paraUTC(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function somarDias(iso: string, dias: number): string {
  return new Date(paraUTC(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Dias de `de` até `ate` (negativo se `ate` já passou). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86_400_000);
}

// ---------- manutenção ----------

export type SituacaoTarefa = 'vencida' | 'em_breve' | 'em_dia';
export const AVISO_DIAS = 7;

/** Próxima data da tarefa: última vez + intervalo. Se nunca foi feita, conta da compra (ou de hoje, se não houver data). */
export function proximaDaTarefa(t: Tarefa, dataCompra: string | null, hoje: string): string {
  return somarDias(t.ultimaEm ?? dataCompra ?? hoje, Math.max(1, t.intervaloDias));
}

export function situacaoDaTarefa(proxima: string, hoje: string, aviso = AVISO_DIAS): SituacaoTarefa {
  const dias = diasEntre(hoje, proxima);
  if (dias < 0) return 'vencida';
  if (dias <= aviso) return 'em_breve';
  return 'em_dia';
}

export interface Pendencia {
  equipamentoId: string;
  equipamento: string;
  tarefaId: string;
  tarefa: string;
  proxima: string;
  dias: number; // negativo = atrasada
  situacao: SituacaoTarefa;
}

/** Tarefas vencidas ou perto de vencer dos equipamentos ativos, da mais atrasada para a mais distante. */
export function pendencias(equipamentos: Equipamento[], hoje: string, aviso = AVISO_DIAS): Pendencia[] {
  const out: Pendencia[] = [];
  for (const e of equipamentos) {
    if (!e.ativo) continue;
    for (const t of e.tarefas) {
      if (!(t.intervaloDias > 0)) continue;
      const proxima = proximaDaTarefa(t, e.dataCompra, hoje);
      const situacao = situacaoDaTarefa(proxima, hoje, aviso);
      if (situacao !== 'em_dia') out.push({ equipamentoId: e.id, equipamento: e.nome, tarefaId: t.id, tarefa: t.descricao, proxima, dias: diasEntre(hoje, proxima), situacao });
    }
  }
  return out.sort((a, b) => a.dias - b.dias);
}

export function textoDoPrazo(dias: number): string {
  if (dias < 0) return `atrasada há ${-dias} dia(s)`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `vence em ${dias} dias`;
}

// ---------- registros antigos e custo de uso ----------

/** Completa os campos novos de registros guardados antes deles existirem (aqui ou vindos da nuvem). */
export function normalizarEquipamento(e: Equipamento): Equipamento {
  const legado = e as unknown as { vidaUtilHoras?: number };
  const potencia = e.potenciaW ?? 0;
  return {
    ...e,
    potenciaW: potencia,
    alimentacao: e.alimentacao ?? (potencia > 0 ? 'eletrico' : 'manual'),
    vidaUtil: e.vidaUtil ?? legado.vidaUtilHoras ?? 0,
    vidaUtilUnidade: e.vidaUtilUnidade ?? 'horas',
    vidaUtilRotulo: e.vidaUtilRotulo ?? '',
    tarefas: e.tarefas ?? [],
    historico: e.historico ?? [],
  };
}

/** Como o texto chama a unidade da vida útil ("horas", "ciclos" ou o nome que você deu). */
export function rotuloDaUnidade(e: Pick<Equipamento, 'vidaUtilUnidade' | 'vidaUtilRotulo'>): string {
  if (e.vidaUtilUnidade === 'horas') return 'hora';
  if (e.vidaUtilUnidade === 'ciclos') return 'ciclo';
  return e.vidaUtilRotulo.trim() || 'uso';
}

export interface CustoDeUso {
  centavos: number; // com fração
  por: string; // 'hora', 'ciclo' ou o nome da unidade
}

/**
 * Quanto custa cada unidade de uso: o valor pago dividido pela vida útil.
 * Em horas, soma a energia se o equipamento for elétrico. Devolve null se faltar valor ou vida útil.
 */
export function custoDeUso(e: Equipamento, kwhCentavos: number): CustoDeUso | null {
  if (!(e.vidaUtil > 0) || !(e.valorCentavos > 0)) return null;
  const desgaste = e.valorCentavos / e.vidaUtil;
  const energia = e.vidaUtilUnidade === 'horas' && e.alimentacao === 'eletrico' ? (Math.max(0, e.potenciaW) / 1000) * Math.max(0, kwhCentavos) : 0;
  return { centavos: desgaste + energia, por: rotuloDaUnidade(e) };
}

// ---------- ligação com o Financeiro ----------

/** O equipamento vira uma máquina do Financeiro se estiver marcado e tiver vida útil em horas (o preço das peças 3D usa o tempo de impressão). */
export function maquinaDoEquipamento(e: Equipamento): Maquina | null {
  if (!e.ativo || !e.usarNoCusto || e.vidaUtilUnidade !== 'horas' || !(e.vidaUtil > 0)) return null;
  return { id: e.id, nome: e.nome, valorCentavos: e.valorCentavos, vidaUtilHoras: e.vidaUtil, potenciaW: e.alimentacao === 'eletrico' ? e.potenciaW : 0 };
}

export function maquinasDosEquipamentos(equipamentos: Equipamento[]): Maquina[] {
  return equipamentos.map(maquinaDoEquipamento).filter((m): m is Maquina => m !== null);
}

/** Ajustes do Financeiro com as máquinas vindas de Equipamentos juntas às cadastradas à mão. */
export function comMaquinasDosEquipamentos(a: Ajustes, equipamentos: Equipamento[]): Ajustes {
  const extras = maquinasDosEquipamentos(equipamentos).filter((m) => !a.maquinas.some((x) => x.id === m.id));
  return { ...a, maquinas: [...a.maquinas, ...extras] };
}
