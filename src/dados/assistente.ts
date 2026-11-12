import { db } from './db.ts';
import { nuvem } from './nuvem.ts';
import { listarMateriais, saldos } from './materiais.ts';
import { listarProdutos } from './produtos.ts';
import { carregarAjustes, dadosDoCaixa, listarDespesas, materiaisPorProduto } from './financeiro.ts';
import { carregarAtencao } from './atencao.ts';
import { listarEquipamentos } from './equipamentos.ts';
import { hojeLocal } from './pedidos.ts';
import { listarPublicacoes } from './divulgacao.ts';
import { comMaquinasDosEquipamentos } from '../dominio/equipamentos.ts';
import { fluxoDoMes, mesDe, precificar, totalFixasCentavos } from '../dominio/financeiro.ts';
import { ABERTOS, STATUS, atrasado, pagoCentavos, totalCentavos } from '../dominio/pedidos.ts';
import { LINHAS } from '../dominio/produtos.ts';
import { CANAIS, STATUS_POST } from '../dominio/divulgacao.ts';
import { limitarMensagens, montarContexto, primeiroNome, type Mensagem, type SnapshotAssistente } from '../dominio/assistente.ts';

export async function montarSnapshot(): Promise<SnapshotAssistente> {
  const hoje = hojeLocal();
  const [materiais, saldo, produtos, custos, ajustesBase, equipamentos, pedidos, clientes, despesas, caixa, atencao, posts] = await Promise.all([
    listarMateriais(), saldos(), listarProdutos(), materiaisPorProduto(), carregarAjustes(), listarEquipamentos(), db.pedidos.toArray(),
    db.clientes.toArray(), listarDespesas(), dadosDoCaixa(), carregarAtencao(), listarPublicacoes(),
  ]);
  const ajustes = comMaquinasDosEquipamentos(ajustesBase, equipamentos);
  const nomeCliente = new Map(clientes.map((c) => [c.id, primeiroNome(c.nome)]));
  const mes = mesDe(hoje);
  const fluxo = fluxoDoMes(mes, caixa.pagamentos, caixa.compras, despesas);

  const textoAtencao: string[] = [
    ...atencao.manutencoes.map((m) => `${m.equipamento}: ${m.tarefa} (${m.dias < 0 ? `venceu há ${-m.dias} dia(s)` : m.dias === 0 ? 'vence hoje' : `vence em ${m.dias} dia(s)`})`),
    ...atencao.pedidos.map((p) => `Pedido #${p.numero} (${p.cliente}): prazo ${p.dataPrometida} (${p.dias < 0 ? `atrasado ${-p.dias} dia(s)` : `faltam ${p.dias} dia(s)`})`),
    ...atencao.materiaisParaRepor.map((n) => `Repor material: ${n}`),
  ];

  return {
    hoje,
    materiais: materiais.filter((m) => m.ativo).map((m) => ({
      nome: m.nome, unidade: m.unidade, fisico: saldo[m.id]?.fisico ?? 0, disponivel: saldo[m.id]?.disponivel ?? 0, minimo: m.minimo, custoMicro: m.custoMedioMicro,
    })),
    produtos: produtos.filter((p) => p.ativo).map((p) => {
      const c = custos[p.id] ?? { materiais: 0, semCusto: 0 };
      const r = precificar({ linha: p.linha, materiaisCentavos: c.materiais, tempoImpressaoMin: p.perfil3d?.tempoImpressaoMin ?? 0, tempoTrabalhoMin: p.tempoTrabalhoMin, precoAtualCentavos: p.precoCentavos }, ajustes);
      return {
        nome: p.nome, linha: LINHAS[p.linha], precoCentavos: p.precoCentavos, custoCentavos: r.custo, materiaisSemCusto: c.semCusto,
        sugerido: ajustes.canais.map((canal, i) => ({ canal: canal.nome, centavos: r.sugeridoPorCanal[i] })),
        margemPct: r.margemAtualPct, horaCentavos: r.horaAtual, tempoTrabalhoMin: p.tempoTrabalhoMin,
      };
    }),
    pedidos: pedidos.filter((p) => ABERTOS.includes(p.status)).sort((a, b) => a.numero - b.numero).map((p) => ({
      numero: p.numero, cliente: nomeCliente.get(p.clienteId ?? '') ?? 'sem cliente', status: STATUS[p.status], totalCentavos: totalCentavos(p.itens),
      pagoCentavos: pagoCentavos(p.pagamentos), dataPrometida: p.dataPrometida, atrasado: atrasado(p.status, p.dataPrometida, hoje),
      itens: p.itens.map((i) => `${i.quantidade}× ${i.descricao}`).join(', '),
    })),
    caixaMes: { mes, entrou: fluxo.entradas, saiu: fluxo.saidas, fixas: totalFixasCentavos(despesas) },
    ajustes: { multiplicadorEncadernacao: ajustes.multiplicadorEncadernacao, multiplicador3d: ajustes.multiplicador3d, kwhCentavos: ajustes.kwhCentavos },
    atencao: textoAtencao,
    publicacoes: posts.filter((p) => p.data >= hoje && p.status !== 'publicado' && p.status !== 'descartado').map((p) => ({
      data: p.data, titulo: p.titulo, canal: CANAIS[p.canal], status: STATUS_POST[p.status],
    })),
  };
}

export async function perguntar(historico: Mensagem[]): Promise<string> {
  if (!nuvem) throw new Error('O assistente precisa da nuvem ligada (Supabase).');
  const mensagens = limitarMensagens(historico);
  const contexto = montarContexto(await montarSnapshot());
  const { data, error } = await nuvem.functions.invoke('Assistente', { body: { mensagens, contexto } });
  if (error) {
    // Erros da função chegam com o texto no corpo da resposta.
    let detalhe = '';
    try { detalhe = ((await (error as { context?: Response }).context?.json()) as { erro?: string })?.erro ?? ''; } catch { /* sem corpo */ }
    throw new Error(detalhe || 'Não consegui falar com o assistente. A função já foi publicada no Supabase? (veja docs/assistente.md)');
  }
  const r = data as { texto?: string; erro?: string };
  if (r.erro) throw new Error(r.erro);
  return r.texto ?? '';
}
