import { db, novoId } from './db.ts';
import { normalizarEquipamento, type Equipamento } from '../dominio/equipamentos.ts';

export async function listarEquipamentos(): Promise<Equipamento[]> {
  const l = await db.equipamentos.toArray();
  return l.map((e) => normalizarEquipamento({ ...e, ativo: e.ativo !== false })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function salvarEquipamento(e: Equipamento): Promise<Equipamento> {
  const salvo = { ...e, id: e.id || novoId(), atualizadoEm: new Date().toISOString() };
  await db.equipamentos.put(salvo);
  return salvo;
}

/**
 * Registra uma manutenção feita. Se a tarefa existe, ela passa a contar da data informada.
 * Se teve custo, também entra nas despesas avulsas (e portanto no caixa do mês).
 */
export async function registrarManutencao(
  equipamentoId: string,
  tarefaId: string | null,
  descricao: string,
  data: string,
  observacao: string,
  custoCentavos: number,
): Promise<Equipamento> {
  return db.transaction('rw', [db.equipamentos, db.despesas], async () => {
    const bruto = await db.equipamentos.get(equipamentoId);
    if (!bruto) throw new Error('Equipamento não encontrado.');
    const e = normalizarEquipamento(bruto);
    const agora = new Date().toISOString();
    const tarefas = e.tarefas.map((t) => (t.id === tarefaId && (!t.ultimaEm || data > t.ultimaEm) ? { ...t, ultimaEm: data } : t));
    const novo: Equipamento = {
      ...e, tarefas, historico: [{ data, descricao, observacao, custoCentavos }, ...e.historico], atualizadoEm: agora,
    };
    await db.equipamentos.put(novo);
    if (custoCentavos > 0) {
      await db.despesas.put({
        id: novoId(), tipo: 'avulsa', descricao: `Manutenção: ${e.nome} · ${descricao}`, valorCentavos: custoCentavos, data, ativo: true, atualizadoEm: agora,
      });
    }
    return novo;
  });
}
