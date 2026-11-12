import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Material, Produto } from '../../dados/db.ts';
import { listarMateriais, saldos } from '../../dados/materiais.ts';
import { CampoFotos, Miniatura } from '../componentes/Fotos.tsx';
import { duplicarProduto, listarProdutos, salvarProduto } from '../../dados/produtos.ts';
import { CATEGORIAS, UNIDADES, lerNumero, microParaTexto } from '../../dominio/materiais.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { LINHAS, resumoProduto, type InfoMaterial, type ItemProduto, type Linha, type Perfil3D } from '../../dominio/produtos.ts';

const PERFIL_PADRAO: Perfil3D = {
  paredes: 3, preenchimentoTipo: 'grade', preenchimentoPct: 15, alturaCamadaMm: 0.2, cor: 'mono', tempoImpressaoMin: 0, observacoes: '',
};
const TIPOS_PREENCHIMENTO = ['grade', 'giroide', 'linhas', 'cúbico', 'triangular', 'outro'];

function novoProduto(): Produto {
  return {
    id: '', nome: '', linha: 'encadernacao', categoria: '', tempoTrabalhoMin: 0, precoCentavos: null,
    receita: [], perfil3d: null, ativo: true, atualizadoEm: '',
  };
}

export function Produtos() {
  const [lista, setLista] = useState<Produto[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [saldo, setSaldo] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<Linha | 'todas' | 'extra'>('todas');
  const [arquivados, setArquivados] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    setLista(await listarProdutos());
    setMateriais(await listarMateriais());
    const s = await saldos();
    setSaldo(Object.fromEntries(Object.entries(s).map(([id, v]) => [id, v.disponivel])));
  }
  useEffect(() => {
    void recarregar();
  }, []);

  useEffect(() => {
    if (editando) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editando?.id, editando === null]);

  const info = useMemo(() => {
    const out: Record<string, InfoMaterial> = {};
    for (const m of materiais) out[m.id] = { nome: m.nome, custoMicro: m.custoMedioMicro, disponivel: saldo[m.id] ?? 0 };
    return out;
  }, [materiais, saldo]);

  const linhas = lista
    .filter((p) => (arquivados ? !p.ativo : p.ativo))
    .map((p) => ({ p, r: resumoProduto(p.receita, info) }))
    .filter(({ p, r }) => (filtro === 'todas' ? true : filtro === 'extra' ? r.extrasEmFalta.length > 0 : p.linha === filtro));

  const nomeMat = (id: string | null) => (id ? info[id]?.nome ?? '—' : '—');

  return (
    <>
      <h1>Produtos</h1>
      <p className="suave">Cada produto tem uma receita: os materiais que ele usa. Com ela o app calcula o custo de material e quantos dá para fazer com o estoque de agora.</p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setEditando(novoProduto())}>Novo produto</button>
          <label className="linha" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Ver arquivados
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="pilula" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todos</button>
          <button className="pilula" aria-pressed={filtro === 'encadernacao'} onClick={() => setFiltro('encadernacao')}>Encadernação</button>
          <button className="pilula" aria-pressed={filtro === 'impressao3d'} onClick={() => setFiltro('impressao3d')}>Impressão 3D</button>
          <button className="pilula" aria-pressed={filtro === 'extra'} onClick={() => setFiltro('extra')}>Com extra em falta</button>
        </div>
      </div>

      {editando && (
        <div ref={painelRef}>
          <FormProduto
            key={editando.id || 'novo'}
            inicial={editando}
            materiais={materiais.filter((m) => m.ativo)}
            info={info}
            fechar={() => setEditando(null)}
            aoSalvar={async (texto) => {
              setMsg(texto);
              setEditando(null);
              await recarregar();
            }}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <div className="cartao suave">Nenhum produto ainda. Cadastre o primeiro em “Novo produto”. Antes, confira se os materiais da receita já estão em Materiais.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Produto</th><th>Preço atual</th><th>Custo de material</th><th>Dá para produzir</th><th>Material que limita</th><th /></tr>
            </thead>
            <tbody>
              {linhas.map(({ p, r }) => (
                <tr key={p.id}>
                  <td>
                    <div className="linha" style={{ flexWrap: 'nowrap' }}>
                      <Miniatura foto={p.fotos?.[0]} />
                      <div>
                        <strong>{p.nome}</strong>
                        <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{LINHAS[p.linha]}{p.categoria ? ` · ${p.categoria}` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.precoCentavos !== null ? centavosParaTexto(p.precoCentavos) : '—'}</td>
                  <td>
                    {p.receita.length ? centavosParaTexto(r.custoCentavos) : '—'}
                    {r.semCusto.length > 0 && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>faltam custos de {r.semCusto.length} material(is)</div>}
                  </td>
                  <td>{r.quantidade === null ? '—' : `${r.quantidade} un`}</td>
                  <td>
                    {nomeMat(r.limitante)}
                    {r.extrasEmFalta.length > 0 && (
                      <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>extra em falta: {r.extrasEmFalta.map(nomeMat).join(', ')}</div>
                    )}
                  </td>
                  <td>
                    <div className="linha" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn" onClick={() => setEditando(p)}>Abrir</button>
                      <button className="btn" onClick={() => void duplicarProduto(p).then(async (c) => { setMsg(`“${c.nome}” criado.`); await recarregar(); })}>Duplicar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && <tr><td colSpan={6} className="suave">Nada nesta lista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>
        O custo mostrado considera só os materiais da receita. Tempo de trabalho, tinta, desgaste das máquinas e o desperdício geral entram na precificação.
      </p>
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

interface LinhaForm {
  materialId: string;
  quantidade: string;
  desperdicio: string;
  extra: boolean;
}

function FormProduto(p: {
  inicial: Produto;
  materiais: Material[];
  info: Record<string, InfoMaterial>;
  fechar: () => void;
  aoSalvar: (msg: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(p.inicial.nome);
  const [linha, setLinha] = useState<Linha>(p.inicial.linha);
  const [categoria, setCategoria] = useState(p.inicial.categoria);
  const [tempo, setTempo] = useState(p.inicial.tempoTrabalhoMin ? String(p.inicial.tempoTrabalhoMin) : '');
  const [preco, setPreco] = useState(p.inicial.precoCentavos !== null ? (p.inicial.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  const [itens, setItens] = useState<LinhaForm[]>(
    p.inicial.receita.map((i) => ({ materialId: i.materialId, quantidade: String(i.quantidade).replace('.', ','), desperdicio: i.desperdicioPct ? String(i.desperdicioPct).replace('.', ',') : '', extra: i.extra })),
  );
  const [perfil, setPerfil] = useState<Perfil3D>(p.inicial.perfil3d ?? PERFIL_PADRAO);
  const [fotos, setFotos] = useState<Blob[]>(p.inicial.fotos ?? []);
  const [erro, setErro] = useState('');

  const porId = Object.fromEntries(p.materiais.map((m) => [m.id, m]));
  // materiais arquivados que ainda estão na receita continuam aparecendo
  const infoDe = (id: string) => p.info[id];

  const itensNum: ItemProduto[] = itens.map((i) => ({
    materialId: i.materialId,
    quantidade: Number.isNaN(lerNumero(i.quantidade)) ? 0 : lerNumero(i.quantidade),
    desperdicioPct: Number.isNaN(lerNumero(i.desperdicio || '0')) ? 0 : lerNumero(i.desperdicio || '0'),
    extra: i.extra,
  }));
  const r = resumoProduto(itensNum, p.info);
  const porLinha = Object.fromEntries(r.linhas.map((l) => [l.materialId, l]));
  const livres = p.materiais.filter((m) => !itens.some((i) => i.materialId === m.id));

  function atualizar(idx: number, parte: Partial<LinhaForm>) {
    setItens(itens.map((x, k) => (k === idx ? { ...x, ...parte } : x)));
  }

  async function salvar(arquivar?: boolean) {
    const n = nome.trim();
    if (!n) return setErro('Dê um nome ao produto.');
    const t = lerNumero(tempo || '0');
    const pc = preco.trim() ? lerNumero(preco) : null;
    if (Number.isNaN(t) || t < 0) return setErro('O tempo de trabalho precisa ser um número de minutos.');
    if (pc !== null && (Number.isNaN(pc) || pc < 0)) return setErro('O preço de venda precisa ser um valor em reais.');
    for (const i of itensNum) {
      if (!(i.quantidade > 0)) return setErro(`Informe a quantidade de “${infoDe(i.materialId)?.nome ?? 'material'}” por unidade (maior que zero).`);
    }
    const salvo = await salvarProduto({
      ...p.inicial,
      nome: n, linha, categoria: categoria.trim(), tempoTrabalhoMin: t,
      precoCentavos: pc === null ? null : Math.round(pc * 100),
      receita: itensNum,
      perfil3d: linha === 'impressao3d' ? perfil : null,
      fotos,
      ativo: arquivar === undefined ? p.inicial.ativo !== false : !arquivar,
    });
    await p.aoSalvar(arquivar === true ? `“${salvo.nome}” arquivado.` : arquivar === false ? `“${salvo.nome}” voltou para a lista.` : `“${salvo.nome}” salvo.`);
  }

  return (
    <div className="cartao">
      <h2>{p.inicial.id ? 'Produto' : 'Novo produto'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <Campo rotulo="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value as Linha)}>
            {(Object.keys(LINHAS) as Linha[]).map((l) => <option key={l} value={l}>{LINHAS[l]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Categoria (planner, caderno, marcador…)"><input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></Campo>
        <Campo rotulo="Tempo de trabalho (min)"><input type="text" inputMode="decimal" value={tempo} onChange={(e) => setTempo(e.target.value)} /></Campo>
        <Campo rotulo="Preço de venda atual (R$, opcional)"><input type="text" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} /></Campo>
      </div>

      <div style={{ marginTop: 12 }}>
        <CampoFotos fotos={fotos} max={4} rotulo="Fotos do produto (até 4)" aoMudar={setFotos} />
      </div>

      <h2 style={{ marginTop: 18 }}>Receita (por unidade)</h2>
      {itens.length === 0 ? (
        <p className="suave">Adicione os materiais que uma unidade do produto usa.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Material</th><th>Quantidade</th><th>Perda %</th><th>Extra</th><th>Custo</th><th>Em estoque</th><th>Dá para</th><th /></tr>
            </thead>
            <tbody>
              {itens.map((i, idx) => {
                const m = porId[i.materialId];
                const inf = infoDe(i.materialId);
                const l = porLinha[i.materialId];
                const limita = r.limitante === i.materialId;
                return (
                  <tr key={i.materialId}>
                    <td>
                      <strong>{inf?.nome ?? 'Material removido'}</strong>
                      {m && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>{CATEGORIAS[m.categoria]}</div>}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <input type="text" inputMode="decimal" value={i.quantidade} onChange={(e) => atualizar(idx, { quantidade: e.target.value })} style={{ width: 80 }} />{' '}
                      <span className="suave">{m ? UNIDADES[m.unidade].plural : ''}</span>
                    </td>
                    <td><input type="text" inputMode="decimal" value={i.desperdicio} placeholder="0" onChange={(e) => atualizar(idx, { desperdicio: e.target.value })} style={{ width: 64 }} /></td>
                    <td><input type="checkbox" checked={i.extra} onChange={(e) => atualizar(idx, { extra: e.target.checked })} aria-label="Extra" /></td>
                    <td>{l ? (inf && inf.custoMicro ? microParaTexto(l.custoMicro) : 'sem custo') : '—'}</td>
                    <td>{inf ? inf.disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'}</td>
                    <td>
                      {l ? l.pode : '—'}{' '}
                      {limita && <span className="etiqueta">limita</span>}
                      {l && l.emFalta && i.extra && <span className="etiqueta" style={{ background: '#F1CDD9', color: '#3E3550' }}>em falta</span>}
                    </td>
                    <td><button className="btn" onClick={() => setItens(itens.filter((_, k) => k !== idx))}>Remover</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="linha" style={{ marginTop: 10 }}>
        <select
          aria-label="Adicionar material"
          value=""
          onChange={(e) => {
            const m = p.materiais.find((x) => x.id === e.target.value);
            if (m) setItens([...itens, { materialId: m.id, quantidade: '', desperdicio: '', extra: !m.essencial }]);
          }}
        >
          <option value="">+ Adicionar material…</option>
          {livres.map((m) => <option key={m.id} value={m.id}>{CATEGORIAS[m.categoria]} · {m.nome}</option>)}
        </select>
      </div>
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>
        “Extra” é o material que o produto pode ficar sem (uma cantoneira, um adesivo): se faltar, ele só avisa e não impede de produzir.
        “Perda %” é a sobra específica daquele item. O desperdício geral entra depois, na precificação.
      </p>

      <div className="cartao" style={{ background: 'var(--neutro)' }}>
        <strong>Custo de material por unidade: {itens.length ? centavosParaTexto(r.custoCentavos) : '—'}</strong>
        <div>
          Dá para produzir agora:{' '}
          <strong>{r.quantidade === null ? '—' : `${r.quantidade} unidades`}</strong>
          {r.limitante && <> · limita: {infoDe(r.limitante)?.nome}</>}
        </div>
        {r.extrasEmFalta.length > 0 && <div className="suave">Extra em falta: {r.extrasEmFalta.map((id) => infoDe(id)?.nome).join(', ')}. O produto sai sem ele.</div>}
        {r.semCusto.length > 0 && <div className="suave">Ainda sem custo (registre uma compra): {r.semCusto.map((id) => infoDe(id)?.nome).join(', ')}.</div>}
      </div>

      {linha === 'impressao3d' && (
        <>
          <h2>Perfil de impressão</h2>
          <p className="suave">Guardar o perfil ajuda a repetir o padrão entre as peças e a entender o desperdício quando houver falhas.</p>
          <div className="formgrid">
            <Campo rotulo="Camadas de parede"><input type="text" inputMode="numeric" value={perfil.paredes} onChange={(e) => setPerfil({ ...perfil, paredes: Math.max(0, lerNumero(e.target.value) || 0) })} /></Campo>
            <Campo rotulo="Tipo de preenchimento">
              <select value={perfil.preenchimentoTipo} onChange={(e) => setPerfil({ ...perfil, preenchimentoTipo: e.target.value })}>
                {TIPOS_PREENCHIMENTO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Preenchimento (%)"><input type="text" inputMode="decimal" value={perfil.preenchimentoPct} onChange={(e) => setPerfil({ ...perfil, preenchimentoPct: Math.min(100, Math.max(0, lerNumero(e.target.value) || 0)) })} /></Campo>
            <Campo rotulo="Altura da camada (mm)"><input type="text" inputMode="decimal" value={perfil.alturaCamadaMm} onChange={(e) => setPerfil({ ...perfil, alturaCamadaMm: Math.max(0, lerNumero(e.target.value) || 0) })} /></Campo>
            <Campo rotulo="Cores">
              <select value={perfil.cor} onChange={(e) => setPerfil({ ...perfil, cor: e.target.value as Perfil3D['cor'] })}>
                <option value="mono">Monocromática (feita por partes)</option>
                <option value="ams">Colorida (AMS)</option>
              </select>
            </Campo>
            <Campo rotulo="Tempo de impressão (min)"><input type="text" inputMode="decimal" value={perfil.tempoImpressaoMin || ''} onChange={(e) => setPerfil({ ...perfil, tempoImpressaoMin: Math.max(0, lerNumero(e.target.value) || 0) })} /></Campo>
          </div>
          <Campo rotulo="Observações do perfil">
            <input type="text" value={perfil.observacoes} onChange={(e) => setPerfil({ ...perfil, observacoes: e.target.value })} />
          </Campo>
        </>
      )}

      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
        {p.inicial.id && (
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void salvar(p.inicial.ativo !== false)}>
            {p.inicial.ativo !== false ? 'Arquivar' : 'Desarquivar'}
          </button>
        )}
      </div>
    </div>
  );
}
