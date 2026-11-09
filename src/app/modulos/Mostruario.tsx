import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { db, type MostruarioRegistro } from '../../dados/db.ts';
import { importarPacote } from '../../dados/mostruario.ts';
import { filtrar } from '../../dominio/mostruario.ts';

const TAMANHOS = ['A4', 'A5', 'A6', 'Colegial'];

export function Mostruario() {
  const [itens, setItens] = useState<MostruarioRegistro[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<'modelo' | 'adesivo'>('modelo');
  const [tamanho, setTamanho] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  async function recarregar() {
    const lista = await db.mostruario.toArray();
    setItens(lista);
    setUrls((antigas) => {
      Object.values(antigas).forEach(URL.revokeObjectURL);
      return Object.fromEntries(lista.map((i) => [i.id, URL.createObjectURL(i.previa)]));
    });
  }
  useEffect(() => {
    void recarregar();
  }, []);

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    setErro('');
    setMsg('');
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const r = await importarPacote(arquivo);
      setMsg(`${r.total} itens importados${r.nuvem ? ' e enviados à nuvem' : ' (só neste aparelho; a nuvem entra com o login)'}.`);
      await recarregar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui importar este arquivo.');
    }
  }

  async function alternar(i: MostruarioRegistro) {
    await db.mostruario.update(i.id, { visivel: !i.visivel });
    await recarregar();
  }

  const visiveis = useMemo(() => filtrar(itens, aba, tamanho || undefined), [itens, aba, tamanho]);
  const ocultos = itens.filter((i) => i.tipo === aba && !i.visivel);

  return (
    <>
      <h1>Mostruário</h1>
      <p className="suave">Modelos de páginas e adesivos para o cliente escolher. Vêm do Estúdio de Miolos: baixe o pacote lá e importe aqui.</p>
      <div className="faixa" />
      <div className="cartao">
        <div className="linha">
          <label className="btn primario" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Importar pacote (.json)
            <input type="file" accept=".json,application/json" hidden onChange={(e) => void aoEscolher(e)} />
          </label>
          <button className="pilula" aria-pressed={aba === 'modelo'} onClick={() => setAba('modelo')}>Modelos de página</button>
          <button className="pilula" aria-pressed={aba === 'adesivo'} onClick={() => setAba('adesivo')}>Adesivos</button>
          {aba === 'modelo' && (
            <select value={tamanho} onChange={(e) => setTamanho(e.target.value)} aria-label="Tamanho">
              <option value="">Todos os tamanhos</option>
              {TAMANHOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
        </div>
        {msg && <p className="ok">{msg}</p>}
        {erro && <p className="aviso">{erro}</p>}
      </div>
      {itens.length === 0 ? (
        <div className="cartao suave">Nada por aqui ainda. Importe o pacote do Estúdio de Miolos para ver os modelos e adesivos.</div>
      ) : (
        <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {visiveis.map((i) => (
            <div className="cartao" key={i.id}>
              <img src={urls[i.id]} alt={i.nome} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
              <h2 style={{ marginTop: 10 }}>{i.nome}</h2>
              <div className="linha">
                {i.categoria && <span className="etiqueta">{i.categoria}</span>}
                {i.tamanhos.map((t) => <span className="etiqueta" key={t}>{t}</span>)}
              </div>
              {i.descricao && <p className="suave">{i.descricao}</p>}
              <button className="btn" onClick={() => void alternar(i)}>Ocultar</button>
            </div>
          ))}
          {ocultos.map((i) => (
            <div className="cartao" key={i.id} style={{ opacity: 0.6 }}>
              <img src={urls[i.id]} alt={i.nome} style={{ width: '100%', borderRadius: 12, display: 'block' }} />
              <h2 style={{ marginTop: 10 }}>{i.nome}</h2>
              <span className="etiqueta">oculto</span>
              <div><button className="btn" onClick={() => void alternar(i)}>Mostrar de novo</button></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
