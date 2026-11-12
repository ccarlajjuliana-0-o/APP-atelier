import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Material, MovimentacaoRegistro } from '../../dados/db.ts';
import { novoId } from '../../dados/db.ts';
import {
  ajustarSaldo, carregarListaInicial, historico, listarMateriais, registrarCompra, salvarMaterial, saldos, ultimasCompras,
  type Saldo, type UltimaCompra,
} from '../../dados/materiais.ts';
import { listarFornecedores } from '../../dados/fornecedores.ts';
import { CampoFotos, Miniatura } from '../componentes/Fotos.tsx';
import { duracaoDosMateriais, type Duracao } from '../../dados/pedidos.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { abaixoDoMinimo, converterCompra } from '../../dominio/estoque.ts';
import {
  CATEGORIAS, UNIDADES, formatarQuantidade, lerNumero, microParaTexto, type Categoria, type Unidade,
} from '../../dominio/materiais.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';

type Painel =
  | { tipo: 'novo' }
  | { tipo: 'editar' | 'compra' | 'ajuste' | 'historico'; id: string }
  | null;

const ROTULO_MOV: Record<string, string> = {
  entrada: 'Entrada', ajuste: 'Ajuste', reserva: 'Reserva', liberacao: 'Reserva liberada', baixa: 'Uso na produção',
};

const VAZIO: Material = {
  id: '', nome: '', categoria: 'papel', unidade: 'folha', essencial: false, minimo: 0,
  embalagemNome: 'pacote', embalagemQtd: 1, custoMedioMicro: 0, ativo: true, atualizadoEm: '',
};

