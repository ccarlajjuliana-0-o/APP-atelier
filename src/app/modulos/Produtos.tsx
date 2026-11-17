import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db, type Material, type MostruarioRegistro, type Produto } from '../../dados/db.ts';
import { listarMateriais, saldos } from '../../dados/materiais.ts';
import { CampoFotos, Miniatura } from '../componentes/Fotos.tsx';
import { duplicarProduto, listarProdutos, salvarProduto } from '../../dados/produtos.ts';
import { CATEGORIAS, UNIDADES, lerNumero, microParaTexto } from '../../dominio/materiais.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { EditorOpcoes, gruposParaForm, gruposDoForm, type GrupoForm } from '../componentes/EditorOpcoes.tsx';
import { ExtrasCatalogo } from '../componentes/ExtrasCatalogo.tsx';
import { BICOS, FICHA_VAZIA, FILAMENTOS, LINHAS, MAX_CORES, receita3d, TIPOS_COLECAO, resumoFicha, resumoProduto, type FichaProduto, type TipoColecao, type InfoMaterial, type ItemProduto, type Linha, type Perfil3D } from '../../dominio/produtos.ts';

const PERFIL_PADRAO: Perfil3D = {
  paredes: 3, preenchimentoTipo: 'grade', preenchimentoPct: 15, alturaCamadaMm: 0.2, cor: 'mono', tempoImpressaoMin: 0, observacoes: '',
};
const TIPOS_PREENCHIMENTO = ['grade', 'giroide', 'linhas', 'cúbico', 'triangular', 'outro'];

function novoProduto(): Produto {
  return {
    id: '', nome: '', linha: 'encadernacao', categoria: '', tempoTrabalhoMin: 0, precoCentavos: null,
    receita: [], modo: 'catalogo', opcoes: [], ficha: { ...FICHA_VAZIA }, prontos: 0, perfil3d: null, ativo: true, atualizadoEm: '',
  };
}

