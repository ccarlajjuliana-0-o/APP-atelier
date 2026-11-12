import { db } from './db.ts';
import { listarMateriais, saldos } from './materiais.ts';
import { hojeLocal } from './pedidos.ts';
import { listarEquipamentos } from './equipamentos.ts';
import { abaixoDoMinimo } from '../dominio/estoque.ts';
import { diasEntre, pendencias, type Pendencia } from '../dominio/equipamentos.ts';
import { atrasado } from '../dominio/pedidos.ts';

export interface PedidoEmAtencao {
  numero: number;
  cliente: string;
  dataPrometida: string;
  dias: number; // negativo = atrasado
}

export interface Atencao {
  manutencoes: Pendencia[];
  pedidos: PedidoEmAtencao[];
  materiaisParaRepor: string[];
}

/** O que está pedindo atenção hoje: manutenção, entregas perto ou atrasadas e material abaixo do mínimo. */
export async function carregarAtencao(): Promise<Atencao> {
  const hoje = hojeLocal();
  const [equipamentos, pedidos, clientes, materiais, saldo] = await Promise.all([
    listarEquipamentos(), db.pedidos.toArray(), db.clientes.toArray(), listarMateriais(), saldos(),
  ]);
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const emAtencao: PedidoEmAtencao[] = [];
  for (const p of pedidos) {
    if (!p.dataPrometida || (p.status !== 'confirmado' && p.status !== 'em_producao' && p.status !== 'pronto')) continue;
    const dias = diasEntre(hoje, p.dataPrometida);
    if (atrasado(p.status, p.dataPrometida, hoje) || dias <= 2) {
      emAtencao.push({ numero: p.numero, cliente: nomeCliente.get(p.clienteId ?? '') ?? 'cliente', dataPrometida: p.dataPrometida, dias });
    }
  }
  emAtencao.sort((a, b) => a.dias - b.dias);
  const repor = materiais
    .filter((m) => m.ativo && m.minimo > 0 && abaixoDoMinimo(saldo[m.id]?.disponivel ?? 0, m.minimo))
    .map((m) => m.nome);
  return { manutencoes: pendencias(equipamentos, hoje), pedidos: emAtencao, materiaisParaRepor: repor };
}
