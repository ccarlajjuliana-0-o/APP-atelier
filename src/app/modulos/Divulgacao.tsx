import { useEffect, useMemo, useState } from 'react';
import { listarPublicacoes, salvarPublicacao } from '../../dados/divulgacao.ts';
import { listarProdutos } from '../../dados/produtos.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import type { Produto } from '../../dados/db.ts';
import {
  CANAIS, FORMATO_DO_CANAL, METRICAS_ZERADAS, STATUS_POST, TIPOS_LEGENDA, conferirComAMarca, engajamento, enderecoSeguro, gerarLegenda, limparHashtags,
  mesSeguinte, nomeDoMes, proximasDatas, resumirResultados, semanasDoMes, textoParaCopiar,
  type CanalPost, type Metricas, type Publicacao, type StatusPost, type TipoLegenda,
} from '../../dominio/divulgacao.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { CampoFotos } from '../componentes/Fotos.tsx';
import { Campo } from './FinanceiroCampos.tsx';

type Aba = 'calendario' | 'lista' | 'datas' | 'resultados';
const ABAS: [Aba, string][] = [['calendario', 'Calendário'], ['lista', 'Lista'], ['datas', 'Datas para planejar'], ['resultados', 'Resultados']];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function nova(data: string, titulo = ''): Publicacao {
  return {
    id: '', titulo, canal: 'instagram_feed', data, hora: '', status: 'ideia', tipo: '', produtoId: null, legenda: '', hashtags: [], link: '', observacoes: '',
    imagens: [], metricas: { ...METRICAS_ZERADAS }, atualizadoEm: '',
  };
}

