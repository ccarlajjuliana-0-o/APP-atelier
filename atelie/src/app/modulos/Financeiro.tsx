import { useEffect, useState } from 'react';
import type { Despesa } from '../../dominio/financeiro.ts';
import { equilibrio, fluxoDoMes, totalFixasCentavos, type Ajustes, type FluxoMes } from '../../dominio/financeiro.ts';
import {
  carregarAjustes, dadosDoCaixa, historicoDePedidos, listarDespesas, salvarDespesa, type HistoricoPedidos,
} from '../../dados/financeiro.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { Campo, CampoNumero, hojeISO, mesAtual } from './FinanceiroCampos.tsx';
import { Ajustes as TelaAjustes, Precos } from './FinanceiroPrecos.tsx';

type Aba = 'caixa' | 'despesas' | 'precos' | 'equilibrio' | 'ajustes';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'caixa', nome: 'Caixa do mês' },
  { id: 'despesas', nome: 'Despesas' },
  { id: 'precos', nome: 'Preços' },
  { id: 'equilibrio', nome: 'Ponto de equilíbrio' },
  { id: 'ajustes', nome: 'Ajustes' },
];

export function Financeiro() {
  const [aba, setAba] = useState<Aba>('caixa');
  return (
    <>
      <h1>Financeiro</h1>
      <p className="suave">Quanto entrou, quanto saiu, quanto você precisa vender por mês e quanto cobrar por cada produto.</p>
      <div className="faixa" />
      <div className="cartao">
        <div className="linha">
          {ABAS.map((a) => (
            <button key={a.id} className="pilula" aria-pressed={aba === a.id} onClick={() => setAba(a.id)}>{a.nome}</button>
          ))}
        </div>
      </div>
      {aba === 'caixa' && <Caixa />}
      {aba === 'despesas' && <Despesas />}
      {aba === 'precos' && <Precos irParaAjustes={() => setAba('ajustes')} />}
      {aba === 'equilibrio' && <Equilibrio irParaDespesas={() => setAba('despesas')} />}
      {aba === 'ajustes' && <TelaAjustes />}
    </>
  );
}

