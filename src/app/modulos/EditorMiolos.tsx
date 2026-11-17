import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MioloRegistro } from '../../dados/db.ts';
import { arquivarMiolo, enviarAoMostruario, listarMiolos, novoMiolo, salvarMiolo } from '../../dados/miolos.ts';
import {
  CONFIG_PADRAO, FONTES_MIOLO, MODELOS_MIOLO, TAMANHOS_MIOLO, espacamentoSugerido, inicioPadrao, paginaParaSvg, paginasDoMiolo,
  type ConfigMiolo, type ModeloMiolo, type TamanhoMiolo, type FonteMiolo,
} from '../../dominio/miolo.ts';
import { ordemLivreto, paginasImpostas, papelParaFolha, totalComBrancas } from '../../dominio/imposicao.ts';
import { gerarPdf } from '../../dominio/pdf.ts';

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

const hoje = () => new Date().toLocaleDateString('sv');
const GRUPOS = ['Caderno', 'Planner', 'Extras'];
const COM_GRADE: ModeloMiolo[] = ['pautado', 'pontilhado', 'quadriculado'];
const COM_DATA: ModeloMiolo[] = ['semanal', 'mensal', 'diario1', 'diario2', 'habitos', 'reflexao'];
const SEMANA: ModeloMiolo[] = ['semanal', 'mensal', 'reflexao'];

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const nomeArquivo = (t: string) => t.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'miolo';

