import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db, type Cliente, type Material, type Produto } from '../../dados/db.ts';
import { listarMateriais } from '../../dados/materiais.ts';
import { listarProdutos } from '../../dados/produtos.ts';
import { listarExtras } from '../../dados/extras.ts';
import { carregarFormulario, restaurarFormularioPadrao, salvarFormulario } from '../../dados/formulario.ts';
import { disponiveis, listarClientes, salvarCliente } from '../../dados/pedidos.ts';
import { converterEmPedido, listarOrcamentos, reabrirOrcamento, recusarOrcamento, salvarOrcamento } from '../../dados/orcamentos.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import type { ExtraCatalogo } from '../../dominio/extras.ts';
import { acrescimoTotal, escolhasPadrao, gruposPendentes, linhasDeEscolhas, type EscolhaItem, type GrupoOpcoes } from '../../dominio/opcoes.ts';
import { CANAIS, STATUS_ORCAMENTO, orcamentoNovo, totalDoOrcamento, type Orcamento, type StatusOrcamento } from '../../dominio/orcamentos.ts';
import { dataParaTexto, entradaCentavos, type ItemPedido } from '../../dominio/pedidos.ts';
import type { InfoMaterial } from '../../dominio/produtos.ts';
import { PersonalizacaoDoItem } from '../componentes/FormularioItem.tsx';
import { EditorOpcoes, gruposDoForm, gruposParaForm, type GrupoForm } from '../componentes/EditorOpcoes.tsx';
import type { Tela } from '../telas.ts';

type Filtro = 'aberto' | 'todos' | StatusOrcamento;

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}
const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const PEQUENO = { fontSize: 'calc(13px * var(--escala, 1))' } as const;

interface ItemForm {
  produtoId: string;
  personalizado: boolean;
  descricao: string;
  quantidade: string;
  preco: string;
  observacao: string;
  escolhas: EscolhaItem[];
}

export function Orcamentos(p: { ir: (t: Tela) => void }) {
  const [lista, setLista] = useState<Orcamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [extras, setExtras] = useState<ExtraCatalogo[]>([]);
  const [perguntas, setPerguntas] = useState<GrupoOpcoes[]>([]);
  const [disp, setDisp] = useState<Record<string, number>>({});
  const [mult, setMult] = useState({ encadernacao: 1, impressao3d: 1 });
  const [filtro, setFiltro] = useState<Filtro>('aberto');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [aberto, setAberto] = useState<Orcamento | null>(null);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    setLista(await listarOrcamentos());
    setClientes(await listarClientes());
    setProdutos((await listarProdutos()).filter((x) => x.ativo));
    setMateriais(await listarMateriais());
    setExtras(await listarExtras());
    setPerguntas(await carregarFormulario());
    setDisp(await disponiveis());
    const aj = await db.ajustes.get('financeiro');
    setMult({ encadernacao: aj?.multiplicadorEncadernacao ?? 1, impressao3d: aj?.multiplicador3d ?? 1 });
  }
  useEffect(() => { void recarregar(); }, []);
  useEffect(() => {
    if (aberto) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [aberto?.id, aberto === null]);

  const info = useMemo(() => {
    const out: Record<string, InfoMaterial> = {};
    for (const m of materiais) out[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: disp[m.id] ?? 0 };
    return out;
  }, [materiais, disp]);

  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? '—';
  const visiveis = lista
    .filter((o) => (filtro === 'todos' ? true : o.status === filtro))
    .filter((o) => !clienteFiltro || o.clienteId === clienteFiltro);

  return (
    <>
      <h1>Orçamentos</h1>
      <p className="suave">
        A proposta para a cliente: produtos do catálogo (com extras) e/ou produtos 100% personalizados, montados pelas perguntas.
        Fica o histórico de quem pediu e como. O pedido só nasce quando a cliente confirma e/ou paga o sinal.
      </p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setAberto(orcamentoNovo())}>Novo orçamento</button>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        <div className="linha" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {(['aberto', 'aprovado', 'recusado', 'todos'] as Filtro[]).map((f) => (
            <button key={f} className="pilula" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
              {f === 'todos' ? 'Todos' : STATUS_ORCAMENTO[f]}{f !== 'todos' && ` (${lista.filter((o) => o.status === f).length})`}
            </button>
          ))}
          <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} aria-label="Cliente">
            <option value="">Todas as clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      {aberto && (
        <div ref={painelRef}>
          <Detalhe
            key={aberto.id || 'novo'}
            inicial={aberto}
            clientes={clientes} produtos={produtos} extras={extras} perguntas={perguntas} info={info} mult={mult}
            ir={p.ir}
            fechar={() => setAberto(null)}
            aoMudar={async (texto, reabrir) => { setMsg(texto); await recarregar(); setAberto(reabrir ?? null); }}
          />
        </div>
      )}

      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="tabela">
          <thead><tr><th>#</th><th>Cliente</th><th>Pediu por</th><th>Itens</th><th>Total</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {visiveis.map((o) => (
              <tr key={o.id}>
                <td>{o.numero}</td>
                <td>{nomeCliente(o.clienteId)}<div className="suave" style={PEQUENO}>{dataParaTexto(o.criadoEm)}</div></td>
                <td>{o.canal || '—'}</td>
                <td>{o.itens.map((i) => `${i.quantidade}× ${i.descricao}`).join(', ') || '—'}</td>
                <td>{centavosParaTexto(totalDoOrcamento(o))}</td>
                <td>{STATUS_ORCAMENTO[o.status]}{o.pedidoNumero ? ` · pedido #${o.pedidoNumero}` : ''}</td>
                <td><button className="btn" onClick={() => setAberto(o)}>Abrir</button></td>
              </tr>
            ))}
            {visiveis.length === 0 && <tr><td colSpan={7} className="suave">Nenhum orçamento nesta lista.</td></tr>}
          </tbody>
        </table>
      </div>

      <PerguntasDoOrcamento perguntas={perguntas} materiais={materiais.filter((m) => m.ativo)} info={info} aoSalvar={async (t) => { setMsg(t); await recarregar(); }} />
    </>
  );
}

