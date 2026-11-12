import { db } from './db.ts';
import { listarMateriais, saldos } from './materiais.ts';
import { listarPublicacoes } from './divulgacao.ts';
import { carregarAtencao, type Atencao } from './atencao.ts';
import { hojeLocal } from './pedidos.ts';
import { pagoCentavos, totalCentavos } from '../dominio/pedidos.ts';
import {
  materiaisBaixos, resumirDivulgacao, resumirPedidos, type MaterialBaixo, type ResumoDivulgacao, type ResumoPedidos,
} from '../dominio/painel.ts';

export interface Painel {
  hoje: string;
  pedidos: ResumoPedidos;
  divulgacao: ResumoDivulgacao;
  baixos: MaterialBaixo[];
  atencao: Atencao;
}

export async function carregarPainel(): Promise<Painel> {
  const hoje = hojeLocal();
  const [pedidos, clientes, posts, materiais, saldo, atencao] = await Promise.all([
    db.pedidos.toArray(), db.clientes.toArray(), listarPublicacoes(), listarMateriais(), saldos(), carregarAtencao(),
  ]);
  const nome = new Map(clientes.map((c) => [c.id, c.nome]));
  return {
    hoje,
    pedidos: resumirPedidos(pedidos.map((p) => ({
      numero: p.numero, cliente: nome.get(p.clienteId ?? '') ?? 'sem cliente', status: p.status, totalCentavos: totalCentavos(p.itens),
      pagoCentavos: pagoCentavos(p.pagamentos), dataPrometida: p.dataPrometida,
    })), hoje),
    divulgacao: resumirDivulgacao(posts, hoje),
    baixos: materiaisBaixos(materiais.map((m) => ({ nome: m.nome, unidade: m.unidade, disponivel: saldo[m.id]?.disponivel ?? 0, minimo: m.minimo, ativo: m.ativo }))),
    atencao,
  };
}
