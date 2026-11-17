import { useEffect, useState } from 'react';
import type { Material } from '../../dados/db.ts';
import { extraNovo, listarExtras, salvarExtra } from '../../dados/extras.ts';
import type { ExtraCatalogo } from '../../dominio/extras.ts';
import { lerNumero } from '../../dominio/materiais.ts';

function reais(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

/** Extras: o que a cliente pode incluir a mais, cada um com seu valor. Aparecem como botões no orçamento e no pedido. */
export function ExtrasCatalogo(p: { materiais: Material[] }) {
  const [lista, setLista] = useState<ExtraCatalogo[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');

  async function carregar() {
    const l = await listarExtras();
    setLista(l);
    setValores(Object.fromEntries(l.map((e) => [e.id, reais(e.precoCentavos)])));
  }
  useEffect(() => { void carregar(); }, []);

  async function salvar(e: ExtraCatalogo, parte: Partial<ExtraCatalogo>) {
    await salvarExtra({ ...e, ...parte });
    await carregar();
  }
  async function salvarValor(e: ExtraCatalogo) {
    const v = lerNumero(valores[e.id] || '0');
    if (Number.isNaN(v) || v < 0) return setMsg('O valor precisa ser um número em reais.');
    setMsg('');
    await salvar(e, { precoCentavos: Math.round(v * 100) });
  }

  return (
    <div className="cartao">
      <h2>Extras (valor a mais)</h2>
      <p className="suave">
        O que a cliente pode incluir em um produto de encadernação. Cada extra soma o valor ao preço, e, se estiver ligado a um material, reserva o estoque.
        Em “Tipos” você liga vários materiais (ex.: modelos de cantoneira): a cliente só vê os que têm estoque.
      </p>
      {msg && <p className="aviso">{msg}</p>}
      {lista.map((e) => (
        <div key={e.id} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--borda, #0001)', opacity: e.ativo ? 1 : 0.55 }}>
          <div className="linha" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
            <label className="campo"><span>Extra</span>
              <input type="text" defaultValue={e.nome} onBlur={(x) => x.target.value.trim() && x.target.value !== e.nome && void salvar(e, { nome: x.target.value.trim() })} style={{ width: 170 }} />
            </label>
            <label className="campo"><span>Valor R$</span>
              <input type="text" inputMode="decimal" value={valores[e.id] ?? ''} onChange={(x) => setValores({ ...valores, [e.id]: x.target.value })} onBlur={() => void salvarValor(e)} style={{ width: 90 }} />
            </label>
            {e.variantes.length === 0 && (
              <label className="campo"><span>Material do estoque</span>
                <select value={e.materialId ?? ''} onChange={(x) => void salvar(e, { materialId: x.target.value || null })}>
                  <option value="">Nenhum</option>
                  {p.materiais.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </label>
            )}
            <label className="campo"><span>Pede texto? (ex.: Qual nome?)</span>
              <input type="text" defaultValue={e.pedeTexto} onBlur={(x) => x.target.value !== e.pedeTexto && void salvar(e, { pedeTexto: x.target.value.trim() })} style={{ width: 170 }} />
            </label>
            <button className="btn" onClick={() => void salvar(e, { ativo: !e.ativo })}>{e.ativo ? 'Desativar' : 'Ativar'}</button>
          </div>
          {e.precoCentavos === 0 && e.ativo && <div className="suave">Defina o valor deste extra.</div>}
          <details style={{ marginTop: 4 }}>
            <summary className="suave">Tipos do estoque ({e.variantes.length}){e.variantes.length ? '' : ' — opcional'}</summary>
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {p.materiais.map((m) => (
                <label key={m.id} className="linha" style={{ gap: 6 }}>
                  <input type="checkbox" checked={e.variantes.includes(m.id)}
                    onChange={(x) => void salvar(e, { variantes: x.target.checked ? [...e.variantes, m.id] : e.variantes.filter((v) => v !== m.id), materialId: null })} />
                  {m.nome}
                </label>
              ))}
            </div>
          </details>
        </div>
      ))}
      <div className="linha" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => void salvarExtra({ ...extraNovo(lista.length), nome: 'Novo extra' }).then(carregar)}>+ Novo extra</button>
        <span className="suave">Para um extra que vale só em um pedido, use “Outro extra” dentro do orçamento ou do pedido.</span>
      </div>
    </div>
  );
}