export function Materiais() {
  const [lista, setLista] = useState<Material[]>([]);
  const [saldo, setSaldo] = useState<Record<string, Saldo>>({});
  const [filtro, setFiltro] = useState<Categoria | 'todas' | 'repor'>('todas');
  const [arquivados, setArquivados] = useState(false);
  const [painel, setPainel] = useState<Painel>(null);
  const [msg, setMsg] = useState('');
  const [ultimas, setUltimas] = useState<Record<string, UltimaCompra>>({});
  const [duracao, setDuracao] = useState<Record<string, Duracao>>({});
  const [fornecedores, setFornecedores] = useState<string[]>([]);
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    setLista(await listarMateriais());
    setSaldo(await saldos());
    setUltimas(await ultimasCompras());
    setDuracao(await duracaoDosMateriais());
    setFornecedores((await listarFornecedores()).filter((f) => f.ativo).map((f) => f.nome));
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const disp = (m: Material) => saldo[m.id]?.disponivel ?? 0;
  const repor = (m: Material) => m.ativo && m.minimo > 0 && abaixoDoMinimo(disp(m), m.minimo);

  const visiveis = useMemo(
    () =>
      lista.filter((m) => (arquivados ? !m.ativo : m.ativo)).filter((m) => {
        if (filtro === 'todas') return true;
        if (filtro === 'repor') return repor(m);
        return m.categoria === filtro;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lista, saldo, filtro, arquivados],
  );
  useEffect(() => {
    if (painel) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [painel]);

  const qtdRepor = lista.filter(repor).length;
  const selecionado = painel && 'id' in painel ? lista.find((m) => m.id === painel.id) : undefined;

  async function iniciar() {
    const n = await carregarListaInicial();
    setMsg(n ? `${n} materiais adicionados. Ajuste nomes, mínimos e embalagens como preferir.` : 'A lista inicial já está cadastrada.');
    await recarregar();
  }

  return (
    <>
      <h1>Materiais</h1>
      <p className="suave">Papéis, capas, acabamentos, tintas e filamentos. O saldo vem das compras e dos ajustes que você registra.</p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setPainel({ tipo: 'novo' })}>Novo material</button>
          <button className="btn" onClick={() => void iniciar()}>Carregar lista inicial</button>
          <label className="linha" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Ver arquivados
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="pilula" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todos</button>
          <button className="pilula" aria-pressed={filtro === 'repor'} onClick={() => setFiltro('repor')}>
            Repor{qtdRepor ? ` (${qtdRepor})` : ''}
          </button>
          {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
            <button key={c} className="pilula" aria-pressed={filtro === c} onClick={() => setFiltro(c)}>{CATEGORIAS[c]}</button>
          ))}
        </div>
      </div>

      {painel && (
        <div ref={painelRef}>
        <Formulario
          key={painel.tipo + ('id' in painel ? painel.id : '')}
          painel={painel}
          material={selecionado}
          fornecedores={fornecedores}
          fechar={() => setPainel(null)}
          aoSalvar={async (texto) => {
            setMsg(texto);
            setPainel(null);
            await recarregar();
          }}
        />
        </div>
      )}

      {lista.length === 0 ? (
        <div className="cartao suave">Nenhum material ainda. Toque em “Carregar lista inicial” para começar com uma sugestão, ou em “Novo material”.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Material</th><th>Disponível</th><th>Mínimo</th><th>Custo médio</th><th>Última compra</th><th /></tr>
            </thead>
            <tbody>
              {visiveis.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="linha" style={{ flexWrap: 'nowrap' }}>
                      <Miniatura foto={m.foto} />
                      <div>
                        <strong>{m.nome}</strong>
                        <div className="suave" style={{ fontSize: 13 }}>
                          {CATEGORIAS[m.categoria]}{m.essencial ? ' · essencial' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {formatarQuantidade(disp(m), m.unidade)}{' '}
                    {repor(m) && <span className="etiqueta" style={{ background: '#F1CDD9', color: '#3E3550' }}>repor</span>}
                    {duracao[m.id]?.dias !== null && duracao[m.id]?.dias !== undefined && (
                      <div className="suave" style={{ fontSize: 12 }}>
                        dura ~{duracao[m.id].dias} dia(s) no seu ritmo · acaba por volta de {dataParaTexto(duracao[m.id].acabaEm)}
                      </div>
                    )}
                  </td>
                  <td>{m.minimo ? formatarQuantidade(m.minimo, m.unidade) : '—'}</td>
                  <td>{m.custoMedioMicro ? `${microParaTexto(m.custoMedioMicro)} / ${UNIDADES[m.unidade].singular}` : 'sem custo ainda'}</td>
                  <td>
                    {ultimas[m.id] ? (
                      <>
                        {centavosParaTexto(ultimas[m.id].valorCentavos)}
                        <div className="suave" style={{ fontSize: 12 }}>
                          {new Date(ultimas[m.id].data).toLocaleDateString('pt-BR')}{ultimas[m.id].fornecedor ? ` · ${ultimas[m.id].fornecedor}` : ''}
                        </div>
                      </>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="linha" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => setPainel({ tipo: 'compra', id: m.id })}>Comprar</button>
                      <button className="btn" onClick={() => setPainel({ tipo: 'ajuste', id: m.id })}>Contar</button>
                      <button className="btn" onClick={() => setPainel({ tipo: 'historico', id: m.id })}>Histórico</button>
                      <button className="btn" onClick={() => setPainel({ tipo: 'editar', id: m.id })}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr><td colSpan={6} className="suave">Nada nesta lista.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

function Formulario(props: {
  painel: NonNullable<Painel>;
  material?: Material;
  fornecedores: string[];
  fechar: () => void;
  aoSalvar: (msg: string) => Promise<void>;
}) {
  const { painel, material, fornecedores, fechar, aoSalvar } = props;

  if (painel.tipo === 'novo' || painel.tipo === 'editar') {
    return <FormMaterial inicial={material ?? { ...VAZIO }} novo={painel.tipo === 'novo'} fechar={fechar} aoSalvar={aoSalvar} />;
  }
  if (!material) return null;
  if (painel.tipo === 'compra') return <FormCompra m={material} fornecedores={fornecedores} fechar={fechar} aoSalvar={aoSalvar} />;
  if (painel.tipo === 'ajuste') return <FormAjuste m={material} fechar={fechar} aoSalvar={aoSalvar} />;
  return <Historico m={material} fechar={fechar} />;
}

function FormMaterial(p: { inicial: Material; novo: boolean; fechar: () => void; aoSalvar: (m: string) => Promise<void> }) {
  const [m, setM] = useState<Material>(p.inicial);
  const [minimo, setMinimo] = useState(String(p.inicial.minimo));
  const [qtd, setQtd] = useState(String(p.inicial.embalagemQtd));
  const [erro, setErro] = useState('');

  async function salvar() {
    const nome = m.nome.trim();
    const min = lerNumero(minimo || '0');
    const q = lerNumero(qtd);
    if (!nome) return setErro('Dê um nome ao material.');
    if (Number.isNaN(min) || min < 0) return setErro('O estoque mínimo precisa ser um número.');
    if (Number.isNaN(q) || q <= 0) return setErro('Informe quantas unidades vêm em cada embalagem.');
    await salvarMaterial({ ...m, id: m.id || novoId(), nome, minimo: min, embalagemQtd: q });
    await p.aoSalvar(p.novo ? `“${nome}” cadastrado.` : `“${nome}” atualizado.`);
  }

  async function alternarArquivo() {
    await salvarMaterial({ ...m, ativo: !m.ativo });
    await p.aoSalvar(m.ativo ? `“${m.nome}” arquivado. Ele sai das listas, mas o histórico fica guardado.` : `“${m.nome}” voltou para a lista.`);
  }

  return (
    <div className="cartao">
      <h2>{p.novo ? 'Novo material' : 'Editar material'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} /></Campo>
        <Campo rotulo="Categoria">
          <select value={m.categoria} onChange={(e) => setM({ ...m, categoria: e.target.value as Categoria })}>
            {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => <option key={c} value={c}>{CATEGORIAS[c]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Controlar em">
          <select value={m.unidade} onChange={(e) => setM({ ...m, unidade: e.target.value as Unidade })}>
            {(Object.keys(UNIDADES) as Unidade[]).map((u) => <option key={u} value={u}>{UNIDADES[u].plural}</option>)}
          </select>
        </Campo>
        <Campo rotulo={`Estoque mínimo (${UNIDADES[m.unidade].plural})`}>
          <input type="text" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        <Campo rotulo="Compra vem em (resma, rolo, caixa…)">
          <input type="text" value={m.embalagemNome} onChange={(e) => setM({ ...m, embalagemNome: e.target.value })} />
        </Campo>
        <Campo rotulo={`${UNIDADES[m.unidade].plural} por ${m.embalagemNome || 'embalagem'}`}>
          <input type="text" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </Campo>
      </div>
      <div style={{ marginTop: 12 }}>
        <CampoFotos fotos={m.foto ? [m.foto] : []} max={1} rotulo="Foto do material" aoMudar={(f) => setM({ ...m, foto: f[0] ?? null })} />
      </div>
      <label className="linha" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={m.essencial} onChange={(e) => setM({ ...m, essencial: e.target.checked })} />
        Essencial: sem ele, o produto não pode ser feito
      </label>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
        {!p.novo && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void alternarArquivo()}>{m.ativo ? 'Arquivar' : 'Desarquivar'}</button>}
      </div>
    </div>
  );
}

function FormCompra(p: { m: Material; fornecedores: string[]; fechar: () => void; aoSalvar: (m: string) => Promise<void> }) {
  const { m } = p;
  const [emb, setEmb] = useState('1');
  const [porEmb, setPorEmb] = useState(String(m.embalagemQtd));
  const [valor, setValor] = useState('');
  const [forn, setForn] = useState('');
  const [erro, setErro] = useState('');

  const n = lerNumero(emb), q = lerNumero(porEmb), v = lerNumero(valor);
  const ok = n > 0 && q > 0 && v >= 0;
  const prev = ok ? converterCompra(n, q, Math.round(v * 100)) : null;

  async function salvar() {
    if (!ok) return setErro('Preencha quantidade, unidades por embalagem e o valor pago (pode ser 0).');
    await registrarCompra(m.id, n, q, Math.round(v * 100), forn.trim());
    await p.aoSalvar(`Compra registrada: ${formatarQuantidade(n * q, m.unidade)} de “${m.nome}”.`);
  }

  return (
    <div className="cartao">
      <h2>Comprar: {m.nome}</h2>
      <div className="formgrid">
        <Campo rotulo={`Quantas ${m.embalagemNome || 'embalagens'}?`}><input type="text" inputMode="decimal" value={emb} onChange={(e) => setEmb(e.target.value)} /></Campo>
        <Campo rotulo={`${UNIDADES[m.unidade].plural} por ${m.embalagemNome || 'embalagem'}`}><input type="text" inputMode="decimal" value={porEmb} onChange={(e) => setPorEmb(e.target.value)} /></Campo>
        <Campo rotulo="Valor total pago (R$)"><input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo rotulo="Fornecedor (opcional)">
          <input type="text" list="lista-fornecedores" value={forn} onChange={(e) => setForn(e.target.value)} />
          <datalist id="lista-fornecedores">{p.fornecedores.map((f) => <option key={f} value={f} />)}</datalist>
        </Campo>
      </div>
      {prev && (
        <p className="suave">
          Entram {formatarQuantidade(prev.quantidade, m.unidade)} no estoque, a {microParaTexto(prev.custoUnitMicro)} por {UNIDADES[m.unidade].singular}
          {' '}({centavosParaTexto(Math.round(v * 100))} no total).
        </p>
      )}
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="btn primario" onClick={() => void salvar()}>Registrar compra</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
      </div>
    </div>
  );
}

function FormAjuste(p: { m: Material; fechar: () => void; aoSalvar: (m: string) => Promise<void> }) {
  const { m } = p;
  const [contagem, setContagem] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  async function salvar() {
    const c = lerNumero(contagem);
    if (Number.isNaN(c) || c < 0) return setErro('Informe quanto você tem agora (um número, pode ser 0).');
    const dif = await ajustarSaldo(m.id, c, motivo.trim());
    await p.aoSalvar(
      dif === 0 ? 'A contagem bate com o estoque. Nada a ajustar.' : `Estoque de “${m.nome}” ajustado em ${dif > 0 ? '+' : ''}${formatarQuantidade(dif, m.unidade)}.`,
    );
  }

  return (
    <div className="cartao">
      <h2>Contar estoque: {m.nome}</h2>
      <p className="suave">Conte o que você tem na prateleira e informe aqui. O app guarda a diferença como um ajuste. Serve também para o saldo inicial.</p>
      <div className="formgrid">
        <Campo rotulo={`Quantas ${UNIDADES[m.unidade].plural} você tem agora?`}><input type="text" inputMode="decimal" value={contagem} onChange={(e) => setContagem(e.target.value)} /></Campo>
        <Campo rotulo="Motivo (opcional)"><input type="text" placeholder="saldo inicial, sobra, perda…" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar contagem</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
      </div>
    </div>
  );
}

function Historico(p: { m: Material; fechar: () => void }) {
  const [movs, setMovs] = useState<MovimentacaoRegistro[]>([]);
  useEffect(() => {
    void historico(p.m.id).then(setMovs);
  }, [p.m.id]);
  return (
    <div className="cartao">
      <h2>Histórico: {p.m.nome}</h2>
      {movs.length === 0 ? (
        <p className="suave">Ainda não há movimentos.</p>
      ) : (
        <ul className="checklist">
          {movs.map((x) => (
            <li key={x.id}>
              <span>{new Date(x.criadoEm).toLocaleDateString('pt-BR')}</span>
              <span>
                {ROTULO_MOV[x.tipo] ?? x.tipo}: {x.quantidade > 0 && x.tipo === 'ajuste' ? '+' : ''}{formatarQuantidade(x.quantidade, p.m.unidade)}
                {x.valorTotalCentavos !== undefined ? ` · ${centavosParaTexto(x.valorTotalCentavos)}` : ''}
                {x.fornecedor ? ` · ${x.fornecedor}` : ''}
                {x.observacao ? ` · ${x.observacao}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn" onClick={p.fechar}>Fechar</button>
    </div>
  );
}
