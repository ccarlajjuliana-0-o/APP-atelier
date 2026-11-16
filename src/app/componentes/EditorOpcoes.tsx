import type { ReactNode } from 'react';
import type { Material } from '../../dados/db.ts';
import { novoId } from '../../dados/db.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import type { GrupoOpcoes, OpcaoProduto } from '../../dominio/opcoes.ts';
import type { InfoMaterial } from '../../dominio/produtos.ts';

export interface OpcaoForm { id: string; nome: string; materialId: string; quantidade: string; desperdicio: string; acrescimo: string; padrao: boolean }
export interface GrupoForm { id: string; nome: string; tipo: 'unica' | 'multipla'; obrigatorio: boolean; opcoes: OpcaoForm[] }

const txt = (n: number) => (n ? String(n).replace('.', ',') : '');
const num = (s: string) => { const v = lerNumero(s || '0'); return Number.isNaN(v) ? 0 : Math.max(0, v); };

export function gruposParaForm(gs: GrupoOpcoes[]): GrupoForm[] {
  return gs.map((g) => ({
    id: g.id, nome: g.nome, tipo: g.tipo, obrigatorio: g.obrigatorio,
    opcoes: g.opcoes.map((o) => ({
      id: o.id, nome: o.nome, materialId: o.materialId ?? '', quantidade: txt(o.quantidade), desperdicio: txt(o.desperdicioPct),
      acrescimo: o.acrescimoCentavos === null ? '' : (o.acrescimoCentavos / 100).toFixed(2).replace('.', ','), padrao: o.padrao,
    })),
  }));
}

export function gruposDoForm(gs: GrupoForm[]): GrupoOpcoes[] {
  return gs.map((g) => ({
    id: g.id, nome: g.nome.trim(), tipo: g.tipo, obrigatorio: g.obrigatorio,
    opcoes: g.opcoes.map((o): OpcaoProduto => ({
      id: o.id, nome: o.nome.trim(), materialId: o.materialId || null,
      quantidade: o.materialId ? (num(o.quantidade) || 1) : 0, desperdicioPct: num(o.desperdicio),
      acrescimoCentavos: o.acrescimo.trim() ? Math.round(num(o.acrescimo) * 100) : null, padrao: o.padrao,
    })),
  }));
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

export function EditorOpcoes(p: { grupos: GrupoForm[]; aoMudar: (g: GrupoForm[]) => void; materiais: Material[]; info: Record<string, InfoMaterial> }) {
  const { grupos } = p;
  const setG = (gi: number, parte: Partial<GrupoForm>) => p.aoMudar(grupos.map((g, k) => (k === gi ? { ...g, ...parte } : g)));
  const setO = (gi: number, oi: number, parte: Partial<OpcaoForm>) =>
    setG(gi, { opcoes: grupos[gi].opcoes.map((o, k) => (k === oi ? { ...o, ...parte } : o)) });
  const marcarPadrao = (gi: number, oi: number, v: boolean) => {
    const g = grupos[gi];
    setG(gi, { opcoes: g.opcoes.map((o, k) => (k === oi ? { ...o, padrao: v } : g.tipo === 'unica' && v ? { ...o, padrao: false } : o)) });
  };

  return (
    <>
      <h2 style={{ marginTop: 18 }}>Formulário personalizado</h2>
      <p className="suave">
        As escolhas que o cliente faz neste produto (cor do wire-o, número de páginas, elástico…). Cada opção pode usar um material do estoque:
        ela soma ao preço, reserva o material e some do formulário se acabar.
      </p>
      {grupos.map((g, gi) => (
        <div key={g.id} className="cartao" style={{ marginTop: 8, padding: 12 }}>
          <div className="formgrid">
            <Campo rotulo="Pergunta (ex.: Cor do wire-o)"><input type="text" value={g.nome} onChange={(e) => setG(gi, { nome: e.target.value })} /></Campo>
            <Campo rotulo="Tipo">
              <select value={g.tipo} onChange={(e) => setG(gi, { tipo: e.target.value as GrupoForm['tipo'] })}>
                <option value="unica">Escolhe uma</option>
                <option value="multipla">Pode escolher várias</option>
              </select>
            </Campo>
          </div>
          <label className="linha" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={g.obrigatorio} onChange={(e) => setG(gi, { obrigatorio: e.target.checked })} /> Obrigatória
          </label>
          {g.opcoes.map((o, oi) => {
            const m = o.materialId ? p.info[o.materialId] : null;
            return (
              <div key={o.id} className="linha" style={{ marginTop: 8, alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                <Campo rotulo="Opção"><input type="text" value={o.nome} onChange={(e) => setO(gi, oi, { nome: e.target.value })} style={{ width: 140 }} /></Campo>
                <Campo rotulo="Material do estoque">
                  <select value={o.materialId} onChange={(e) => setO(gi, oi, { materialId: e.target.value })}>
                    <option value="">Nenhum</option>
                    {p.materiais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </Campo>
                {o.materialId && (
                  <>
                    <Campo rotulo="Qtd"><input type="text" inputMode="decimal" value={o.quantidade} placeholder="1" onChange={(e) => setO(gi, oi, { quantidade: e.target.value })} style={{ width: 60 }} /></Campo>
                    <Campo rotulo="Perda %"><input type="text" inputMode="decimal" value={o.desperdicio} placeholder="0" onChange={(e) => setO(gi, oi, { desperdicio: e.target.value })} style={{ width: 56 }} /></Campo>
                  </>
                )}
                <Campo rotulo="Acréscimo R$ (vazio = automático)"><input type="text" inputMode="decimal" value={o.acrescimo} placeholder="auto" onChange={(e) => setO(gi, oi, { acrescimo: e.target.value })} style={{ width: 90 }} /></Campo>
                <label className="linha"><input type="checkbox" checked={o.padrao} onChange={(e) => marcarPadrao(gi, oi, e.target.checked)} /> Já marcada</label>
                {m && <span className="suave">em estoque: {m.disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>}
                <button className="btn" onClick={() => setG(gi, { opcoes: g.opcoes.filter((_, k) => k !== oi) })}>Remover</button>
              </div>
            );
          })}
          <div className="linha" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setG(gi, { opcoes: [...g.opcoes, { id: novoId(), nome: '', materialId: '', quantidade: '', desperdicio: '', acrescimo: '', padrao: false }] })}>+ Opção</button>
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => p.aoMudar(grupos.filter((_, k) => k !== gi))}>Remover pergunta</button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => p.aoMudar([...grupos, { id: novoId(), nome: '', tipo: 'unica', obrigatorio: false, opcoes: [] }])}>+ Adicionar pergunta</button>
      </div>
    </>
  );
}
