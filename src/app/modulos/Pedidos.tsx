import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db, type Cliente, type Material, type MostruarioRegistro, type Pedido, type Produto } from '../../dados/db.ts';
import { listarMateriais } from '../../dados/materiais.ts';
import { listarProdutos } from '../../dados/produtos.ts';
import {
  avancarPedido, cancelarPedido, disponiveis, hojeLocal, listarClientes, listarPedidos, pedidoNovo,
  registrarPagamento, salvarCliente, salvarPedido,
} from '../../dados/pedidos.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { formatarQuantidade, lerNumero } from '../../dominio/materiais.ts';
import {
  ABERTOS, AVANCO, STATUS, TEXTO_PAGAMENTO, TIPOS, atrasado, dataParaTexto, dataPrometida as dataPrometidaDe, entradaCentavos, necessidades,
  pagoCentavos, podeCancelar, prazoPadraoDias, situacaoPagamento, totalCentavos, ENTRADA_PCT,
  type ItemPedido, type StatusPedido,
} from '../../dominio/pedidos.ts';
import type { TipoPedido } from '../../dominio/prazo.ts';
import { resumoProduto, type InfoMaterial } from '../../dominio/produtos.ts';

type Filtro = 'abertos' | 'todos' | StatusPedido;

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [disp, setDisp] = useState<Record<string, number>>({});
  const [mostruario, setMostruario] = useState<MostruarioRegistro[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [aberto, setAberto] = useState<Pedido | null>(null);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);
  const hoje = hojeLocal();

  async function recarregar() {
    setPedidos(await listarPedidos());
    setClientes(await listarClientes());
    setProdutos(await listarProdutos());
    setMateriais(await listarMateriais());
    setDisp(await disponiveis());
    setMostruario((await db.mostruario.toArray()).filter((m) => m.visivel));
  }
  useEffect(() => {
    void recarregar();
  }, []);
  useEffect(() => {
    if (aberto) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [aberto?.id, aberto === null]);

  const nomeCliente = (id: string | null) => clientes.find((c) => c.id === id)?.nome ?? '—';
  const visiveis = pedidos.filter((p) => (filtro === 'todos' ? true : filtro === 'abertos' ? ABERTOS.includes(p.status) : p.status === filtro));
  const contagem = (s: StatusPedido) => pedidos.filter((p) => p.status === s).length;

  const info = useMemo(() => {
    const out: Record<string, InfoMaterial> = {};
    for (const m of materiais) out[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: disp[m.id] ?? 0 };
    return out;
  }, [materiais, disp]);

  return (
    <>
      <h1>Pedidos</h1>
      <p className="suave">
        Do orçamento à entrega. Ao confirmar, o material do pedido fica reservado; ao marcar como pronto, ele sai do estoque. O prazo conta em dias úteis a partir da confirmação.
      </p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setAberto(pedidoNovo(0))}>Novo pedido</button>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="pilula" aria-pressed={filtro === 'abertos'} onClick={() => setFiltro('abertos')}>Em andamento ({pedidos.filter((p) => ABERTOS.includes(p.status)).length})</button>
          {(['orcamento', 'confirmado', 'em_producao', 'pronto', 'entregue', 'cancelado'] as StatusPedido[]).map((s) => (
            <button key={s} className="pilula" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>{STATUS[s]} ({contagem(s)})</button>
          ))}
          <button className="pilula" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</button>
        </div>
      </div>

      {aberto && (
        <div ref={painelRef}>
          <Detalhe
            key={aberto.id || 'novo'}
            inicial={aberto}
            clientes={clientes}
            produtos={produtos}
            materiais={materiais}
            mostruario={mostruario}
            disp={disp}
            info={info}
            fechar={() => setAberto(null)}
            aoMudar={async (texto, reabrir) => {
              setMsg(texto);
              await recarregar();
              setAberto(reabrir ?? null);
            }}
          />
        </div>
      )}

      {pedidos.length === 0 ? (
        <div className="cartao suave">Nenhum pedido ainda. Crie o primeiro em “Novo pedido”. Antes, confira se o produto está em Produtos e se o cliente está em Clientes (ou cadastre o cliente na hora).</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Entrega prometida</th><th>Pagamento</th><th /></tr>
            </thead>
            <tbody>
              {visiveis.map((p) => {
                const total = totalCentavos(p.itens);
                const atraso = atrasado(p.status, p.dataPrometida, hoje);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>#{p.numero}</strong>
                      <div><span className="etiqueta">{STATUS[p.status]}</span></div>
                    </td>
                    <td>{nomeCliente(p.clienteId)}<div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>{TIPOS[p.tipo]}</div></td>
                    <td>
                      {p.itens[0] ? `${p.itens[0].quantidade}× ${p.itens[0].descricao}` : '—'}
                      {p.itens.length > 1 && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>+ {p.itens.length - 1} item(ns)</div>}
                    </td>
                    <td>{centavosParaTexto(total)}</td>
                    <td>
                      {p.dataPrometida ? dataParaTexto(p.dataPrometida) : <span className="suave">após confirmar</span>}
                      {atraso && <div style={{ fontSize: 'calc(12px * var(--escala, 1))', fontWeight: 700 }}>atrasado</div>}
                    </td>
                    <td>
                      {p.status === 'cancelado' ? '—' : TEXTO_PAGAMENTO[situacaoPagamento(total, p.pagamentos)]}
                      {(p.status === 'pronto' || p.status === 'entregue') && pagoCentavos(p.pagamentos) < total && (
                        <div style={{ fontSize: 'calc(12px * var(--escala, 1))', fontWeight: 700 }}>falta receber {centavosParaTexto(total - pagoCentavos(p.pagamentos))}</div>
                      )}
                    </td>
                    <td><div className="linha" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setAberto(p)}>Abrir</button></div></td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && <tr><td colSpan={7} className="suave">Nada nesta lista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface ItemForm {
  produtoId: string; // '' = item avulso
  descricao: string;
  quantidade: string;
  preco: string;
  modeloId: string;
  adesivoId: string;
  observacao: string;
}

function itemVazio(): ItemForm {
  return { produtoId: '', descricao: '', quantidade: '1', preco: '', modeloId: '', adesivoId: '', observacao: '' };
}

function Detalhe(p: {
  inicial: Pedido;
  clientes: Cliente[];
  produtos: Produto[];
  materiais: Material[];
  mostruario: MostruarioRegistro[];
  disp: Record<string, number>;
  info: Record<string, InfoMaterial>;
  fechar: () => void;
  aoMudar: (msg: string, reabrir?: Pedido | null) => Promise<void>;
}) {
  const ini = p.inicial;
  const editavelItens = ini.status === 'orcamento';
  const [clienteId, setClienteId] = useState(ini.clienteId ?? '');
  const [clienteNovo, setClienteNovo] = useState('');
  const [tipo, setTipo] = useState<TipoPedido>(ini.tipo);
  const [prazo, setPrazo] = useState(String(ini.prazoDias));
  const [obs, setObs] = useState(ini.observacoes);
  const [itens, setItens] = useState<ItemForm[]>(
    ini.itens.map((i) => ({
      produtoId: i.produtoId ?? '', descricao: i.descricao, quantidade: String(i.quantidade), preco: reais(i.precoUnitCentavos),
      modeloId: i.modeloId ?? '', adesivoId: i.adesivoId ?? '', observacao: i.observacao,
    })),
  );
  const [erro, setErro] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [confirmaEntrega, setConfirmaEntrega] = useState(false);
  const [valorPag, setValorPag] = useState('');
  const [obsPag, setObsPag] = useState('');

  const modelos = p.mostruario.filter((m) => m.tipo === 'modelo').sort((a, b) => a.ordem - b.ordem);
  const adesivos = p.mostruario.filter((m) => m.tipo === 'adesivo').sort((a, b) => a.ordem - b.ordem);
  const nomeMat = (id: string) => p.materiais.find((m) => m.id === id)?.nome ?? '—';
  const unidadeMat = (id: string) => p.materiais.find((m) => m.id === id)?.unidade ?? 'un';

  function converter(): ItemPedido[] {
    return itens.map((i) => {
      const q = lerNumero(i.quantidade);
      const pr = lerNumero(i.preco || '0');
      return {
        produtoId: i.produtoId || null,
        descricao: i.descricao.trim(),
        quantidade: Number.isNaN(q) ? 0 : Math.max(0, Math.round(q)),
        precoUnitCentavos: Number.isNaN(pr) ? 0 : Math.round(pr * 100),
        modeloId: i.modeloId || null,
        modeloNome: modelos.find((m) => m.id === i.modeloId)?.nome ?? '',
        adesivoId: i.adesivoId || null,
        adesivoNome: adesivos.find((m) => m.id === i.adesivoId)?.nome ?? '',
        observacao: i.observacao.trim(),
      };
    });
  }
  const itensNum = editavelItens ? converter() : ini.itens;
  const total = totalCentavos(itensNum);
  const entrada = entradaCentavos(total);
  const pago = pagoCentavos(ini.pagamentos);
  const situacao = situacaoPagamento(total, ini.pagamentos);

  const receitas = useMemo(() => Object.fromEntries(p.produtos.map((x) => [x.id, x.receita])), [p.produtos]);
  const needs = editavelItens ? necessidades(itensNum, receitas, p.disp) : [];
  const custoMaterial = itensNum.reduce((s, i) => {
    const pr = p.produtos.find((x) => x.id === i.produtoId);
    return pr ? s + resumoProduto(pr.receita, p.info).custoCentavos * i.quantidade : s;
  }, 0);
  const semCusto = itensNum.some((i) => {
    const pr = p.produtos.find((x) => x.id === i.produtoId);
    return pr ? resumoProduto(pr.receita, p.info).semCusto.length > 0 : false;
  });
  const faltas = needs.filter((n) => n.falta > 0 && !n.extra);
  const faltasExtra = needs.filter((n) => n.falta > 0 && n.extra);

  function atualizar(idx: number, parte: Partial<ItemForm>) {
    setItens(itens.map((x, k) => (k === idx ? { ...x, ...parte } : x)));
  }
  function escolherProduto(idx: number, id: string) {
    const pr = p.produtos.find((x) => x.id === id);
    atualizar(idx, pr ? { produtoId: id, descricao: pr.nome, preco: pr.precoCentavos !== null ? reais(pr.precoCentavos) : itens[idx].preco } : { produtoId: '' });
  }
  function mudarTipo(t: TipoPedido) {
    setTipo(t);
    setPrazo(String(prazoPadraoDias(t)));
  }

  /** Grava o que está na tela. Devolve o pedido salvo ou null se algo impede. */
  async function salvar(): Promise<Pedido | null> {
    setErro('');
    let cid = clienteId;
    if (cid === '__novo') {
      const nome = clienteNovo.trim();
      if (!nome) { setErro('Escreva o nome do novo cliente.'); return null; }
      const c = await salvarCliente({ id: '', nome, contato: '', email: '', origem: '', observacoes: '', ativo: true, atualizadoEm: '' });
      cid = c.id;
    }
    if (!cid) { setErro('Escolha o cliente ou cadastre um novo.'); return null; }
    const dias = lerNumero(prazo);
    if (Number.isNaN(dias) || dias < 1) { setErro('O prazo precisa ser de pelo menos 1 dia útil.'); return null; }
    let lista = ini.itens;
    if (editavelItens) {
      lista = converter();
      if (lista.some((i) => !i.descricao)) { setErro('Todo item precisa de uma descrição.'); return null; }
      if (lista.some((i) => i.quantidade < 1)) { setErro('A quantidade de cada item precisa ser 1 ou mais.'); return null; }
    }
    const prazoDias = Math.round(dias);
    return salvarPedido({
      ...ini, clienteId: cid, tipo, prazoDias, observacoes: obs.trim(), itens: lista,
      dataPrometida: ini.confirmadoEm ? dataPrometidaDe(ini.confirmadoEm, prazoDias) : ini.dataPrometida,
    });
  }

  async function aoSalvar() {
    const s = await salvar();
    if (s) await p.aoMudar(`Pedido #${s.numero} salvo.`, null);
  }

  async function aoAvancar() {
    if (ini.status === 'pronto' && pago < total && !confirmaEntrega) {
      setConfirmaEntrega(true);
      return;
    }
    const s = await salvar();
    if (!s) return;
    try {
      const novo = await avancarPedido(s.id);
      const texto: Record<string, string> = {
        confirmado: `Pedido #${novo.numero} confirmado. O material ficou reservado e a entrega está prometida para ${dataParaTexto(novo.dataPrometida)}.`,
        em_producao: `Pedido #${novo.numero} em produção.`,
        pronto: `Pedido #${novo.numero} pronto. O material foi baixado do estoque.`,
        entregue: `Pedido #${novo.numero} entregue.`,
      };
      await p.aoMudar(texto[novo.status] ?? 'Pedido atualizado.', null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível avançar o pedido.');
    }
  }

  async function aoCancelar() {
    try {
      await cancelarPedido(ini.id);
      await p.aoMudar(`Pedido #${ini.numero} cancelado. O material reservado foi liberado.`, null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cancelar.');
    }
  }

  async function aoPagar() {
    const v = lerNumero(valorPag || reais(Math.max(0, (pago < entrada ? entrada : total) - pago)));
    if (Number.isNaN(v) || v <= 0) return setErro('Informe o valor recebido.');
    const novo = await registrarPagamento(ini.id, { data: hojeLocal(), valorCentavos: Math.round(v * 100), observacao: obsPag.trim() });
    setValorPag('');
    setObsPag('');
    setConfirmaEntrega(false);
    await p.aoMudar(`Pagamento de ${centavosParaTexto(Math.round(v * 100))} registrado no pedido #${novo.numero}.`, novo);
  }

  const avanco = AVANCO[ini.status];
  const bloqueado = ini.status === 'entregue' || ini.status === 'cancelado';

  return (
    <div className="cartao">
      <h2>
        {ini.id ? `Pedido #${ini.numero}` : 'Novo pedido'} <span className="etiqueta" style={{ marginLeft: 8 }}>{STATUS[ini.status]}</span>
      </h2>

      <div className="formgrid">
        <Campo rotulo="Cliente">
          <select value={clienteId} disabled={bloqueado} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Escolha…</option>
            {p.clientes.filter((c) => c.ativo || c.id === clienteId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="__novo">+ Cadastrar novo cliente</option>
          </select>
        </Campo>
        {clienteId === '__novo' && (
          <Campo rotulo="Nome do novo cliente"><input type="text" value={clienteNovo} onChange={(e) => setClienteNovo(e.target.value)} /></Campo>
        )}
        <Campo rotulo="Tipo de pedido">
          <select value={tipo} disabled={bloqueado || ini.status !== 'orcamento'} onChange={(e) => mudarTipo(e.target.value as TipoPedido)}>
            {(Object.keys(TIPOS) as TipoPedido[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Prazo (dias úteis, a partir da confirmação)">
          <input type="text" inputMode="numeric" value={prazo} disabled={bloqueado} onChange={(e) => setPrazo(e.target.value)} />
        </Campo>
      </div>
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))', marginTop: 6 }}>
        Personalizado: 10 a 20 dias úteis · Catálogo: 3 a 7. O app sugere o maior prazo; ajuste se for combinar outro.
        {ini.dataPrometida && <> Entrega prometida: <strong>{dataParaTexto(ini.dataPrometida)}</strong>.</>}
      </p>

      <h3 style={{ margin: '16px 0 8px' }}>Itens</h3>
      {editavelItens ? (
        <>
          {itens.map((it, idx) => (
            <div key={idx} className="cartao" style={{ marginTop: 8, padding: 12 }}>
              <div className="formgrid">
                <Campo rotulo="Produto">
                  <select value={it.produtoId} onChange={(e) => escolherProduto(idx, e.target.value)}>
                    <option value="">Item avulso (sem receita)</option>
                    {p.produtos.filter((x) => x.ativo || x.id === it.produtoId).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Descrição"><input type="text" value={it.descricao} onChange={(e) => atualizar(idx, { descricao: e.target.value })} /></Campo>
                <Campo rotulo="Quantidade"><input type="text" inputMode="numeric" value={it.quantidade} onChange={(e) => atualizar(idx, { quantidade: e.target.value })} /></Campo>
                <Campo rotulo="Preço unitário (R$)"><input type="text" inputMode="decimal" value={it.preco} onChange={(e) => atualizar(idx, { preco: e.target.value })} /></Campo>
                <Campo rotulo="Modelo do mostruário">
                  <select value={it.modeloId} onChange={(e) => atualizar(idx, { modeloId: e.target.value })}>
                    <option value="">—</option>
                    {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Adesivos do mostruário">
                  <select value={it.adesivoId} onChange={(e) => atualizar(idx, { adesivoId: e.target.value })}>
                    <option value="">—</option>
                    {adesivos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </Campo>
              </div>
              <div style={{ marginTop: 8 }}>
                <Campo rotulo="Personalização (nome na capa, cores, detalhes)">
                  <input type="text" value={it.observacao} onChange={(e) => atualizar(idx, { observacao: e.target.value })} />
                </Campo>
              </div>
              <div className="linha" style={{ marginTop: 8 }}>
                <span className="suave">Subtotal: {centavosParaTexto(Math.round((Number.isNaN(lerNumero(it.quantidade)) ? 0 : Math.round(lerNumero(it.quantidade))) * (Number.isNaN(lerNumero(it.preco || '0')) ? 0 : Math.round(lerNumero(it.preco || '0') * 100))))}</span>
                <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setItens(itens.filter((_, k) => k !== idx))}>Remover item</button>
              </div>
            </div>
          ))}
          <div className="linha" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => setItens([...itens, itemVazio()])}>+ Adicionar item</button>
          </div>
        </>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela">
            <thead><tr><th>Item</th><th>Qtd</th><th>Preço</th><th>Subtotal</th></tr></thead>
            <tbody>
              {ini.itens.map((i, k) => (
                <tr key={k}>
                  <td>
                    <strong>{i.descricao}</strong>
                    {(i.modeloNome || i.adesivoNome) && <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{[i.modeloNome && `modelo: ${i.modeloNome}`, i.adesivoNome && `adesivos: ${i.adesivoNome}`].filter(Boolean).join(' · ')}</div>}
                    {i.observacao && <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{i.observacao}</div>}
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

      <div className="linha" style={{ marginTop: 14, gap: 18 }}>
        <span>Total: <strong>{centavosParaTexto(total)}</strong></span>
        <span className="suave">Entrada de {ENTRADA_PCT}%: {centavosParaTexto(entrada)}</span>
        {custoMaterial > 0 && (
          <span className="suave">
            Material estimado: {centavosParaTexto(custoMaterial)} · sobra {centavosParaTexto(total - custoMaterial)} antes de tempo, desgaste e taxas
          </span>
        )}
      </div>
      {editavelItens && semCusto && <p className="aviso" style={{ marginTop: 8 }}>Alguns materiais ainda não têm custo (falta registrar a compra), então o custo estimado está menor que o real.</p>}

      {editavelItens && needs.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Material que o pedido usa</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabela">
              <thead><tr><th>Material</th><th>Precisa</th><th>Disponível</th><th /></tr></thead>
              <tbody>
                {needs.map((n) => (
                  <tr key={n.materialId}>
                    <td>{nomeMat(n.materialId)}{n.extra && <span className="suave"> (extra)</span>}</td>
                    <td>{formatarQuantidade(n.necessario, unidadeMat(n.materialId))}</td>
                    <td>{formatarQuantidade(Math.max(0, p.disp[n.materialId] ?? 0), unidadeMat(n.materialId))}</td>
                    <td>{n.falta > 0 ? <strong>faltam {formatarQuantidade(n.falta, unidadeMat(n.materialId))}</strong> : <span className="ok">ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {faltas.length > 0 && (
            <p className="aviso" style={{ marginTop: 8 }}>
              Falta material para este pedido. Você pode confirmar mesmo assim: o material fica reservado e o saldo disponível fica negativo até você comprar.
            </p>
          )}
          {faltasExtra.length > 0 && faltas.length === 0 && (
            <p className="aviso" style={{ marginTop: 8 }}>Só faltam itens extras. O pedido segue sem eles quando acabarem.</p>
          )}
        </>
      )}

      {!editavelItens && ini.reservas.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Material reservado</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {ini.reservas.map((r) => <li key={r.materialId}>{nomeMat(r.materialId)}: {formatarQuantidade(r.quantidade, unidadeMat(r.materialId))}</li>)}
          </ul>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <Campo rotulo="Observações do pedido">
          <input type="text" value={obs} disabled={ini.status === 'cancelado'} onChange={(e) => setObs(e.target.value)} />
        </Campo>
      </div>

      {ini.id && ini.status !== 'orcamento' && ini.status !== 'cancelado' && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Pagamentos</h3>
          <p className="suave" style={{ margin: 0 }}>
            {TEXTO_PAGAMENTO[situacao]} · recebido {centavosParaTexto(pago)} de {centavosParaTexto(total)}
            {pago < total && <> · falta {centavosParaTexto(total - pago)}</>}
          </p>
          {ini.pagamentos.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {ini.pagamentos.map((g, k) => <li key={k}>{dataParaTexto(g.data)} · {centavosParaTexto(g.valorCentavos)}{g.observacao ? ` · ${g.observacao}` : ''}</li>)}
            </ul>
          )}
          {pago < total && (
            <div className="formgrid" style={{ marginTop: 8 }}>
              <Campo rotulo="Valor recebido (R$)">
                <input type="text" inputMode="decimal" placeholder={reais(Math.max(0, (pago < entrada ? entrada : total) - pago))} value={valorPag} onChange={(e) => setValorPag(e.target.value)} />
              </Campo>
              <Campo rotulo="Observação (Pix, dinheiro…)"><input type="text" value={obsPag} onChange={(e) => setObsPag(e.target.value)} /></Campo>
              <div className="linha" style={{ alignItems: 'flex-end' }}><button className="btn" onClick={() => void aoPagar()}>Registrar pagamento</button></div>
            </div>
          )}
          {(ini.status === 'confirmado') && pago < entrada && (
            <p className="aviso" style={{ marginTop: 8 }}>A entrada de {ENTRADA_PCT}% ({centavosParaTexto(entrada)}) ainda não foi recebida.</p>
          )}
        </>
      )}

      {erro && <p className="aviso" style={{ marginTop: 10 }}>{erro}</p>}
      {confirmaEntrega && ini.status === 'pronto' && (
        <p className="aviso" style={{ marginTop: 10 }}>
          Ainda falta receber {centavosParaTexto(total - pago)} deste pedido. Se entregar agora, ele continua aparecendo com “falta receber” na lista. Clique em “Entregar mesmo assim” para seguir, ou registre o pagamento antes.
        </p>
      )}

      <div className="linha" style={{ marginTop: 16 }}>
        {!bloqueado && <button className="btn" onClick={() => void aoSalvar()}>Salvar</button>}
        {avanco && (
          <button className="btn primario" disabled={ini.status === 'orcamento' && itens.length === 0} onClick={() => void aoAvancar()}>
            {confirmaEntrega && ini.status === 'pronto' ? 'Entregar mesmo assim' : avanco.botao}
          </button>
        )}
        <button className="btn" onClick={p.fechar}>Fechar</button>
        {ini.id && podeCancelar(ini.status) && (
          cancelando ? (
            <span className="linha" style={{ marginLeft: 'auto' }}>
              <span className="suave">Cancelar este pedido?</span>
              <button className="btn" onClick={() => void aoCancelar()}>Sim, cancelar</button>
              <button className="btn" onClick={() => setCancelando(false)}>Não</button>
            </span>
          ) : (
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCancelando(true)}>Cancelar pedido</button>
          )
        )}
      </div>
    </div>
  );
}