async function pngDaPagina(svg: string, largura: number, larguraMm: number, alturaMm: number): Promise<Blob> {
  const altura = Math.round((largura * alturaMm) / larguraMm);
  const sized = svg.replace(/width="[^"]*mm" height="[^"]*mm"/, `width="${largura}" height="${altura}"`);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  await new Promise<void>((ok, falha) => { img.onload = () => ok(); img.onerror = () => falha(new Error('Não consegui montar a miniatura.')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  c.getContext('2d')!.drawImage(img, 0, 0, largura, altura);
  URL.revokeObjectURL(url);
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não consegui gerar a miniatura.'))), 'image/png'));
}

function GeradorRapido() {
  const [lista, setLista] = useState<MioloRegistro[]>([]);
  const [atual, setAtual] = useState<MioloRegistro>(() => {
    const m = novoMiolo();
    return { ...m, config: { ...m.config, inicio: inicioPadrao(m.config.modelo, hoje(), true) } };
  });
  const [salvo, setSalvo] = useState(false);
  const [pos, setPos] = useState(0); // 0 = página 1 (ou a dupla 1, quando vista em dupla)
  const [dupla, setDupla] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function recarregar() { setLista(await listarMiolos()); }
  useEffect(() => { void recarregar(); }, []);

  const cfg = atual.config;
  const paginas = useMemo(() => paginasDoMiolo(cfg), [cfg]);
  const total = paginas.length;
  const sheet = papelParaFolha(paginas[0].larguraMm, paginas[0].alturaMm);
  const comBrancas = totalComBrancas(total);
  const folhas = comBrancas / 4;
  const maxPos = dupla ? Math.ceil(total / 2) : total - 1;
  const p = Math.min(pos, maxPos);

  function mudar(parcial: Partial<ConfigMiolo>) {
    setSalvo(false);
    setAtual((a) => ({ ...a, config: { ...a.config, ...parcial } }));
  }
  function trocarModelo(modelo: ModeloMiolo) {
    mudar({ modelo, espacamentoMm: espacamentoSugerido(modelo), inicio: cfg.inicio || inicioPadrao(modelo, hoje(), cfg.semanaComecaNaSegunda) });
    setPos(0);
  }
  function aoDatar(datado: boolean) {
    mudar({ datado, inicio: cfg.inicio || inicioPadrao(cfg.modelo, hoje(), cfg.semanaComecaNaSegunda) });
  }

  async function salvar(): Promise<MioloRegistro | null> {
    setErro('');
    try {
      const s = await salvarMiolo(atual);
      setAtual(s);
      setSalvo(true);
      await recarregar();
      return s;
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui salvar.');
      return null;
    }
  }

  async function aSalvar() {
    const s = await salvar();
    if (s) setMsg(`“${s.nome}” salvo.`);
  }

  function pdf(livreto: boolean) {
    setErro('');
    setMsg('');
    try {
      const base = nomeArquivo(atual.nome);
      const bytes = livreto
        ? gerarPdf(paginasImpostas(paginas, atual.folhasPorCaderno), `${atual.nome} (livreto)`)
        : gerarPdf(paginas, atual.nome);
      baixar(livreto ? `${base}-livreto.pdf` : `${base}.pdf`, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      setMsg(livreto ? 'PDF em livreto gerado: imprima frente e verso, virando pela borda curta.' : 'PDF gerado, com as páginas na ordem normal.');
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui gerar o PDF.');
    }
  }

  async function aoMostruario() {
    setErro('');
    setMsg('');
    setOcupado(true);
    try {
      const s = await salvar();
      if (!s) return;
      const png = await pngDaPagina(paginaParaSvg(paginas[0]), 600, paginas[0].larguraMm, paginas[0].alturaMm);
      const r = await enviarAoMostruario(s, png);
      setMsg(`“${s.nome}” está no Mostruário${r.nuvem ? ' e na nuvem, para as clientes escolherem' : ' (só neste aparelho; a nuvem entra com o login)'}. 🌸`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui enviar ao Mostruário.');
    } finally {
      setOcupado(false);
    }
  }

  async function arquivar() {
    if (!salvo && !lista.some((m) => m.id === atual.id)) return novo();
    await arquivarMiolo(atual.id);
    setMsg(`“${atual.nome}” foi guardado fora da lista.`);
    novo(false);
    await recarregar();
  }
  function novo(limpar = true) {
    const m = novoMiolo();
    setAtual({ ...m, config: { ...CONFIG_PADRAO, inicio: inicioPadrao(CONFIG_PADRAO.modelo, hoje(), true) } });
    setSalvo(false);
    setPos(0);
    if (limpar) { setMsg(''); setErro(''); }
  }
  function abrir(m: MioloRegistro) {
    setAtual({ ...m, config: { ...CONFIG_PADRAO, ...m.config } });
    setSalvo(true);
    setPos(0);
    setMsg('');
    setErro('');
  }

  const grade = COM_GRADE.includes(cfg.modelo);
  const comData = COM_DATA.includes(cfg.modelo);
  const mensal = cfg.modelo === 'mensal' || cfg.modelo === 'habitos';

  // páginas mostradas
  const esquerda = dupla ? (p === 0 ? null : paginas[2 * p - 1]) : null;
  const direita = dupla ? paginas[2 * p] ?? null : paginas[p];
  const mostrada = (pg: (typeof paginas)[number] | null) => (pg ? <div className="miolo-pagina" style={{ boxShadow: '0 1px 8px rgba(62,53,80,.18)', background: '#fff', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: paginaParaSvg(pg).replace(/width="[^"]*mm" height="[^"]*mm"/, 'width="100%"') }} /> : <div style={{ width: '100%' }} />);

  return (
    <>
      <p className="suave">Crie o miolo do seu caderno ou planner: escolha o modelo, o tamanho e as páginas, veja na tela e baixe o PDF pronto para imprimir (inclusive em livreto, com as páginas já na ordem certa). Depois é só enviar ao Mostruário para as clientes escolherem. 📖</p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primario" onClick={() => novo()}>Novo miolo</button>
          {lista.length > 0 && (
            <select aria-label="Meus miolos" value={lista.some((m) => m.id === atual.id) ? atual.id : ''} onChange={(e) => { const m = lista.find((x) => x.id === e.target.value); if (m) abrir(m); }}>
              <option value="">Meus miolos salvos ({lista.length})</option>
              {lista.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
        <div className="cartao">
          <h2>Escolhas</h2>
          <div className="formgrid">
            <Campo rotulo="Nome do miolo"><input type="text" value={atual.nome} onChange={(e) => { setSalvo(false); setAtual({ ...atual, nome: e.target.value }); }} /></Campo>
            <Campo rotulo="Modelo">
              <select value={cfg.modelo} onChange={(e) => trocarModelo(e.target.value as ModeloMiolo)}>
                {GRUPOS.map((g) => (
                  <optgroup key={g} label={g}>
                    {(Object.keys(MODELOS_MIOLO) as ModeloMiolo[]).filter((k) => MODELOS_MIOLO[k].grupo === g).map((k) => <option key={k} value={k}>{MODELOS_MIOLO[k].nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Tamanho">
              <select value={cfg.tamanho} onChange={(e) => mudar({ tamanho: e.target.value as TamanhoMiolo })}>
                {(Object.keys(TAMANHOS_MIOLO) as TamanhoMiolo[]).map((t) => <option key={t} value={t}>{TAMANHOS_MIOLO[t].nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Número de páginas"><input type="number" min={1} max={400} value={cfg.paginas} onChange={(e) => mudar({ paginas: Number(e.target.value) })} /></Campo>
            <Campo rotulo="Título no alto da página (opcional)"><input type="text" value={cfg.titulo} onChange={(e) => mudar({ titulo: e.target.value })} /></Campo>
            <Campo rotulo="Letra">
              <select value={cfg.fonte} onChange={(e) => mudar({ fonte: e.target.value as FonteMiolo })}>
                {(Object.keys(FONTES_MIOLO) as FonteMiolo[]).map((f) => <option key={f} value={f}>{FONTES_MIOLO[f]}</option>)}
              </select>
            </Campo>
          </div>
          <p className="suave" style={{ fontSize: 13 }}>{MODELOS_MIOLO[cfg.modelo].dica}</p>

          {comData && (
            <div style={{ marginTop: 8 }}>
              <label className="linha"><input type="checkbox" checked={cfg.datado} onChange={(e) => aoDatar(e.target.checked)} /> Com datas (planner datado)</label>
              {cfg.datado && (
                <div className="formgrid" style={{ marginTop: 8 }}>
                  <Campo rotulo={mensal ? 'Começa no mês de' : 'Começa em'}>
                    <input type="date" value={cfg.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
                  </Campo>
                  {(SEMANA.includes(cfg.modelo)) && (
                    <Campo rotulo="A semana começa na">
                      <select value={cfg.semanaComecaNaSegunda ? 'seg' : 'dom'} onChange={(e) => mudar({ semanaComecaNaSegunda: e.target.value === 'seg' })}>
                        <option value="seg">Segunda</option>
                        <option value="dom">Domingo</option>
                      </select>
                    </Campo>
                  )}
                </div>
              )}
              {!cfg.datado && <p className="suave" style={{ fontSize: 13 }}>Sem datas: ficam campos para a cliente preencher à mão (planner não datado).</p>}
            </div>
          )}
          {cfg.modelo === 'habitos' && (
            <div className="formgrid" style={{ marginTop: 8 }}>
              <Campo rotulo="Linhas de hábitos"><input type="number" min={3} max={20} value={cfg.habitos} onChange={(e) => mudar({ habitos: Number(e.target.value) })} /></Campo>
            </div>
          )}

          <details style={{ marginTop: 10 }}>
            <summary>Margens, cores e traço</summary>
            <div className="formgrid" style={{ marginTop: 8 }}>
              <Campo rotulo="Margem interna (encadernação), mm"><input type="number" min={0} step={0.5} value={cfg.margemInternaMm} onChange={(e) => mudar({ margemInternaMm: Number(e.target.value) })} /></Campo>
              <Campo rotulo="Margem externa, mm"><input type="number" min={0} step={0.5} value={cfg.margemExternaMm} onChange={(e) => mudar({ margemExternaMm: Number(e.target.value) })} /></Campo>
              <Campo rotulo="Margem de cima, mm"><input type="number" min={0} step={0.5} value={cfg.margemSuperiorMm} onChange={(e) => mudar({ margemSuperiorMm: Number(e.target.value) })} /></Campo>
              <Campo rotulo="Margem de baixo, mm"><input type="number" min={0} step={0.5} value={cfg.margemInferiorMm} onChange={(e) => mudar({ margemInferiorMm: Number(e.target.value) })} /></Campo>
              {grade && <Campo rotulo="Espaçamento, mm"><input type="number" min={2.5} step={0.5} value={cfg.espacamentoMm} onChange={(e) => mudar({ espacamentoMm: Number(e.target.value) })} /></Campo>}
              <Campo rotulo="Espessura do traço, mm"><input type="number" min={0.05} max={1} step={0.05} value={cfg.espessuraMm} onChange={(e) => mudar({ espessuraMm: Number(e.target.value) })} /></Campo>
              <Campo rotulo="Cor das linhas"><input type="color" value={cfg.cor} onChange={(e) => mudar({ cor: e.target.value })} /></Campo>
              <Campo rotulo="Cor dos textos"><input type="color" value={cfg.corTexto} onChange={(e) => mudar({ corTexto: e.target.value })} /></Campo>
            </div>
            <label className="linha" style={{ marginTop: 8 }}><input type="checkbox" checked={cfg.numeracao} onChange={(e) => mudar({ numeracao: e.target.checked })} /> Numerar as páginas</label>
            <p className="suave" style={{ fontSize: 13 }}>A margem interna fica do lado da encadernação: nas páginas ímpares à esquerda e nas pares à direita.</p>
          </details>
        </div>

        <div className="cartao">
          <div className="linha" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <button className="btn" disabled={p <= 0} onClick={() => setPos(p - 1)} aria-label="Página anterior">‹</button>
            <span>{dupla ? (p === 0 ? 'Página 1' : `Páginas ${2 * p} e ${Math.min(2 * p + 1, total)}`) : `Página ${p + 1} de ${total}`}</span>
            <button className="btn" disabled={p >= maxPos} onClick={() => setPos(p + 1)} aria-label="Próxima página">›</button>
            <label className="linha" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={dupla} onChange={(e) => { setDupla(e.target.checked); setPos(0); }} /> Ver em dupla</label>
          </div>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', background: '#EFE9F2', padding: 12, borderRadius: 12 }}>
            {dupla ? (
              <>
                <div style={{ width: '48%' }}>{mostrada(esquerda)}</div>
                <div style={{ width: '48%' }}>{mostrada(direita)}</div>
              </>
            ) : (
              <div style={{ width: 'min(100%, 360px)' }}>{mostrada(direita)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="cartao">
        <h2>Salvar e imprimir</h2>
        <div className="linha" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn primario" onClick={() => void aSalvar()}>{salvo ? 'Salvo ✓' : 'Salvar'}</button>
          <button className="btn" onClick={() => pdf(false)}>Baixar PDF (ordem normal)</button>
          <button className="btn" disabled={ocupado} onClick={() => void aoMostruario()}>{ocupado ? 'Enviando…' : 'Enviar ao Mostruário'}</button>
          <button className="btn" onClick={() => void arquivar()}>Guardar fora da lista</button>
        </div>
        <p className="suave" style={{ fontSize: 13 }}>A ordem normal serve para wire-o, discos e espiral. Para brochura, costura ou grampo, use o livreto abaixo.</p>

        <h3 style={{ marginTop: 14 }}>Livreto (páginas reajustadas)</h3>
        <div className="formgrid">
          <Campo rotulo="Folhas por caderno">
            <select value={atual.folhasPorCaderno} onChange={(e) => { setSalvo(false); setAtual({ ...atual, folhasPorCaderno: Number(e.target.value) }); }}>
              <option value={0}>Um caderno só (todas as folhas juntas)</option>
              {[2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} folhas dobradas por caderno ({n * 4} páginas)</option>)}
            </select>
          </Campo>
        </div>
        <p className="suave" style={{ fontSize: 13 }}>
          {folhas} {folhas === 1 ? 'folha' : 'folhas'} impressas na frente e no verso ({ordemLivreto(total, atual.folhasPorCaderno).length} lados)
          {comBrancas > total ? `, com ${comBrancas - total} ${comBrancas - total === 1 ? 'página em branco' : 'páginas em branco'} no final para fechar a conta` : ''}.
          {' '}Cada folha aberta mede {Math.round(sheet.folha.l)} × {Math.round(sheet.folha.a)} mm
          {sheet.papel === 'maior que A2' ? ' (maior que A2)' : `: precisa de papel ${sheet.papel} na horizontal`}. Imprima frente e verso, virando pela borda curta, e dobre ao meio.
        </p>
        <button className="btn primario" onClick={() => pdf(true)}>Baixar PDF em livreto</button>

        {msg && <p className="ok">{msg}</p>}
        {erro && <p className="aviso">{erro}</p>}
      </div>
    </>
  );
}

const URL_ESTUDIO = `${window.location.origin}/editor-miolos/`;

export function EditorMiolos() {
  return (
    <>
      <h1>Miolos</h1>
      <div className="cartao">
        <h2>Estúdio de Miolos</h2>
        <p className="suave">O editor completo fica em um app só dele: modelos de planner e caderno, bordas, adesivos, widgets, régua e grade, PDF pronto para imprimir e em cadernos. O que você marcar para o mostruário chega aqui sozinho. 🌸</p>
        <div className="linha" style={{ flexWrap: 'wrap', gap: 8 }}>
          <a className="btn primario" href={URL_ESTUDIO} target="_blank" rel="noopener noreferrer">Abrir o Estúdio de Miolos ↗</a>
        </div>
      </div>
      <details className="cartao">
        <summary><strong>Gerador rápido</strong> <span className="suave">(miolo simples em poucos cliques, sem abrir o estúdio)</span></summary>
        <GeradorRapido />
      </details>
    </>
  );
}