function Detalhe(p: {
  inicial: Orcamento;
  clientes: Cliente[];
  produtos: Produto[];
  extras: ExtraCatalogo[];
  perguntas: GrupoOpcoes[];
  info: Record<string, InfoMaterial>;
  mult: { encadernacao: number; impressao3d: number };
  ir: (t: Tela) => void;
  fechar: () => void;
  aoMudar: (msg: string, reabrir?: Orcamento | null) => Promise<void>;
}) {
  const ini = p.inicial;
  const editavel = ini.status === 'aberto';
  const [clienteId, setClienteId] = useState(ini.clienteId ?? '');
  const [clienteNovo, setClienteNovo] = useState('');
  const [canal, setCanal] = useState(ini.canal);
  const [obs, setObs] = useState(ini.observacoes);
  const [itens, setItens] = useState<ItemForm[]>(
    ini.itens.map((i) => ({
      produtoId: i.produtoId ?? '', personalizado: !!i.personalizado, descricao: i.descricao, quantidade: String(i.quantidade),
      preco: reais(i.precoBaseCentavos ?? i.precoUnitCentavos), observacao: i.observacao, escolhas: i.escolhas ?? [],
    })),
  );
  const [confirmou, setConfirmou] = useState(false);
  const [sinal, setSinal] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const multDe = (pr?: Produto) => (pr?.linha === 'impressao3d' ? p.mult.impressao3d : p.mult.encadernacao);

  function converter(): ItemPedido[] {
    return itens.map((i) => {
      const q = lerNumero(i.quantidade);
      const pr = lerNumero(i.preco || '0');
      const base = Number.isNaN(pr) ? 0 : Math.round(pr * 100);
      return {
        produtoId: i.produtoId || null, descricao: i.descricao.trim(), quantidade: Number.isNaN(q) ? 0 : Math.max(0, Math.round(q)),
        precoUnitCentavos: base + acrescimoTotal(i.escolhas), precoBaseCentavos: base,
        ...(i.personalizado ? { personalizado: true } : {}),
        ...(i.escolhas.length ? { escolhas: i.escolhas } : {}),
        modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: i.observacao.trim(),
      };
    });
  }
  const itensNum = editavel ? converter() : ini.itens;
  const total = totalDoOrcamento({ itens: itensNum });
  const sinalNum = lerNumero(sinal || '0');
  const sinalCentavos = Number.isNaN(sinalNum) ? 0 : Math.round(sinalNum * 100);

  const atualizar = (idx: number, parte: Partial<ItemForm>) => setItens(itens.map((x, k) => (k === idx ? { ...x, ...parte } : x)));
  function escolherProduto(idx: number, id: string) {
    const pr = p.produtos.find((x) => x.id === id);
    if (!pr) return atualizar(idx, { produtoId: '', escolhas: [] });
    const q = Math.max(1, Math.round(lerNumero(itens[idx].quantidade)) || 1);
    atualizar(idx, { produtoId: id, descricao: pr.nome, preco: pr.precoCentavos !== null ? reais(pr.precoCentavos) : itens[idx].preco, escolhas: escolhasPadrao(pr.opcoes ?? [], p.info, multDe(pr), q) });
  }
  const gruposDe = (i: ItemForm): GrupoOpcoes[] => (i.personalizado ? p.perguntas : p.produtos.find((x) => x.id === i.produtoId)?.opcoes ?? []);
  const unidades = (i: ItemForm) => Math.max(1, Math.round(lerNumero(i.quantidade)) || 1);

  function pendencias(): string[] {
    return converter().flatMap((i, k) => {
      const pend = gruposPendentes(gruposDe(itens[k]), i.escolhas ?? [], p.info, i.quantidade);
      return pend.length ? [`“${i.descricao || 'item'}”: ${pend.join(', ')}`] : [];
    });
  }

  async function salvar(nota?: string): Promise<Orcamento | null> {
    setErro('');
    let cid: string | null = clienteId || null;
    if (clienteId === '__novo') {
      const nome = clienteNovo.trim();
      if (!nome) { setErro('Escreva o nome da nova cliente.'); return null; }
      cid = (await salvarCliente({ id: '', nome, contato: '', email: '', origem: canal, observacoes: '', ativo: true, atualizadoEm: '' })).id;
    }
    const lista = converter();
    if (lista.some((i) => !i.descricao)) { setErro('Todo item precisa de uma descrição.'); return null; }
    if (lista.some((i) => i.quantidade < 1)) { setErro('A quantidade de cada item precisa ser 1 ou mais.'); return null; }
    return salvarOrcamento({ ...ini, clienteId: cid, canal, observacoes: obs.trim(), itens: lista }, nota);
  }

  async function aoSalvar() {
    const s = await salvar(ini.id ? 'Orçamento atualizado.' : undefined);
    if (s) await p.aoMudar(`Orçamento #${s.numero} salvo.`, null);
  }

  async function aoGerarPedido() {
    const s = await salvar();
    if (!s) return;
    const pend = pendencias();
    if (pend.length) return setErro(`Ainda falta responder — ${pend.join(' · ')}.`);
    try {
      const ped = await converterEmPedido(s.id, confirmou, sinalCentavos);
      await p.aoMudar(`Orçamento #${s.numero} virou o pedido #${ped.numero}. O material ficou reservado 🌸`, null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o pedido.');
    }
  }

  async function aoRecusar() {
    const s = await salvar();
    if (!s) return;
    await recusarOrcamento(s.id, motivo.trim());
    await p.aoMudar(`Orçamento #${s.numero} encerrado (não fechou).`, null);
  }

  return (
    <div className="cartao">
      <h2>{ini.id ? `Orçamento #${ini.numero}` : 'Novo orçamento'} <span className="etiqueta" style={{ marginLeft: 8 }}>{STATUS_ORCAMENTO[ini.status]}</span></h2>
      {ini.pedidoNumero && <p className="suave" style={{ marginTop: 0 }}>Virou o pedido #{ini.pedidoNumero}. <button className="btn" onClick={() => p.ir('pedidos')}>Ver em Pedidos</button></p>}

      <div className="formgrid">
        <Campo rotulo="Cliente">
          <select value={clienteId} disabled={!editavel} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Escolha…</option>
            {p.clientes.filter((c) => c.ativo || c.id === clienteId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="__novo">+ Cadastrar nova cliente</option>
          </select>
        </Campo>
        {clienteId === '__novo' && <Campo rotulo="Nome da nova cliente"><input type="text" value={clienteNovo} onChange={(e) => setClienteNovo(e.target.value)} /></Campo>}
        <Campo rotulo="Como a cliente pediu">
          <select value={canal} disabled={!editavel} onChange={(e) => setCanal(e.target.value)}>
            {CANAIS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
      </div>

      <h3 style={{ margin: '16px 0 8px' }}>Itens</h3>
      {editavel ? (
        <>
          {itens.map((it, idx) => {
            const pr = p.produtos.find((x) => x.id === it.produtoId);
            const lc = itensNum[idx];
            return (
              <div key={idx} className="cartao" style={{ marginTop: 8, padding: 12 }}>
                <div className="linha"><span className="etiqueta">{it.personalizado ? '100% personalizado' : 'Catálogo'}</span></div>
                <div className="formgrid">
                  {!it.personalizado && (
                    <Campo rotulo="Produto do catálogo">
                      <select value={it.produtoId} onChange={(e) => escolherProduto(idx, e.target.value)}>
                        <option value="">Escolha…</option>
                        {p.produtos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    </Campo>
                  )}
                  <Campo rotulo="Descrição"><input type="text" value={it.descricao} onChange={(e) => atualizar(idx, { descricao: e.target.value })} /></Campo>
                  <Campo rotulo="Quantidade"><input type="text" inputMode="numeric" value={it.quantidade} onChange={(e) => atualizar(idx, { quantidade: e.target.value })} /></Campo>
                  <Campo rotulo={it.personalizado ? 'Valor base (R$)' : 'Preço base (R$)'}><input type="text" inputMode="decimal" value={it.preco} onChange={(e) => atualizar(idx, { preco: e.target.value })} /></Campo>
                </div>
                {(it.personalizado || pr) && (
                  <PersonalizacaoDoItem
                    grupos={gruposDe(it)}
                    extras={pr?.linha === 'impressao3d' ? null : p.extras}
                    escolhas={it.escolhas} unidades={unidades(it)} info={p.info} mult={multDe(pr)}
                    aoMudar={(escolhas) => atualizar(idx, { escolhas })}
                  />
                )}
                <div style={{ marginTop: 8 }}>
                  <Campo rotulo="Observações do item"><input type="text" value={it.observacao} onChange={(e) => atualizar(idx, { observacao: e.target.value })} /></Campo>
                </div>
                <div className="linha" style={{ marginTop: 8 }}>
                  <span className="suave">{it.escolhas.length > 0 && `Cada: ${centavosParaTexto(lc?.precoUnitCentavos ?? 0)} · `}Subtotal: {centavosParaTexto(Math.round((lc?.quantidade ?? 0) * (lc?.precoUnitCentavos ?? 0)))}</span>
                  <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setItens(itens.filter((_, k) => k !== idx))}>Remover item</button>
                </div>
              </div>
            );
          })}
          <div className="linha" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setItens([...itens, { produtoId: '', personalizado: false, descricao: '', quantidade: '1', preco: '', observacao: '', escolhas: [] }])}>+ Item do catálogo</button>
            <button className="btn" onClick={() => setItens([...itens, { produtoId: '', personalizado: true, descricao: 'Produto personalizado', quantidade: '1', preco: '', observacao: '', escolhas: escolhasPadrao(p.perguntas, p.info, p.mult.encadernacao) }])}>+ Item 100% personalizado</button>
          </div>
        </>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela">
            <thead><tr><th>Item</th><th>Qtd</th><th>Cada</th><th>Subtotal</th></tr></thead>
            <tbody>
              {ini.itens.map((i, k) => (
                <tr key={k}>
                  <td>
                    <strong>{i.descricao}</strong> {i.personalizado && <span className="etiqueta">personalizado</span>}
                    {linhasDeEscolhas(i.escolhas ?? []).map((l, n) => <div key={n} className="suave" style={PEQUENO}>{l}</div>)}
                    {i.observacao && <div className="suave" style={PEQUENO}>{i.observacao}</div>}
                  </td>
                  <td>{i.quantidade}</td>
                  <td>{centavosParaTexto(i.precoUnitCentavos)}</td>
                  <td>{centavosParaTexto(Math.round(i.quantidade * i.precoUnitCentavos))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Campo rotulo="Observações"><input type="text" value={obs} disabled={!editavel} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <p style={{ marginTop: 12 }}>Total: <strong>{centavosParaTexto(total)}</strong> <span className="suave">· entrada de 50%: {centavosParaTexto(entradaCentavos(total))}</span></p>

      {erro && <p className="aviso">{erro}</p>}

      {editavel && ini.id && (
        <div className="cartao" style={{ background: 'var(--neutro)' }}>
          <strong>A cliente fechou?</strong>
          <label className="linha" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)} /> A cliente confirmou o orçamento
          </label>
          <div className="linha" style={{ marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
            <Campo rotulo="Sinal recebido (R$, opcional)"><input type="text" inputMode="decimal" value={sinal} onChange={(e) => setSinal(e.target.value)} style={{ width: 120 }} /></Campo>
            <button className="btn" onClick={() => setSinal(reais(entradaCentavos(total)))}>Usar 50%</button>
            <button className="btn primario" onClick={() => void aoGerarPedido()}>Gerar pedido</button>
          </div>
          <p className="suave" style={PEQUENO}>O pedido só é gerado com a confirmação e/ou o sinal. Ao gerar, o material fica reservado e o sinal vira o primeiro pagamento.</p>
          <div className="linha" style={{ marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
            <input type="text" placeholder="Motivo, se não fechou (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: 260 }} />
            <button className="btn" onClick={() => void aoRecusar()}>Não fechou</button>
          </div>
        </div>
      )}

      <div className="linha" style={{ marginTop: 12 }}>
        {editavel && <button className="btn primario" onClick={() => void aoSalvar()}>Salvar orçamento</button>}
        {ini.status === 'recusado' && <button className="btn" onClick={() => void reabrirOrcamento(ini.id).then(() => p.aoMudar(`Orçamento #${ini.numero} reaberto.`, null))}>Reabrir</button>}
        <button className="btn" onClick={p.fechar}>Fechar</button>
      </div>

      {ini.historico.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Histórico</h3>
          {[...ini.historico].reverse().map((h, k) => (
            <div key={k} className="suave" style={PEQUENO}>{dataParaTexto(h.em)} · {h.texto}</div>
          ))}
        </>
      )}
    </div>
  );
}

function PerguntasDoOrcamento(p: { perguntas: GrupoOpcoes[]; materiais: Material[]; info: Record<string, InfoMaterial>; aoSalvar: (t: string) => Promise<void> }) {
  const [grupos, setGrupos] = useState<GrupoForm[] | null>(null);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!grupos) return;
    const g = gruposDoForm(grupos);
    if (g.some((x) => !x.nome || x.opcoes.some((o) => !o.nome))) return setErro('Dê um nome a cada pergunta e a cada opção.');
    setErro('');
    await salvarFormulario(g);
    setGrupos(null);
    await p.aoSalvar('Perguntas do orçamento salvas.');
  }

  return (
    <div className="cartao" style={{ marginTop: 16 }}>
      <h2>Perguntas do orçamento personalizado</h2>
      <p className="suave">
        Já vêm cadastradas: caderno/agenda/planner, tamanho, cor, encadernação (wire-o, disco ou costura, com as cores), capa e as perguntas de personalização.
        Edite, reordene ou acrescente novas no final.
      </p>
      {grupos === null ? (
        <button className="btn" onClick={() => setGrupos(gruposParaForm(p.perguntas))}>Editar perguntas ({p.perguntas.filter((g) => g.tipo !== 'secao').length})</button>
      ) : (
        <>
          <EditorOpcoes catalogo={false} titulo="Perguntas" explicacao="Cada pergunta pode aparecer só em certos casos (ex.: cor do wire-o só se escolher wire-o), ter valor a mais e ligar um material do estoque." grupos={grupos} aoMudar={setGrupos} materiais={p.materiais} info={p.info} />
          {erro && <p className="aviso">{erro}</p>}
          <div className="linha" style={{ marginTop: 12 }}>
            <button className="btn primario" onClick={() => void salvar()}>Salvar perguntas</button>
            <button className="btn" onClick={() => setGrupos(null)}>Cancelar</button>
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Voltar às perguntas padrão? As suas edições nas perguntas serão perdidas.')) void restaurarFormularioPadrao().then(() => { setGrupos(null); return p.aoSalvar('Perguntas padrão restauradas.'); }); }}>Restaurar padrão</button>
          </div>
        </>
      )}
    </div>
  );
}
