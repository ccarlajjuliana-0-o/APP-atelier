import { nuvem } from './nuvem.ts';
import { db } from './db.ts';
import { carregarFormulario } from './formulario.ts';
import { listarExtras } from './extras.ts';
import { listarMateriais } from './materiais.ts';
import { disponiveis, listarClientes, salvarCliente } from './pedidos.ts';
import { salvarOrcamento } from './orcamentos.ts';
import { extrasComoGrupo } from '../dominio/extras.ts';
import { acrescimoTotal } from '../dominio/opcoes.ts';
import { orcamentoNovo, type Orcamento } from '../dominio/orcamentos.ts';
import { escolhasDaSolicitacao, montarPublicacao, type EnvioEscolha, type EnvioPublico, type FormularioPublicado } from '../dominio/publico.ts';
import type { InfoMaterial } from '../dominio/produtos.ts';

const FUNCAO = 'orcamento-publico';

// ---------- a dona: publicar, pausar e ver o estado ----------

async function infoDoEstoque(): Promise<Record<string, InfoMaterial>> {
  const [materiais, disp] = await Promise.all([listarMateriais(), disponiveis()]);
  const out: Record<string, InfoMaterial> = {};
  for (const m of materiais) out[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: disp[m.id] ?? 0 };
  return out;
}

/** Publica (ou atualiza) a cópia do formulário que a cliente vê, com o estoque de agora. */
export async function publicarFormulario(titulo: string, boasVindas: string): Promise<FormularioPublicado> {
  if (!nuvem) throw new Error('A nuvem não está ligada neste aparelho.');
  const [grupos, extras, info, aj] = await Promise.all([carregarFormulario(), listarExtras(), infoDoEstoque(), db.ajustes.get('financeiro')]);
  const pub = montarPublicacao(grupos, extras, info, aj?.multiplicadorEncadernacao ?? 1, new Date().toISOString(), titulo.trim() || undefined, boasVindas.trim() || undefined);
  const { error } = await nuvem.from('formulario_publico').upsert({ id: 'atual', ativo: true, dados: pub, publicado_em: pub.publicadoEm });
  if (error) throw new Error(mensagemDoBanco(error.message));
  return pub;
}

export async function pausarFormulario(): Promise<void> {
  if (!nuvem) throw new Error('A nuvem não está ligada neste aparelho.');
  const { error } = await nuvem.from('formulario_publico').update({ ativo: false }).eq('id', 'atual');
  if (error) throw new Error(mensagemDoBanco(error.message));
}

export interface EstadoPublicacao { ativo: boolean; publicadoEm: string; titulo: string; boasVindas: string }

export async function estadoDaPublicacao(): Promise<EstadoPublicacao | null> {
  if (!nuvem) return null;
  const { data, error } = await nuvem.from('formulario_publico').select('ativo, publicado_em, dados').eq('id', 'atual').maybeSingle();
  if (error || !data) return null;
  const d = data.dados as FormularioPublicado;
  return { ativo: !!data.ativo, publicadoEm: data.publicado_em as string, titulo: d?.titulo ?? '', boasVindas: d?.boasVindas ?? '' };
}

function mensagemDoBanco(m: string): string {
  if (/relation .* does not exist|schema cache/i.test(m)) return 'As tabelas do link público ainda não existem no Supabase. Rode o arquivo docs/orcamento-publico.sql no SQL Editor.';
  return m;
}

// ---------- a cliente: abrir e enviar ----------

/** Formulário publicado (sem login). Devolve null se não existe, foi pausado ou o Supabase não responde. */
export async function buscarFormularioPublico(): Promise<FormularioPublicado | null> {
  if (!nuvem) return null;
  const { data, error } = await nuvem.from('formulario_publico').select('dados, ativo').eq('id', 'atual').maybeSingle();
  if (error || !data || !data.ativo) return null;
  return data.dados as FormularioPublicado;
}

