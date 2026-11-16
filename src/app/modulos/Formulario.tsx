import { useEffect, useMemo, useState } from 'react';
import { db, type Cliente, type Material, type Produto } from '../../dados/db.ts';
import { listarMateriais } from '../../dados/materiais.ts';
import { listarProdutos } from '../../dados/produtos.ts';
import { disponiveis, listarClientes, pedidoNovo, salvarCliente, salvarPedido } from '../../dados/pedidos.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import { acrescimoTotal, escolhasPadrao, gruposPendentes, type EscolhaItem } from '../../dominio/opcoes.ts';
import type { InfoMaterial } from '../../dominio/produtos.ts';
import { FormularioItem } from '../componentes/FormularioItem.tsx';

export function Formulario() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [disp, setDisp] = useState<Record<string, number>>({});
  const [mult, setMult] = useState({ encadernacao: 1, impressao3d: 1 });
  const [produtoId, setProdutoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteNovo, setClienteNovo] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [escolhas, setEscolhas] = useState<EscolhaItem[]>([]);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  async function carregar() {
    setProdutos((await listarProdutos()).filter((p) => p.ativo && (p.opcoes?.length ?? 0) > 0));
    setClientes(await listarClientes());
    setMateriais(await listarMateriais());
    setDisp(await disponiveis());
    const aj = await db.ajustes.get('financeiro');
    setMult({ encadernacao: aj?.multiplicadorEncadernacao ?? 1, impressao3d: aj?.multiplicador3d ?? 1 });
  }
  useEffect(() => { void carregar(); }, []);

  const info = useMemo(() => {
    const out: Record<string, InfoMaterial> = {};
    for (const m of materiais) out[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: disp[m.id] ?? 0 };
    return out;
  }, [materiais, disp]);

  const produto = produtos.find((x) => x.id === produtoId);
  const m = produto?.linha === 'impressao3d' ? mult.impressao3d : mult.encadernacao;
  const q = Math.max(1, Math.round(lerNumero(quantidade)) || 1);
  const base = produto?.precoCentavos ?? 0;
  const unit = base + acrescimoTotal(escolhas);

  function escolher(id: string) {
    const pr = produtos.find((x) => x.id === id);
    setProdutoId(id);
    setEscolhas(pr ? escolhasPadrao(pr.opcoes ?? [], info, pr.linha === 'impressao3d' ? mult.impressao3d : mult.encadernacao, q) : []);
    setErro(''); setMsg('');
  }

  async function criar() {
    setErro(''); setMsg('');
    if (!produto) return setErro('Escolha o produto.');
    const pend = gruposPendentes(produto.opcoes ?? [], escolhas, info, q);
    if (pend.length) return setErro(`Falta responder: ${pend.join(', ')}.`);
    let cid: string | null = clienteId || null;
    if (clienteId === '__novo') {
      const nome = clienteNovo.trim();
      if (!nome) return setErro('Escreva o nome da nova cliente.');
      cid = (await salvarCliente({ id: '', nome, contato: '', email: '', origem: '', observacoes: '', ativo: true, atualizadoEm: '' })).id;
    }
    const ped = await salvarPedido({
      ...pedidoNovo(0), clienteId: cid, observacoes: obs.trim(),
      itens: [{
        produtoId: produto.id, descricao: produto.nome, quantidade: q, precoUnitCentavos: unit, precoBaseCentavos: base,
        modeloId: null, modeloNome: '', adesivoId: null, adesivoNome: '', observacao: '', escolhas,
      }],
    });
    setMsg(`Orçamento #${ped.numero} criado em Pedidos${cid ? '' : ' (escolha a cliente por lá)'} 🌸`);
    setEscolhas(escolhasPadrao(produto.opcoes ?? [], info, m, q));
    setObs(''); setClienteNovo(''); setClienteId('');
    await carregar();
  }

  return (
    <>
      <h1>Formulário personalizado</h1>
      <p className="suave">
        Preencha com a cliente ao lado: ao final vira um orçamento em Pedidos, com o material já considerado. Só aparecem produtos que têm perguntas
        (cadastre em Produtos › Formulário personalizado).
      </p>
      <div className="faixa" />
      {msg && <p className="aviso">{msg}</p>}
      <div className="cartao">
        <div className="formgrid">
          <label className="campo"><span>Produto</span>
            <select value={produtoId} onChange={(e) => escolher(e.target.value)}>
              <option value="">Escolha…</option>
              {produtos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          <label className="campo"><span>Cliente</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Definir depois</option>
              {clientes.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__novo">+ Nova cliente…</option>
            </select>
          </label>
          {clienteId === '__novo' && (
            <label className="campo"><span>Nome da nova cliente</span><input type="text" value={clienteNovo} onChange={(e) => setClienteNovo(e.target.value)} /></label>
          )}
          <label className="campo"><span>Quantidade</span><input type="text" inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
        </div>

        {produto && (
          <>
            <FormularioItem grupos={produto.opcoes ?? []} escolhas={escolhas} unidades={q} info={info} mult={m} aoMudar={setEscolhas} />
            <label className="campo" style={{ marginTop: 12 }}><span>Observações do pedido</span>
              <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} />
            </label>
            <div className="linha" style={{ marginTop: 12, gap: 16, flexWrap: 'wrap' }}>
              <span>Base: {centavosParaTexto(base)}</span>
              <span>Opções: +{centavosParaTexto(acrescimoTotal(escolhas))}</span>
              <strong>Cada: {centavosParaTexto(unit)} · Total: {centavosParaTexto(unit * q)}</strong>
            </div>
            {base === 0 && <p className="suave">Este produto ainda não tem preço de venda; o total mostra só as opções (ajuste no pedido).</p>}
            {erro && <p className="aviso">{erro}</p>}
            <div className="linha" style={{ marginTop: 12 }}>
              <button className="btn primario" onClick={() => void criar()}>Criar orçamento</button>
              <button className="btn" onClick={() => escolher(produto.id)}>Limpar respostas</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