function Caixa() {
  const [mes, setMes] = useState(mesAtual());
  const [fluxo, setFluxo] = useState<FluxoMes | null>(null);

  useEffect(() => {
    void (async () => {
      const [c, d] = await Promise.all([dadosDoCaixa(), listarDespesas()]);
      setFluxo(fluxoDoMes(mes, c.pagamentos, c.compras, d));
    })();
  }, [mes]);

  return (
    <>
      <div className="cartao">
        <div className="formgrid">
          <Campo rotulo="Mês"><input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></Campo>
        </div>
        {fluxo && (
          <div className="linha" style={{ gap: 24, marginTop: 14 }}>
            <span>Entrou: <strong>{centavosParaTexto(fluxo.entradas)}</strong></span>
            <span>Saiu: <strong>{centavosParaTexto(fluxo.saidas)}</strong></span>
            <span>Resultado: <strong>{centavosParaTexto(fluxo.resultado)}</strong></span>
          </div>
        )}
        <p className="suave" style={{ fontSize: 13, marginBottom: 0 }}>
          Entradas vêm dos pagamentos registrados nos pedidos. Saídas vêm das compras de material, das despesas avulsas e das despesas fixas do mês. O resultado é o que sobrou em caixa, sem descontar o desgaste das máquinas.
        </p>
      </div>
      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="tabela">
          <thead><tr><th>Data</th><th>O quê</th><th>Entrou</th><th>Saiu</th></tr></thead>
          <tbody>
            {fluxo?.linhas.map((l, k) => (
              <tr key={k}>
                <td>{l.data ? dataParaTexto(l.data) : 'todo mês'}</td>
                <td>{l.descricao}</td>
                <td>{l.tipo === 'entrada' ? centavosParaTexto(l.valorCentavos) : ''}</td>
                <td>{l.tipo === 'saida' ? centavosParaTexto(l.valorCentavos) : ''}</td>
              </tr>
            ))}
            {fluxo && fluxo.linhas.length === 0 && <tr><td colSpan={4} className="suave">Nada lançado neste mês.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Despesas() {
  const [lista, setLista] = useState<Despesa[]>([]);
  const [tipo, setTipo] = useState<'fixa' | 'avulsa'>('fixa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(hojeISO());
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  async function recarregar() {
    setLista(await listarDespesas());
  }
  useEffect(() => {
    void recarregar();
  }, []);

  async function adicionar() {
    setErro('');
    if (!descricao.trim()) return setErro('Descreva a despesa.');
    if (valor === null || valor <= 0) return setErro('Informe um valor maior que zero.');
    await salvarDespesa({ id: '', tipo, descricao: descricao.trim(), valorCentavos: Math.round(valor * 100), data: tipo === 'avulsa' ? data : '', ativo: true, atualizadoEm: '' });
    setMsg(`“${descricao.trim()}” lançada.`);
    setDescricao('');
    setValor(null);
    setVersao(versao + 1); // limpa o campo de valor
    await recarregar();
  }

  const fixas = lista.filter((d) => d.tipo === 'fixa');
  const avulsas = lista.filter((d) => d.tipo === 'avulsa');

  const tabela = (itens: Despesa[], vazio: string) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="tabela">
        <tbody>
          {itens.map((d) => (
            <tr key={d.id} style={d.ativo ? undefined : { opacity: 0.5 }}>
              <td>{d.tipo === 'avulsa' ? dataParaTexto(d.data) : 'todo mês'}</td>
              <td>{d.descricao}</td>
              <td>{centavosParaTexto(d.valorCentavos)}</td>
              <td><div className="linha" style={{ justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => void salvarDespesa({ ...d, ativo: !d.ativo }).then(recarregar)}>{d.ativo ? 'Arquivar' : 'Reativar'}</button>
              </div></td>
            </tr>
          ))}
          {itens.length === 0 && <tr><td className="suave">{vazio}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="cartao">
        <h2>Nova despesa</h2>
        <div className="formgrid">
          <Campo rotulo="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'fixa' | 'avulsa')}>
              <option value="fixa">Fixa: se repete todo mês (internet, assinatura…)</option>
              <option value="avulsa">Avulsa: aconteceu uma vez (fita, embalagem…)</option>
            </select>
          </Campo>
          <Campo rotulo="Descrição"><input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
          <CampoNumero key={versao} rotulo={tipo === 'fixa' ? 'Valor por mês' : 'Valor'} sufixo="R$" valor={valor} aoMudar={setValor} />
          {tipo === 'avulsa' && <Campo rotulo="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>}
        </div>
        {erro && <p className="aviso">{erro}</p>}
        {msg && <p role="status" className="ok">{msg}</p>}
        <div className="linha" style={{ marginTop: 12 }}><button className="btn primario" onClick={() => void adicionar()}>Lançar</button></div>
      </div>
      <div className="cartao">
        <h2>Despesas fixas · {centavosParaTexto(totalFixasCentavos(lista))} por mês</h2>
        {tabela(fixas, 'Nenhuma ainda. Elas entram no caixa de todo mês e no ponto de equilíbrio.')}
      </div>
      <div className="cartao">
        <h2>Despesas avulsas</h2>
        {tabela(avulsas, 'Nenhuma ainda.')}
      </div>
    </>
  );
}

function Equilibrio({ irParaDespesas }: { irParaDespesas: () => void }) {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [hist, setHist] = useState<HistoricoPedidos | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes | null>(null);
  const [previsao, setPrevisao] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setDespesas(await listarDespesas());
      setHist(await historicoDePedidos());
      setAjustes(await carregarAjustes());
    })();
  }, []);

  if (!hist || !ajustes) return null;
  const fixas = totalFixasCentavos(despesas);
  const eq = equilibrio(fixas, hist.ticketMedio, hist.materialMedio, ajustes.taxaMediaPct);

  return (
    <div className="cartao">
      <h2>Quantos pedidos por mês para empatar</h2>
      <p className="suave">
        É o quanto você precisa vender para cobrir as despesas fixas do mês. Usa o ticket médio e o custo de material dos seus pedidos dos últimos 90 dias.
      </p>
      {fixas === 0 && (
        <p className="aviso">
          Você ainda não lançou despesas fixas, então o equilíbrio é zero. <button className="btn" onClick={irParaDespesas}>Lançar despesas</button>
        </p>
      )}
      {hist.pedidos === 0 ? (
        <p className="aviso">Ainda não há pedidos confirmados nos últimos 90 dias para calcular.</p>
      ) : (
        <>
          <ul style={{ lineHeight: 1.8 }}>
            <li>Despesas fixas por mês: <strong>{centavosParaTexto(fixas)}</strong></li>
            <li>Pedidos considerados: {hist.pedidos} · ticket médio {centavosParaTexto(hist.ticketMedio)}</li>
            <li>Material médio por pedido: {centavosParaTexto(hist.materialMedio)}{ajustes.taxaMediaPct > 0 && <> · taxa média de venda {ajustes.taxaMediaPct}%</>}</li>
            <li>Sobra por pedido (contribuição): <strong>{centavosParaTexto(eq.contribuicaoPorPedido)}</strong></li>
          </ul>
          {eq.pedidosNecessarios === null ? (
            <p className="aviso">Cada pedido está sobrando zero ou menos depois do material e das taxas, então não há equilíbrio possível. Revise os preços.</p>
          ) : (
            <p style={{ fontSize: 18 }}>Para empatar: <strong>{eq.pedidosNecessarios} pedido(s) por mês</strong>.</p>
          )}
          <div className="formgrid">
            <CampoNumero rotulo="E se eu vender por mês" sufixo="pedidos" valor={previsao} aoMudar={setPrevisao} />
          </div>
          {previsao !== null && previsao >= 0 && (
            <p>
              Resultado estimado: <strong>{centavosParaTexto(Math.round(previsao * eq.contribuicaoPorPedido) - fixas)}</strong> por mês, antes do desgaste das máquinas e do seu tempo de trabalho.
            </p>
          )}
        </>
      )}
      <p className="suave" style={{ fontSize: 13 }}>
        O custo de material usa o custo médio atual de cada material; materiais sem compra registrada contam como zero e deixam o cálculo otimista demais.
      </p>
    </div>
  );
}