export function Produtos() {
  const [lista, setLista] = useState<Produto[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [saldo, setSaldo] = useState<Record<string, number>>({});
  const [filtro, setFiltro] = useState<Linha | 'todas' | 'extra'>('todas');
  const [arquivados, setArquivados] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [mostruario, setMostruario] = useState<MostruarioRegistro[]>([]);
  const [colecaoFiltro, setColecaoFiltro] = useState('');
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    setLista(await listarProdutos());
    setMateriais(await listarMateriais());
    setMostruario(await db.mostruario.toArray());
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
    .filter(({ p, r }) => (filtro === 'todas' ? true : filtro === 'extra' ? r.extrasEmFalta.length > 0 : p.linha === filtro))
    .filter(({ p }) => (colecaoFiltro === '' ? true : colecaoFiltro === '__sem' ? !p.colecao : p.colecao === colecaoFiltro));
  const colecoes = Array.from(new Set(lista.map((p) => p.colecao ?? '').filter((c) => c !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const colecoesPorLinha: Record<Linha, string[]> = {
    encadernacao: Array.from(new Set(lista.filter((p) => p.linha === 'encadernacao').map((p) => p.colecao ?? '').filter((c) => c !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    impressao3d: Array.from(new Set(lista.filter((p) => p.linha === 'impressao3d').map((p) => p.colecao ?? '').filter((c) => c !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
  const grupos = [...colecoes, ''].map((c) => ({ nome: c, itens: linhas.filter(({ p }) => (p.colecao ?? '') === c) })).filter((g) => g.itens.length > 0);
  async function ajustarProntos(p: Produto, delta: number) {
    await salvarProduto({ ...p, prontos: Math.max(0, (p.prontos ?? 0) + delta) });
    await recarregar();
  }

  const nomeMat = (id: string | null) => (id ? info[id]?.nome ?? '—' : '—');

  return (
    <>
      <h1>Catálogo</h1>
      <p className="suave">
        Seus produtos prontos, com a ficha de cada um, a coleção, quantos já estão prontos e quantos dá para fazer com o estoque. Orçamentos e pedidos puxam daqui.
      </p>
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
          {colecoes.length > 0 && (
            <select value={colecaoFiltro} onChange={(e) => setColecaoFiltro(e.target.value)} aria-label="Coleção">
              <option value="">Todas as coleções</option>
              {colecoes.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__sem">Sem coleção</option>
            </select>
          )}
        </div>
      </div>

      {editando && (
        <div ref={painelRef}>
          <FormProduto
            key={editando.id || 'novo'}
            inicial={editando}
            materiais={materiais.filter((m) => m.ativo)}
            info={info}
            mostruario={mostruario.filter((m) => m.visivel)}
            colecoes={colecoesPorLinha}
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
              <tr><th>Produto</th><th>Preço atual</th><th>Custo de material</th><th>Prontos</th><th>Dá para produzir</th><th>Material que limita</th><th /></tr>
            </thead>
            <tbody>
              {grupos.map((g) => [
                <tr key={`g-${g.nome}`}><td colSpan={7} style={{ background: 'var(--neutro)' }}><strong>{g.nome ? `${g.itens[0].p.colecaoTipo ? TIPOS_COLECAO[g.itens[0].p.colecaoTipo] + ': ' : ''}${g.nome}` : 'Sem coleção'}</strong></td></tr>,
                ...g.itens.map(({ p, r }) => (
                <tr key={p.id}>
                  <td>
                    <div className="linha" style={{ flexWrap: 'nowrap' }}>
                      <Miniatura foto={p.fotos?.[0]} />
                      <div>
                        <strong>{p.nome}</strong>
                        <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{resumoFicha(p.ficha, p.linha) || `${LINHAS[p.linha]}${p.categoria ? ` · ${p.categoria}` : ''}`}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.precoCentavos !== null ? centavosParaTexto(p.precoCentavos) : '—'}</td>
                  <td>
                    {p.receita.length ? centavosParaTexto(r.custoCentavos) : '—'}
                    {r.semCusto.length > 0 && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>faltam custos de {r.semCusto.length} material(is)</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn" aria-label="Menos um pronto" onClick={() => void ajustarProntos(p, -1)}>−</button>{' '}
                    <strong>{p.prontos ?? 0}</strong>{' '}
                    <button className="btn" aria-label="Mais um pronto" onClick={() => void ajustarProntos(p, 1)}>+</button>
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
                )),
              ])}
              {linhas.length === 0 && <tr><td colSpan={7} className="suave">Nada nesta lista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>
        “Prontos” é o que já está feito e guardado (ajuste com − e +). “Dá para produzir” é o que o estoque de material permite agora.
        O custo considera só os materiais da receita; tempo de trabalho, tinta, desgaste e desperdício entram na precificação.
      </p>
      <ExtrasCatalogo materiais={materiais.filter((m) => m.ativo)} />
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
  mostruario: MostruarioRegistro[];
  colecoes: Record<Linha, string[]>;
  fechar: () => void;
  aoSalvar: (msg: string) => Promise<void>;
}) {
  const catalogo = true;
  const [nome, setNome] = useState(p.inicial.nome);
  const [linha, setLinha] = useState<Linha>(p.inicial.linha);
  const [categoria, setCategoria] = useState(p.inicial.categoria);
  const [tempo, setTempo] = useState(p.inicial.tempoTrabalhoMin ? String(p.inicial.tempoTrabalhoMin) : '');
  const [preco, setPreco] = useState(p.inicial.precoCentavos !== null ? (p.inicial.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
  const [itens, setItens] = useState<LinhaForm[]>(
    p.inicial.receita.map((i) => ({ materialId: i.materialId, quantidade: String(i.quantidade).replace('.', ','), desperdicio: i.desperdicioPct ? String(i.desperdicioPct).replace('.', ',') : '', extra: i.extra })),
  );
  const [grupos, setGrupos] = useState<GrupoForm[]>(gruposParaForm(p.inicial.opcoes ?? []));
  const [ficha, setFicha] = useState<FichaProduto>({ ...FICHA_VAZIA, ...(p.inicial.ficha ?? {}) });
  const [colecaoTipo, setColecaoTipo] = useState<TipoColecao>(p.inicial.colecaoTipo ?? 'colecao');
  const [colecao, setColecao] = useState(p.inicial.colecao ?? '');
  const [capaId, setCapaId] = useState(p.inicial.capaId ?? '');
  const [miolosIds, setMiolosIds] = useState<string[]>(p.inicial.miolosIds ?? []);
  const [adesivosIds, setAdesivosIds] = useState<string[]>(p.inicial.adesivosIds ?? []);
  const [perfil, setPerfil] = useState<Perfil3D>({ ...PERFIL_PADRAO, ...(p.inicial.perfil3d ?? {}) });
  const nt = (n: number | undefined) => (n ? String(n).replace('.', ',') : '');
  const [cfg, setCfg] = useState({
    paredes: nt(perfil.paredes), preenchimentoPct: nt(perfil.preenchimentoPct), alturaCamadaMm: nt(perfil.alturaCamadaMm), tempoImpressaoMin: nt(perfil.tempoImpressaoMin),
    tempMesaC: nt(perfil.tempMesaC), tempBicoC: nt(perfil.tempBicoC), camadas: nt(perfil.camadas), volumeG: nt(perfil.volumeG), purgaG: nt(perfil.purgaG),
  });
  const [filamentoMaterialId, setFilamentoMaterialId] = useState(p.inicial.filamentoMaterialId ?? '');
  const [fotos, setFotos] = useState<Blob[]>(p.inicial.fotos ?? []);
  const [erro, setErro] = useState('');
  const e3d = linha === 'impressao3d';
  const numCfg = (k: keyof typeof cfg) => { const v = lerNumero(cfg[k] || '0'); return Number.isNaN(v) ? 0 : Math.max(0, v); };

  const porId = Object.fromEntries(p.materiais.map((m) => [m.id, m]));
  // materiais arquivados que ainda estão na receita continuam aparecendo
  const infoDe = (id: string) => p.info[id];

  const itensNum: ItemProduto[] = itens.map((i) => ({
    materialId: i.materialId,
    quantidade: Number.isNaN(lerNumero(i.quantidade)) ? 0 : lerNumero(i.quantidade),
    desperdicioPct: Number.isNaN(lerNumero(i.desperdicio || '0')) ? 0 : lerNumero(i.desperdicio || '0'),
    extra: i.extra,
  }));
  const derivada = receita3d(filamentoMaterialId || null, numCfg('volumeG'), numCfg('purgaG'));
  const receitaFinal = e3d ? (derivada.length ? derivada : p.inicial.receita) : itensNum;
  const r = resumoProduto(receitaFinal, p.info);
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
    if (e3d && ficha.modoCor === 'multi' && (ficha.cores ?? []).filter((c) => c.trim()).length > MAX_CORES) return setErro('Multicolorido aceita até 4 cores.');
    for (const i of e3d ? [] : itensNum) {
      if (!(i.quantidade > 0)) return setErro(`Informe a quantidade de “${infoDe(i.materialId)?.nome ?? 'material'}” por unidade (maior que zero).`);
    }
    const gruposNum = gruposDoForm(grupos);
    const semNome = gruposNum.find((g) => !g.nome || g.opcoes.some((o) => !o.nome));
    if (semNome) return setErro('Dê um nome a cada grupo e a cada opção do formulário personalizado.');
    const salvo = await salvarProduto({
      ...p.inicial,
      nome: n, linha, categoria: e3d ? '' : categoria.trim(), tempoTrabalhoMin: t,
      precoCentavos: pc === null ? null : Math.round(pc * 100),
      receita: e3d ? receitaFinal : itensNum,
      modo: 'catalogo',
      filamentoMaterialId: e3d ? filamentoMaterialId || null : null,
      ficha: e3d ? { ...ficha, tipo: '', encadernacao: '', folhas: '', cores: ficha.modoCor === 'multi' ? (ficha.cores ?? []).slice(0, MAX_CORES) : [], pinturaManual: ficha.pintar ? ficha.pinturaManual ?? '' : '' } : ficha,
      colecaoTipo, colecao: colecao.trim(),
      capaId: e3d ? null : capaId || null, miolosIds: e3d ? [] : miolosIds, adesivosIds: e3d ? [] : adesivosIds,
      opcoes: gruposNum,
      perfil3d: e3d ? {
        ...perfil,
        paredes: numCfg('paredes'), preenchimentoPct: Math.min(100, numCfg('preenchimentoPct')), alturaCamadaMm: numCfg('alturaCamadaMm'), tempoImpressaoMin: numCfg('tempoImpressaoMin'),
        tempMesaC: numCfg('tempMesaC'), tempBicoC: numCfg('tempBicoC'), camadas: Math.round(numCfg('camadas')), volumeG: numCfg('volumeG'), purgaG: numCfg('purgaG'),
        cor: ficha.modoCor === 'multi' ? 'ams' : 'mono',
      } : null,
      fotos,
      ativo: arquivar === undefined ? p.inicial.ativo !== false : !arquivar,
    });
    await p.aoSalvar(arquivar === true ? `“${salvo.nome}” arquivado.` : arquivar === false ? `“${salvo.nome}” voltou para a lista.` : `“${salvo.nome}” salvo.`);
  }

  return (
    <div className="cartao">
      <h2>{p.inicial.id ? 'Produto do catálogo' : 'Novo produto'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></Campo>
        <Campo rotulo="Linha">
          <select value={linha} onChange={(e) => setLinha(e.target.value as Linha)}>
            {(Object.keys(LINHAS) as Linha[]).map((l) => <option key={l} value={l}>{LINHAS[l]}</option>)}
          </select>
        </Campo>
        {!e3d && <Campo rotulo="Categoria (planner, caderno, marcador…)"><input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></Campo>}
        {e3d && (
          <>
            <Campo rotulo="Filamento">
              <select value={ficha.filamento ?? ''} onChange={(e) => setFicha({ ...ficha, filamento: e.target.value })}>
                <option value="">Escolha…</option>
                {FILAMENTOS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Campo>
            {ficha.filamento === 'Outro' && <Campo rotulo="Qual filamento?"><input type="text" value={ficha.filamentoOutro ?? ''} onChange={(e) => setFicha({ ...ficha, filamentoOutro: e.target.value })} /></Campo>}
          </>
        )}
        <Campo rotulo="Tempo de trabalho (min)"><input type="text" inputMode="decimal" value={tempo} onChange={(e) => setTempo(e.target.value)} /></Campo>
        <Campo rotulo="Preço de venda atual (R$, opcional)"><input type="text" inputMode="decimal" placeholder="0,00" value={preco} onChange={(e) => setPreco(e.target.value)} /></Campo>
      </div>

      {e3d ? (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Descrição da peça</h3>
          <div className="formgrid">
            <Campo rotulo="Tamanho (cm, ex.: 8 x 5 x 2)"><input type="text" value={ficha.tamanho} onChange={(e) => setFicha({ ...ficha, tamanho: e.target.value })} /></Campo>
          </div>
          <div className="linha" style={{ gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <label className="linha"><input type="checkbox" checked={ficha.modoCor === 'mono'} onChange={(e) => setFicha({ ...ficha, modoCor: e.target.checked ? 'mono' : undefined })} /> Monocromático</label>
            <label className="linha"><input type="checkbox" checked={ficha.modoCor === 'multi'} onChange={(e) => setFicha({ ...ficha, modoCor: e.target.checked ? 'multi' : undefined, cores: e.target.checked ? [...(ficha.cores ?? []), '', '', '', ''].slice(0, MAX_CORES) : ficha.cores })} /> Multicolorido (até 4 cores)</label>
          </div>
          {ficha.modoCor === 'multi' ? (
            <div className="formgrid" style={{ marginTop: 6 }}>
              {Array.from({ length: MAX_CORES }, (_, k) => (
                <Campo key={k} rotulo={`Cor ${k + 1}`}>
                  <input type="text" value={(ficha.cores ?? [])[k] ?? ''} onChange={(e) => { const c = [...(ficha.cores ?? []), '', '', '', ''].slice(0, MAX_CORES); c[k] = e.target.value; setFicha({ ...ficha, cores: c }); }} />
                </Campo>
              ))}
            </div>
          ) : (
            <div className="formgrid" style={{ marginTop: 6 }}>
              <Campo rotulo="Cor"><input type="text" value={ficha.cor} onChange={(e) => setFicha({ ...ficha, cor: e.target.value })} /></Campo>
            </div>
          )}
          <div className="formgrid" style={{ marginTop: 6 }}>
            <Campo rotulo="Acabamentos (ex.: lixado, primer, verniz)">
              <input type="text" list="acabamentos-3d" value={ficha.acabamentos ?? ''} onChange={(e) => setFicha({ ...ficha, acabamentos: e.target.value })} />
              <datalist id="acabamentos-3d">{['Lixado', 'Primer', 'Verniz', 'Polimento', 'Sem acabamento'].map((x) => <option key={x} value={x} />)}</datalist>
            </Campo>
          </div>
          <label className="linha" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={!!ficha.pintar} onChange={(e) => setFicha({ ...ficha, pintar: e.target.checked })} /> Esta peça vai ser pintada
          </label>
          {ficha.pintar && (
            <div className="formgrid" style={{ marginTop: 6 }}>
              <Campo rotulo="Pintura manual (cores, detalhes)"><input type="text" value={ficha.pinturaManual ?? ''} onChange={(e) => setFicha({ ...ficha, pinturaManual: e.target.value })} /></Campo>
            </div>
          )}
        </>
      ) : (
        <>
      <h3 style={{ margin: '16px 0 6px' }}>Descrição do produto</h3>
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>Um campo para cada item, ex.: planner diário · A5 · azul · wire-o · 90 folhas.</p>
      <div className="formgrid">
        <Campo rotulo="Tipo (ex.: planner diário)"><input type="text" value={ficha.tipo} onChange={(e) => setFicha({ ...ficha, tipo: e.target.value })} /></Campo>
        <Campo rotulo="Tamanho (ex.: A5)"><input type="text" value={ficha.tamanho} onChange={(e) => setFicha({ ...ficha, tamanho: e.target.value })} /></Campo>
        <Campo rotulo="Cor"><input type="text" value={ficha.cor} onChange={(e) => setFicha({ ...ficha, cor: e.target.value })} /></Campo>
        <Campo rotulo="Encadernação (wire-o, disco, costura)"><input type="text" value={ficha.encadernacao} onChange={(e) => setFicha({ ...ficha, encadernacao: e.target.value })} /></Campo>
        <Campo rotulo="Folhas (ex.: 90)"><input type="text" inputMode="numeric" value={ficha.folhas} onChange={(e) => setFicha({ ...ficha, folhas: e.target.value })} /></Campo>
      </div>

        </>
      )}

      <h3 style={{ margin: '16px 0 6px' }}>Agrupamento{e3d ? ' (impressão 3D)' : ''}</h3>
      <div className="formgrid">
        <Campo rotulo="Tipo de agrupamento">
          <select value={colecaoTipo} onChange={(e) => setColecaoTipo(e.target.value as TipoColecao)}>
            {(Object.keys(TIPOS_COLECAO) as TipoColecao[]).map((t) => <option key={t} value={t}>{TIPOS_COLECAO[t]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nome (ex.: Natal 2026, Volta às aulas, Floral)">
          <input type="text" list="colecoes-existentes" value={colecao} onChange={(e) => setColecao(e.target.value)} />
          <datalist id="colecoes-existentes">{p.colecoes[linha].map((c) => <option key={c} value={c} />)}</datalist>
        </Campo>
      </div>

      {!e3d && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Do mostruário</h3>
          <MostruarioDoProduto mostruario={p.mostruario} capaId={capaId} setCapaId={setCapaId} miolosIds={miolosIds} setMiolosIds={setMiolosIds} adesivosIds={adesivosIds} setAdesivosIds={setAdesivosIds} />
        </>
      )}

      <div style={{ marginTop: 12 }}>
        {e3d
          ? <CampoFotos fotos={fotos} max={8} rotulo="Imagens das peças 3D (mostruário, até 8)" aoMudar={setFotos} />
          : <CampoFotos fotos={fotos} max={4} rotulo="Fotos do produto (até 4)" aoMudar={setFotos} />}
      </div>

      {e3d ? (
        <>
          <h2 style={{ marginTop: 18 }}>Configuração de impressão</h2>
          <p className="suave">A configuração guarda o padrão da peça. O filamento do estoque, com o volume usado e a purga, vira o custo e a conta de quantas dá para imprimir.</p>
          <div className="formgrid">
            <Campo rotulo="Temperatura da mesa (°C)"><input type="text" inputMode="numeric" value={cfg.tempMesaC} onChange={(e) => setCfg({ ...cfg, tempMesaC: e.target.value })} /></Campo>
            <Campo rotulo="Temperatura do bico (°C)"><input type="text" inputMode="numeric" value={cfg.tempBicoC} onChange={(e) => setCfg({ ...cfg, tempBicoC: e.target.value })} /></Campo>
            <Campo rotulo="Tipo de bico">
              <select value={perfil.tipoBico ?? ''} onChange={(e) => setPerfil({ ...perfil, tipoBico: e.target.value })}>
                <option value="">Escolha…</option>
                {BICOS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Campo>
            {perfil.tipoBico === 'Outro' && <Campo rotulo="Qual bico?"><input type="text" value={perfil.tipoBicoOutro ?? ''} onChange={(e) => setPerfil({ ...perfil, tipoBicoOutro: e.target.value })} /></Campo>}
            <Campo rotulo="Número de camadas"><input type="text" inputMode="numeric" value={cfg.camadas} onChange={(e) => setCfg({ ...cfg, camadas: e.target.value })} /></Campo>
            <Campo rotulo="Camadas de parede"><input type="text" inputMode="numeric" value={cfg.paredes} onChange={(e) => setCfg({ ...cfg, paredes: e.target.value })} /></Campo>
            <Campo rotulo="Altura da camada (mm)"><input type="text" inputMode="decimal" value={cfg.alturaCamadaMm} onChange={(e) => setCfg({ ...cfg, alturaCamadaMm: e.target.value })} /></Campo>
            <Campo rotulo="Tipo de preenchimento">
              <select value={perfil.preenchimentoTipo} onChange={(e) => setPerfil({ ...perfil, preenchimentoTipo: e.target.value })}>
                {TIPOS_PREENCHIMENTO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Preenchimento (%)"><input type="text" inputMode="decimal" value={cfg.preenchimentoPct} onChange={(e) => setCfg({ ...cfg, preenchimentoPct: e.target.value })} /></Campo>
            <Campo rotulo="Volume usado (g de filamento)"><input type="text" inputMode="decimal" value={cfg.volumeG} onChange={(e) => setCfg({ ...cfg, volumeG: e.target.value })} /></Campo>
            <Campo rotulo="Purga (g, na troca de cor)"><input type="text" inputMode="decimal" value={cfg.purgaG} onChange={(e) => setCfg({ ...cfg, purgaG: e.target.value })} /></Campo>
            <Campo rotulo="Tempo de impressão (min)"><input type="text" inputMode="decimal" value={cfg.tempoImpressaoMin} onChange={(e) => setCfg({ ...cfg, tempoImpressaoMin: e.target.value })} /></Campo>
            <Campo rotulo="Filamento do estoque (para custo e estoque)">
              <select value={filamentoMaterialId} onChange={(e) => setFilamentoMaterialId(e.target.value)}>
                <option value="">Escolha…</option>
                {(p.materiais.some((m) => m.categoria === 'filamento') ? p.materiais.filter((m) => m.categoria === 'filamento') : p.materiais).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Observações da impressão">
            <input type="text" value={perfil.observacoes} onChange={(e) => setPerfil({ ...perfil, observacoes: e.target.value })} />
          </Campo>
          {!derivada.length && p.inicial.receita.length > 0 && (
            <p className="suave">Esta peça tem uma receita antiga ({p.inicial.receita.length} material(is)) que continua valendo até você escolher o filamento e informar o volume usado.</p>
          )}
          <div className="cartao" style={{ background: 'var(--neutro)' }}>
            <strong>Custo de material por peça: {receitaFinal.length ? centavosParaTexto(r.custoCentavos) : '—'}</strong>
            <div>Dá para imprimir agora: <strong>{r.quantidade === null ? '—' : `${r.quantidade} peças`}</strong>{r.limitante && <> · limita: {infoDe(r.limitante)?.nome}</>}</div>
            {r.semCusto.length > 0 && <div className="suave">Ainda sem custo (registre uma compra): {r.semCusto.map((id) => infoDe(id)?.nome).join(', ')}.</div>}
          </div>
        </>
      ) : (
      <>
      <details open={catalogo || itens.length > 0} style={{ marginTop: 6 }}>
      <summary style={{ cursor: 'pointer', marginTop: 12 }}><strong style={{ fontSize: '1.15em' }}>{catalogo ? 'Receita (por unidade)' : 'Materiais fixos (opcional)'}</strong></summary>
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

      </details>
      </>
      )}

      <EditorOpcoes catalogo grupos={grupos} aoMudar={setGrupos} materiais={p.materiais} info={p.info} />

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

function MostruarioDoProduto(p: {
  mostruario: MostruarioRegistro[];
  capaId: string; setCapaId: (v: string) => void;
  miolosIds: string[]; setMiolosIds: (v: string[]) => void;
  adesivosIds: string[]; setAdesivosIds: (v: string[]) => void;
}) {
  const por = (t: MostruarioRegistro['tipo']) => p.mostruario.filter((m) => m.tipo === t).sort((a, b) => a.ordem - b.ordem);
  const capas = por('capa'), miolos = por('modelo'), adesivos = por('adesivo');
  const alternar = (lista: string[], id: string, set: (v: string[]) => void) => set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  if (p.mostruario.length === 0) return <p className="suave">O mostruário ainda está vazio. Importe o pacote ou adicione capas em Mostruário.</p>;
  return (
    <div>
      <Campo rotulo="Capa">
        <select value={p.capaId} onChange={(e) => p.setCapaId(e.target.value)}>
          <option value="">—</option>
          {capas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <details style={{ marginTop: 6 }}>
        <summary>Miolos ({p.miolosIds.length})</summary>
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {miolos.map((m) => <label key={m.id} className="linha" style={{ gap: 6 }}><input type="checkbox" checked={p.miolosIds.includes(m.id)} onChange={() => alternar(p.miolosIds, m.id, p.setMiolosIds)} />{m.nome}</label>)}
        </div>
      </details>
      <details style={{ marginTop: 6 }}>
        <summary>Adesivos ({p.adesivosIds.length})</summary>
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {adesivos.map((m) => <label key={m.id} className="linha" style={{ gap: 6 }}><input type="checkbox" checked={p.adesivosIds.includes(m.id)} onChange={() => alternar(p.adesivosIds, m.id, p.setAdesivosIds)} />{m.nome}</label>)}
        </div>
      </details>
    </div>
  );
}