export async function enviarSolicitacao(envio: EnvioPublico): Promise<void> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !chave) throw new Error('O envio não está configurado.');
  let resp: Response;
  try {
    resp = await fetch(`${base}/functions/v1/${FUNCAO}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: chave, Authorization: `Bearer ${chave}` },
      body: JSON.stringify(envio),
    });
  } catch {
    throw new Error('Não consegui enviar agora. Confira a internet e tente de novo.');
  }
  if (!resp.ok) {
    let msg = 'Não consegui enviar agora. Tente de novo em instantes.';
    try { msg = (await resp.json()).erro ?? msg; } catch { /* mantém a mensagem padrão */ }
    throw new Error(msg);
  }
}

// ---------- a dona: caixa de solicitações ----------

export interface Solicitacao {
  id: string;
  criadoEm: string;
  nome: string;
  contato: string;
  quantidade: number;
  observacao: string;
  escolhas: EnvioEscolha[];
}

export async function listarSolicitacoes(): Promise<Solicitacao[]> {
  if (!nuvem) return [];
  const { data, error } = await nuvem.from('solicitacoes').select('id, criado_em, nome, contato, dados').eq('importada', false).order('criado_em', { ascending: false }).limit(100);
  if (error) {
    if (/relation .* does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const d = (r.dados ?? {}) as { quantidade?: number; observacao?: string; escolhas?: EnvioEscolha[] };
    return { id: r.id as string, criadoEm: r.criado_em as string, nome: r.nome as string, contato: r.contato as string, quantidade: d.quantidade ?? 1, observacao: d.observacao ?? '', escolhas: Array.isArray(d.escolhas) ? d.escolhas : [] };
  });
}

export async function descartarSolicitacao(id: string): Promise<void> {
  if (!nuvem) return;
  const { error } = await nuvem.from('solicitacoes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

const soNumeros = (t: string) => t.replace(/\D/g, '');
const normalizar = (t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Vira orçamento aberto (canal "Formulário online") e cadastra a cliente se ainda não existir. O preço é recalculado com o estoque e os valores de agora. */
export async function importarSolicitacao(s: Solicitacao): Promise<Orcamento> {
  const [grupos, extras, info, aj, clientes] = await Promise.all([carregarFormulario(), listarExtras(), infoDoEstoque(), db.ajustes.get('financeiro'), listarClientes()]);
  const mult = aj?.multiplicadorEncadernacao ?? 1;
  const todos = [...grupos, ...(extrasComoGrupo(extras).opcoes.length ? [extrasComoGrupo(extras)] : [])];
  const { escolhas, ignoradas } = escolhasDaSolicitacao(todos, s.escolhas, info, mult);

  const ehEmail = s.contato.includes('@');
  const achada = clientes.find((c) => (soNumeros(s.contato).length >= 8 && soNumeros(c.contato) === soNumeros(s.contato))
    || (ehEmail && normalizar(c.email) === normalizar(s.contato)) || normalizar(c.nome) === normalizar(s.nome));
  const cliente = achada ?? await salvarCliente({
    id: '', nome: s.nome.trim(), contato: ehEmail ? '' : s.contato.trim(), email: ehEmail ? s.contato.trim() : '', origem: 'Formulário online', observacoes: '', ativo: true, atualizadoEm: '',
  });

  const quantidade = Math.max(1, Math.round(s.quantidade));
  const orc: Orcamento = {
    ...orcamentoNovo(), clienteId: cliente.id, canal: 'Formulário online',
    itens: [{
      produtoId: null, descricao: 'Produto personalizado (formulário online)', quantidade,
      precoUnitCentavos: acrescimoTotal(escolhas), precoBaseCentavos: 0, personalizado: true, escolhas,
      modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: s.observacao,
    }],
    observacoes: `Pedido recebido pelo link público em ${new Date(s.criadoEm).toLocaleDateString('pt-BR')}. Contato: ${s.contato}.${ignoradas.length ? ` Respostas que não encontrei no formulário atual: ${ignoradas.join(', ')}.` : ''} Falta definir o valor base do produto.`,
  };
  const salvo = await salvarOrcamento(orc);
  if (nuvem) await nuvem.from('solicitacoes').update({ importada: true }).eq('id', s.id);
  return salvo;
}
