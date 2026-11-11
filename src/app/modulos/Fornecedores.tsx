import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Fornecedor } from '../../dados/db.ts';
import { listarFornecedores, resumosPorFornecedor, salvarFornecedor } from '../../dados/fornecedores.ts';
import type { ResumoFornecedor } from '../../dominio/fornecedores.ts';
import { CATEGORIAS, type Categoria } from '../../dominio/materiais.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';

function novo(): Fornecedor {
  return { id: '', nome: '', contato: '', email: '', link: '', categorias: [], observacoes: '', ativo: true, atualizadoEm: '' };
}

/** Só endereços http(s) viram link clicável. */
function enderecoSeguro(s: string): string | null {
  const t = s.trim();
  const url = /^https?:\/\//i.test(t) ? t : t ? `https://${t}` : '';
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

export function Fornecedores() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [resumos, setResumos] = useState<Record<string, ResumoFornecedor>>({});
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [arquivados, setArquivados] = useState(false);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    const l = await listarFornecedores();
    setLista(l);
    setResumos(await resumosPorFornecedor(l.map((f) => f.nome)));
  }
  useEffect(() => {
    void recarregar();
  }, []);
  useEffect(() => {
    if (editando) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editando?.id, editando === null]);

  const visiveis = lista.filter((f) => (arquivados ? !f.ativo : f.ativo));

  return (
    <>
      <h1>Fornecedores</h1>
      <p className="suave">Onde você compra cada material. O nome cadastrado aqui aparece como sugestão ao registrar uma compra, e as compras com esse nome entram no histórico do fornecedor.</p>
      <div className="faixa" />
      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setEditando(novo())}>Novo fornecedor</button>
          <label className="linha" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Ver arquivados
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
      </div>

      {editando && (
        <div ref={painelRef}>
          <Form
            key={editando.id || 'novo'}
            inicial={editando}
            fechar={() => setEditando(null)}
            aoSalvar={async (t) => {
              setMsg(t);
              setEditando(null);
              await recarregar();
            }}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <div className="cartao suave">Nenhum fornecedor ainda. Cadastre os lugares onde você costuma comprar papel, wire-o, filamento e acabamentos.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Fornecedor</th><th>Contato</th><th>Vende</th><th>Compras</th><th /></tr>
            </thead>
            <tbody>
              {visiveis.map((f) => {
                const r = resumos[f.nome];
                const href = enderecoSeguro(f.link);
                return (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.nome}</strong>
                      {f.observacoes && <div className="suave" style={{ fontSize: 13 }}>{f.observacoes}</div>}
                    </td>
                    <td>
                      {f.contato || '—'}
                      {f.email && <div className="suave" style={{ fontSize: 13 }}>{f.email}</div>}
                      {href && <div><a href={href} target="_blank" rel="noopener noreferrer">Abrir site</a></div>}
                    </td>
                    <td>{f.categorias.length ? f.categorias.map((c) => CATEGORIAS[c as Categoria] ?? c).join(', ') : '—'}</td>
                    <td>
                      {r && r.compras > 0 ? (
                        <>
                          {r.compras} · {centavosParaTexto(r.totalCentavos)}
                          <div className="suave" style={{ fontSize: 12 }}>última em {r.ultima ? new Date(r.ultima).toLocaleDateString('pt-BR') : '—'}</div>
                        </>
                      ) : 'nenhuma ainda'}
                    </td>
                    <td><div className="linha" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setEditando(f)}>Editar</button></div></td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && <tr><td colSpan={5} className="suave">Nada nesta lista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Form(p: { inicial: Fornecedor; fechar: () => void; aoSalvar: (m: string) => Promise<void> }) {
  const [f, setF] = useState<Fornecedor>(p.inicial);
  const [erro, setErro] = useState('');

  function alternar(c: string) {
    setF({ ...f, categorias: f.categorias.includes(c) ? f.categorias.filter((x) => x !== c) : [...f.categorias, c] });
  }

  async function salvar(ativo = f.ativo) {
    const nome = f.nome.trim();
    if (!nome) return setErro('Dê um nome ao fornecedor.');
    const link = f.link.trim();
    if (link && !enderecoSeguro(link)) return setErro('O endereço do site não parece válido.');
    await salvarFornecedor({ ...f, nome, link, ativo });
    await p.aoSalvar(ativo === f.ativo ? `“${nome}” salvo.` : ativo ? `“${nome}” voltou para a lista.` : `“${nome}” arquivado.`);
  }

  return (
    <div className="cartao">
      <h2>{p.inicial.id ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Telefone ou WhatsApp"><input type="text" inputMode="tel" value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} /></Campo>
        <Campo rotulo="E-mail"><input type="text" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Campo>
        <Campo rotulo="Site ou loja online"><input type="text" inputMode="url" placeholder="https://" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Campo>
      </div>
      <div className="suave" style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>O que vende</div>
      <div className="linha">
        {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
          <button key={c} className="pilula" aria-pressed={f.categorias.includes(c)} onClick={() => alternar(c)}>{CATEGORIAS[c]}</button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Campo rotulo="Observações (prazo de entrega, frete, condições…)">
          <input type="text" value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
        </Campo>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
        {p.inicial.id && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void salvar(!f.ativo)}>{f.ativo ? 'Arquivar' : 'Desarquivar'}</button>}
      </div>
    </div>
  );
}