export function Divulgacao() {
  const hoje = hojeLocal();
  const [aba, setAba] = useState<Aba>('calendario');
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [posts, setPosts] = useState<Publicacao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [editando, setEditando] = useState<Publicacao | null>(null);
  const [filtro, setFiltro] = useState<StatusPost | 'todos'>('todos');

  async function recarregar() {
    setPosts(await listarPublicacoes());
    setProdutos(await listarProdutos());
  }
  useEffect(() => {
    void recarregar();
  }, []);

  const porDia = useMemo(() => {
    const m = new Map<string, Publicacao[]>();
    for (const p of posts) if (p.status !== 'descartado') m.set(p.data, [...(m.get(p.data) ?? []), p]);
    return m;
  }, [posts]);
  const datas = useMemo(() => new Map(proximasDatas(`${mes}-01`, 400).map((d) => [d.data, d.nome])), [mes]);

  if (editando) {
    return (
      <Formulario
        inicial={editando} produtos={produtos}
        aoSalvar={async (p) => { await salvarPublicacao(p); setEditando(null); await recarregar(); }}
        aoCancelar={() => setEditando(null)}
      />
    );
  }

  const proximos = posts.filter((p) => p.status !== 'publicado' && p.status !== 'descartado' && p.data >= hoje).slice(0, 3);

  return (
    <>
      <h1>Divulgação</h1>
      <p className="suave">Planeje o que vai mostrar, escreva legendas na voz do atelier, guarde as hashtags e acompanhe como cada publicação foi.</p>
      <div className="faixa" />

      <div className="linha" style={{ marginTop: 14 }}>
        {ABAS.map(([id, nome]) => (
          <button key={id} className="pilula" aria-pressed={aba === id} onClick={() => setAba(id)}>{nome}</button>
        ))}
        <button className="btn primario" style={{ marginLeft: 'auto' }} onClick={() => setEditando(nova(hoje))}>Nova publicação</button>
      </div>

      {proximos.length > 0 && aba !== 'resultados' && (
        <div className="aviso" style={{ marginTop: 12 }}>
          <strong>Próximas:</strong>{' '}
          {proximos.map((p) => `${dataParaTexto(p.data)} · ${p.titulo || 'sem título'}`).join('  |  ')}
        </div>
      )}

      {aba === 'calendario' && (
        <div className="cartao">
          <div className="linha">
            <button className="btn" onClick={() => setMes(mesSeguinte(mes, -1))} aria-label="Mês anterior">‹</button>
            <strong style={{ minWidth: 160, textAlign: 'center' }}>{nomeDoMes(mes)}</strong>
            <button className="btn" onClick={() => setMes(mesSeguinte(mes, 1))} aria-label="Próximo mês">›</button>
            <button className="btn" onClick={() => setMes(hoje.slice(0, 7))}>Hoje</button>
          </div>
          <div className="calendario">
            {DIAS.map((d) => <div key={d} className="dia-semana">{d}</div>)}
            {semanasDoMes(mes).flat().map((d) => {
              const ps = porDia.get(d.data) ?? [];
              const comemorativa = datas.get(d.data);
              return (
                <div key={d.data} className={`dia${d.doMes ? '' : ' fora'}${d.data === hoje ? ' hoje' : ''}`}
                  role="button" tabIndex={0} aria-label={`Dia ${dataParaTexto(d.data)}: nova publicação`}
                  onClick={() => setEditando(nova(d.data, comemorativa ?? ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditando(nova(d.data, comemorativa ?? '')); }}>
                  <span className="num">{Number(d.data.slice(8))}</span>
                  {comemorativa && <span className="data-comemorativa">{comemorativa}</span>}
                  {ps.map((p) => (
                    <span key={p.id} className={`chip ${p.status}`} title={`${STATUS_POST[p.status]} · ${p.titulo}`}
                      onClick={(e) => { e.stopPropagation(); setEditando(p); }}>{p.titulo || 'sem título'}</span>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="suave" style={{ fontSize: 13 }}>Toque em um dia para criar uma publicação, ou em uma publicação para abrir. Tracejado = ideia · cheio = publicado.</p>
        </div>
      )}

      {aba === 'lista' && (
        <div className="cartao">
          <div className="linha">
            {(['todos', 'ideia', 'criando', 'pronto', 'publicado', 'descartado'] as const).map((s) => (
              <button key={s} className="pilula" aria-pressed={filtro === s} onClick={() => setFiltro(s)}>{s === 'todos' ? 'Todas' : STATUS_POST[s]}</button>
            ))}
          </div>
          <table className="tabela" style={{ marginTop: 10 }}>
            <thead><tr><th>Data</th><th>Título</th><th>Canal</th><th>Situação</th></tr></thead>
            <tbody>
              {posts.filter((p) => filtro === 'todos' || p.status === filtro).map((p) => (
                <tr key={p.id} onClick={() => setEditando(p)} style={{ cursor: 'pointer' }}>
                  <td>{dataParaTexto(p.data)}</td><td>{p.titulo || 'sem título'}</td><td>{CANAIS[p.canal]}</td><td><span className="etiqueta">{STATUS_POST[p.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && <p className="suave">Nenhuma publicação ainda. Comece por uma ideia no calendário. 🌸</p>}
        </div>
      )}

      {aba === 'datas' && (
        <div className="cartao">
          <h2>Próximos 120 dias</h2>
          <p className="suave">Datas que costumam render bom conteúdo. Crie a ideia agora e deixe a legenda para depois.</p>
          <table className="tabela">
            <tbody>
              {proximasDatas(hoje, 120).map((d) => {
                const jaTem = posts.some((p) => p.data === d.data && p.titulo === d.nome);
                return (
                  <tr key={d.data + d.nome}>
                    <td>{dataParaTexto(d.data)}{d.aproximada ? ' (aprox.)' : ''}</td>
                    <td>{d.nome}</td>
                    <td style={{ textAlign: 'right' }}>
                      {jaTem ? <span className="ok">ideia criada</span> : (
                        <button className="btn" onClick={() => setEditando({ ...nova(d.data, d.nome), tipo: 'data' })}>Criar ideia</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'resultados' && <Resultados posts={posts} aoAbrir={setEditando} />}
    </>
  );
}

function Resultados({ posts, aoAbrir }: { posts: Publicacao[]; aoAbrir: (p: Publicacao) => void }) {
  const r = resumirResultados(posts);
  const publicados = posts.filter((p) => p.status === 'publicado').sort((a, b) => b.data.localeCompare(a.data));
  return (
    <div className="cartao">
      <h2>Como foram as publicações</h2>
      {r.publicados === 0 ? (
        <p className="suave">Ainda não há publicações marcadas como publicadas. Depois de postar, abra a publicação e preencha os números.</p>
      ) : (
        <>
          <p>
            <strong>{r.publicados}</strong> publicadas · alcance <strong>{r.alcance}</strong> · interações <strong>{r.engajamento}</strong> · conversas iniciadas <strong>{r.mensagens}</strong>
          </p>
          {r.melhor && <p className="suave">Mais querida: <strong>{r.melhor.titulo || 'sem título'}</strong> ({engajamento(r.melhor.metricas)} interações). 💜</p>}
          <table className="tabela">
            <thead><tr><th>Data</th><th>Título</th><th>Alcance</th><th>Interações</th><th>Conversas</th></tr></thead>
            <tbody>
              {publicados.map((p) => (
                <tr key={p.id} onClick={() => aoAbrir(p)} style={{ cursor: 'pointer' }}>
                  <td>{dataParaTexto(p.data)}</td><td>{p.titulo || 'sem título'}</td><td>{p.metricas.alcance}</td><td>{engajamento(p.metricas)}</td><td>{p.metricas.mensagens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const ROTULO_METRICA: [keyof Metricas, string][] = [
  ['alcance', 'Alcance'], ['curtidas', 'Curtidas'], ['comentarios', 'Comentários'], ['salvamentos', 'Salvamentos'], ['compartilhamentos', 'Compartilhamentos'], ['mensagens', 'Conversas iniciadas'],
];

function Formulario(p: { inicial: Publicacao; produtos: Produto[]; aoSalvar: (p: Publicacao) => Promise<void>; aoCancelar: () => void }) {
  const [v, setV] = useState<Publicacao>({ ...p.inicial, metricas: { ...METRICAS_ZERADAS, ...p.inicial.metricas } });
  const [hashTexto, setHashTexto] = useState(p.inicial.hashtags.join(' '));
  const [variacao, setVariacao] = useState(0);
  const [msg, setMsg] = useState('');
  const hashtags = limparHashtags(hashTexto);
  const avisos = conferirComAMarca(v.legenda, hashtags);
  const produto = p.produtos.find((x) => x.id === v.produtoId) ?? null;
  const link = enderecoSeguro(v.link);

  function sugerir() {
    if (!v.tipo) { setMsg('Escolha primeiro o tipo de legenda.'); return; }
    const r = gerarLegenda({ tipo: v.tipo, produto: produto?.nome ?? v.titulo, linha: produto?.linha ?? null, tema: v.titulo, variacao });
    setV({ ...v, legenda: r.legenda });
    setHashTexto(r.hashtags.join(' '));
    setVariacao(variacao + 1);
    setMsg('');
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoParaCopiar({ legenda: v.legenda, hashtags }));
      setMsg('Copiado. É só colar na rede. 🌸');
    } catch {
      setMsg('Não consegui copiar sozinho. Selecione o texto e copie.');
    }
  }
  const num = (k: keyof Metricas, s: string) => setV({ ...v, metricas: { ...v.metricas, [k]: Math.max(0, Math.round(Number(s) || 0)) } });

  return (
    <>
      <h1>{v.id ? 'Publicação' : 'Nova publicação'}</h1>
      <div className="faixa" />
      <div className="cartao">
        <div className="formgrid">
          <Campo rotulo="Título (para você se achar)"><input type="text" value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} /></Campo>
          <Campo rotulo="Canal">
            <select value={v.canal} onChange={(e) => setV({ ...v, canal: e.target.value as CanalPost })}>
              {Object.entries(CANAIS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data"><input type="date" value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
          <Campo rotulo="Hora (opcional)"><input type="text" placeholder="18:30" value={v.hora} onChange={(e) => setV({ ...v, hora: e.target.value })} /></Campo>
          <Campo rotulo="Situação">
            <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as StatusPost })}>
              {Object.entries(STATUS_POST).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Produto (opcional)">
            <select value={v.produtoId ?? ''} onChange={(e) => setV({ ...v, produtoId: e.target.value || null })}>
              <option value="">Nenhum</option>
              {p.produtos.filter((x) => x.ativo).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Campo>
        </div>
        {FORMATO_DO_CANAL[v.canal] && <p className="suave" style={{ fontSize: 13 }}>{FORMATO_DO_CANAL[v.canal]}</p>}
      </div>

      <div className="cartao">
        <h2>Legenda</h2>
        <div className="linha">
          <select aria-label="Tipo de legenda" value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoLegenda | '' })}>
            <option value="">Tipo de legenda…</option>
            {Object.entries(TIPOS_LEGENDA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <button className="btn" onClick={sugerir}>{variacao === 0 ? 'Sugerir legenda' : 'Outra variação'}</button>
        </div>
        <p className="suave" style={{ fontSize: 13 }}>A sugestão é um ponto de partida na voz do atelier. Ajuste com as suas palavras.</p>
        <textarea rows={7} aria-label="Legenda" value={v.legenda} onChange={(e) => setV({ ...v, legenda: e.target.value })} />
        <Campo rotulo="Hashtags (até 5)"><input type="text" value={hashTexto} onChange={(e) => setHashTexto(e.target.value)} /></Campo>
        <p className="suave" style={{ fontSize: 13 }}>{hashtags.join(' ')}</p>
        {avisos.length > 0 ? (
          <div className="aviso"><strong>Conferindo com a marca:</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{avisos.map((a) => <li key={a}>{a}</li>)}</ul></div>
        ) : (
          v.legenda.trim() && <p className="ok">Combina com a voz da marca. 💜</p>
        )}
        <div className="linha" style={{ marginTop: 10 }}>
          <button className="btn" onClick={copiar}>Copiar legenda + hashtags</button>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
      </div>

      <div className="cartao">
        <CampoFotos fotos={v.imagens ?? []} max={4} rotulo="Imagens da publicação (até 4)" aoMudar={(f) => setV({ ...v, imagens: f })} />
        <div className="formgrid">
          <Campo rotulo="Link da publicação (depois de postar)"><input type="text" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} /></Campo>
        </div>
        {link && <p><a href={link} target="_blank" rel="noopener noreferrer">Abrir publicação</a></p>}
        <Campo rotulo="Observações"><textarea rows={3} value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} /></Campo>
      </div>

      {v.status === 'publicado' && (
        <div className="cartao">
          <h2>Resultados</h2>
          <p className="suave" style={{ fontSize: 13 }}>Copie os números das estatísticas da rede alguns dias depois de postar.</p>
          <div className="formgrid">
            {ROTULO_METRICA.map(([k, nome]) => (
              <Campo key={k} rotulo={nome}><input type="number" min={0} value={v.metricas[k] || ''} onChange={(e) => num(k, e.target.value)} /></Campo>
            ))}
          </div>
        </div>
      )}

      <div className="linha" style={{ marginTop: 16 }}>
        <button className="btn primario" onClick={() => void p.aoSalvar({ ...v, hashtags })}>Salvar</button>
        <button className="btn" onClick={p.aoCancelar}>Voltar</button>
        {v.id && v.status !== 'descartado' && (
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void p.aoSalvar({ ...v, hashtags, status: 'descartado' })}>Descartar ideia</button>
        )}
      </div>
    </>
  );
}
