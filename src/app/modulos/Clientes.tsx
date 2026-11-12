import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Cliente } from '../../dados/db.ts';
import { listarClientes, resumosPorCliente, salvarCliente, type ResumoCliente } from '../../dados/pedidos.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';

function novo(): Cliente {
  return { id: '', nome: '', contato: '', email: '', origem: '', observacoes: '', ativo: true, atualizadoEm: '' };
}

const ORIGENS = ['Instagram', 'WhatsApp', 'Shopee', 'Mercado Livre', 'Site', 'Indicação', 'Feira ou evento'];

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

export function Clientes() {
  const [lista, setLista] = useState<Cliente[]>([]);
  const [resumos, setResumos] = useState<Record<string, ResumoCliente>>({});
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [arquivados, setArquivados] = useState(false);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);

  async function recarregar() {
    setLista(await listarClientes());
    setResumos(await resumosPorCliente());
  }
  useEffect(() => {
    void recarregar();
  }, []);
  useEffect(() => {
    if (editando) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editando?.id, editando === null]);

  const visiveis = lista.filter((c) => (arquivados ? !c.ativo : c.ativo));

  return (
    <>
      <h1>Clientes</h1>
      <p className="suave">Quem compra de você. Os pedidos ficam ligados ao cliente, e aqui você vê quantos pedidos e quanto cada um já comprou.</p>
      <div className="faixa" />
      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setEditando(novo())}>Novo cliente</button>
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
        <div className="cartao suave">Nenhum cliente ainda. Você também pode cadastrar o cliente direto na tela de um pedido.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr><th>Cliente</th><th>Contato</th><th>Origem</th><th>Pedidos</th><th /></tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const r = resumos[c.id];
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.nome}</strong>
                      {c.observacoes && <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{c.observacoes}</div>}
                    </td>
                    <td>
                      {c.contato || '—'}
                      {c.email && <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{c.email}</div>}
                    </td>
                    <td>{c.origem || '—'}</td>
                    <td>
                      {r ? (
                        <>
                          {r.pedidos} · {centavosParaTexto(r.totalCentavos)}
                          <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>último em {r.ultimo ? new Date(r.ultimo).toLocaleDateString('pt-BR') : '—'}</div>
                        </>
                      ) : 'nenhum ainda'}
                    </td>
                    <td><div className="linha" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setEditando(c)}>Editar</button></div></td>
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

function Form(p: { inicial: Cliente; fechar: () => void; aoSalvar: (m: string) => Promise<void> }) {
  const [c, setC] = useState<Cliente>(p.inicial);
  const [erro, setErro] = useState('');

  async function salvar(ativo = c.ativo) {
    const nome = c.nome.trim();
    if (!nome) return setErro('Dê um nome ao cliente.');
    await salvarCliente({ ...c, nome, ativo });
    await p.aoSalvar(ativo === c.ativo ? `“${nome}” salvo.` : ativo ? `“${nome}” voltou para a lista.` : `“${nome}” arquivado.`);
  }

  return (
    <div className="cartao">
      <h2>{p.inicial.id ? 'Editar cliente' : 'Novo cliente'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} /></Campo>
        <Campo rotulo="Telefone ou WhatsApp"><input type="text" inputMode="tel" value={c.contato} onChange={(e) => setC({ ...c, contato: e.target.value })} /></Campo>
        <Campo rotulo="E-mail"><input type="text" inputMode="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Campo>
        <Campo rotulo="Como chegou até você">
          <input type="text" list="origens-cliente" value={c.origem} onChange={(e) => setC({ ...c, origem: e.target.value })} />
          <datalist id="origens-cliente">{ORIGENS.map((o) => <option key={o} value={o} />)}</datalist>
        </Campo>
      </div>
      <div style={{ marginTop: 12 }}>
        <Campo rotulo="Observações (gostos, cores preferidas, datas importantes…)">
          <input type="text" value={c.observacoes} onChange={(e) => setC({ ...c, observacoes: e.target.value })} />
        </Campo>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar</button>
        <button className="btn" onClick={p.fechar}>Cancelar</button>
        {p.inicial.id && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void salvar(!c.ativo)}>{c.ativo ? 'Arquivar' : 'Desarquivar'}</button>}
      </div>
    </div>
  );
}
