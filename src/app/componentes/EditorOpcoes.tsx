import type { ReactNode } from 'react';
import type { Material } from '../../dados/db.ts';
import { novoId } from '../../dados/db.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import { TIPOS_GRUPO, condicoesDe, ehEscolha, type Condicao, type GrupoOpcoes, type OpcaoProduto, type TipoGrupo } from '../../dominio/opcoes.ts';
import { formularioPadrao } from '../../dominio/formularioPadrao.ts';
import type { InfoMaterial } from '../../dominio/produtos.ts';

export interface OpcaoForm { id: string; nome: string; materialId: string; quantidade: string; desperdicio: string; acrescimo: string; padrao: boolean; variantes: string[]; pedeTexto: string }
export interface GrupoForm { id: string; nome: string; descricao: string; tipo: TipoGrupo; obrigatorio: boolean; permiteOutro: boolean; condicoes: Condicao[]; maxSelecao: string; opcoes: OpcaoForm[] }

const txt = (n: number) => (n ? String(n).replace('.', ',') : '');
const num = (s: string) => { const v = lerNumero(s || '0'); return Number.isNaN(v) ? 0 : Math.max(0, v); };

export function gruposParaForm(gs: GrupoOpcoes[]): GrupoForm[] {
  return gs.map((g) => ({
    id: g.id, nome: g.nome, descricao: g.descricao ?? '', tipo: g.tipo, obrigatorio: g.obrigatorio, permiteOutro: !!g.permiteOutro, condicoes: condicoesDe(g), maxSelecao: g.maxSelecao ? String(g.maxSelecao) : '',
    opcoes: g.opcoes.map((o) => ({
      id: o.id, nome: o.nome, materialId: o.materialId ?? '', quantidade: txt(o.quantidade), desperdicio: txt(o.desperdicioPct),
      acrescimo: o.acrescimoCentavos === null ? '' : (o.acrescimoCentavos / 100).toFixed(2).replace('.', ','), padrao: o.padrao, variantes: o.variantes ?? [], pedeTexto: o.pedeTexto ?? '',
    })),
  }));
}

export function gruposDoForm(gs: GrupoForm[]): GrupoOpcoes[] {
  return gs.map((g) => ({
    id: g.id, nome: g.nome.trim(), ...(g.descricao.trim() ? { descricao: g.descricao.trim() } : {}), tipo: g.tipo, obrigatorio: g.tipo === 'secao' ? false : g.obrigatorio,
    ...(g.permiteOutro && ehEscolha(g.tipo) ? { permiteOutro: true } : {}),
    ...(g.condicoes.some((c) => c.grupoId && c.opcaoIds.length) ? { mostrarSe: g.condicoes.filter((c) => c.grupoId && c.opcaoIds.length) } : {}),
    ...(g.tipo === 'multipla' && num(g.maxSelecao) >= 1 ? { maxSelecao: Math.round(num(g.maxSelecao)) } : {}),
    opcoes: (ehEscolha(g.tipo) ? g.opcoes : []).map((o): OpcaoProduto => ({
      id: o.id, nome: o.nome.trim(), materialId: o.variantes.length ? null : o.materialId || null,
      ...(o.variantes.length ? { variantes: o.variantes } : {}),
      ...(o.pedeTexto.trim() ? { pedeTexto: o.pedeTexto.trim() } : {}),
      quantidade: o.materialId || o.variantes.length ? (num(o.quantidade) || 1) : 0, desperdicioPct: num(o.desperdicio),
      acrescimoCentavos: o.acrescimo.trim() ? Math.round(num(o.acrescimo) * 100) : null, padrao: o.padrao,
    })),
  }));
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

export function EditorOpcoes(p: { catalogo: boolean; titulo?: string; explicacao?: string; grupos: GrupoForm[]; aoMudar: (g: GrupoForm[]) => void; materiais: Material[]; info: Record<string, InfoMaterial> }) {
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
      <h2 style={{ marginTop: 18 }}>{p.titulo ?? (p.catalogo ? 'Variações do produto (opcional)' : 'Perguntas do formulário')}</h2>
      <p className="suave">
        {p.explicacao ?? (p.catalogo
          ? 'Trocas que a cliente pode fazer neste produto pronto, como a cor da capa (azul já marcada, roxo opcional). Use 0,00 no acréscimo para uma opção sem custo, como a cor padrão. Elástico, cantoneira etc. ficam em Extras.'
          : 'As perguntas que a cliente responde para montar o produto do zero (cores, estilo, versão, miolos…). Cada opção pode ter um valor a mais e/ou um material do estoque, que fica reservado e some se acabar.')}
      </p>
      {grupos.map((g, gi) => (
        <div key={g.id} className="cartao" style={{ marginTop: 8, padding: 12 }}>
          <div className="formgrid">
            <Campo rotulo={g.tipo === 'secao' ? 'Título da seção' : 'Pergunta (ex.: Cor do wire-o)'}><input type="text" value={g.nome} onChange={(e) => setG(gi, { nome: e.target.value })} /></Campo>
            <Campo rotulo="Tipo">
              <select value={g.tipo} onChange={(e) => setG(gi, { tipo: e.target.value as TipoGrupo })}>
                {(Object.keys(TIPOS_GRUPO) as TipoGrupo[]).map((t) => <option key={t} value={t}>{TIPOS_GRUPO[t]}</option>)}
              </select>
            </Campo>
          </div>
          <div style={{ marginTop: 6 }}>
            <Campo rotulo="Explicação (opcional)"><input type="text" value={g.descricao} onChange={(e) => setG(gi, { descricao: e.target.value })} /></Campo>
          </div>
          {g.tipo !== 'secao' && (
            <div className="linha" style={{ marginTop: 6, gap: 16 }}>
              <label className="linha"><input type="checkbox" checked={g.obrigatorio} onChange={(e) => setG(gi, { obrigatorio: e.target.checked })} /> Obrigatória</label>
              {ehEscolha(g.tipo) && (
                <label className="linha"><input type="checkbox" checked={g.permiteOutro} onChange={(e) => setG(gi, { permiteOutro: e.target.checked })} /> Permitir “Outro:”</label>
              )}
            </div>
          )}
          {g.tipo === 'multipla' && (
            <div style={{ marginTop: 6 }}>
              <Campo rotulo="Limite de respostas (vazio = sem limite)">
                <input type="text" inputMode="numeric" value={g.maxSelecao} onChange={(e) => setG(gi, { maxSelecao: e.target.value })} style={{ width: 80 }} />
              </Campo>
            </div>
          )}
          {grupos.slice(0, gi).some((x) => ehEscolha(x.tipo)) && (
            <details style={{ marginTop: 6 }} open={g.condicoes.length > 0}>
              <summary className="suave">{g.condicoes.length ? 'Só aparece em certos casos' : 'Aparecer só em certos casos (opcional)'}</summary>
              {g.condicoes.map((c, ci) => (
                <div key={ci} style={{ marginTop: 8, paddingLeft: 8, borderLeft: '3px solid var(--borda, #0002)' }}>
                  <div className="linha" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span>{ci === 0 ? 'Só mostrar se' : 'ou se'}</span>
                    <select value={c.grupoId} onChange={(e) => setG(gi, { condicoes: g.condicoes.map((x, k) => (k === ci ? { grupoId: e.target.value, opcaoIds: [] } : x)) })}>
                      <option value="">— escolha a pergunta —</option>
                      {grupos.slice(0, gi).filter((x) => ehEscolha(x.tipo)).map((x) => <option key={x.id} value={x.id}>{x.nome || '(sem nome)'}</option>)}
                    </select>
                    <button className="btn" onClick={() => setG(gi, { condicoes: g.condicoes.filter((_, k) => k !== ci) })}>Tirar</button>
                  </div>
                  {c.grupoId && <span className="suave">a resposta for:</span>}
                  {(grupos.find((x) => x.id === c.grupoId)?.opcoes ?? []).map((op) => (
                    <label key={op.id} className="linha" style={{ gap: 6 }}>
                      <input type="checkbox" checked={c.opcaoIds.includes(op.id)}
                        onChange={(e) => setG(gi, { condicoes: g.condicoes.map((x, k) => (k === ci ? { ...x, opcaoIds: e.target.checked ? [...x.opcaoIds, op.id] : x.opcaoIds.filter((v) => v !== op.id) } : x)) })} />
                      {op.nome}
                    </label>
                  ))}
                </div>
              ))}
              <div style={{ marginTop: 6 }}>
                <button className="btn" onClick={() => setG(gi, { condicoes: [...g.condicoes, { grupoId: '', opcaoIds: [] }] })}>{g.condicoes.length ? '+ ou outra condição' : '+ Condição'}</button>
              </div>
            </details>
          )}
          {ehEscolha(g.tipo) && g.opcoes.map((o, oi) => {
            const m = o.materialId ? p.info[o.materialId] : null;
            const temVar = o.variantes.length > 0;
            return (
              <div key={o.id} style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--borda, #0001)' }}>
                <div className="linha" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                  <Campo rotulo="Opção"><input type="text" value={o.nome} onChange={(e) => setO(gi, oi, { nome: e.target.value })} style={{ width: 160 }} /></Campo>
                  {!temVar && (
                    <Campo rotulo="Material do estoque">
                      <select value={o.materialId} onChange={(e) => setO(gi, oi, { materialId: e.target.value })}>
                        <option value="">Nenhum</option>
                        {p.materiais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    </Campo>
                  )}
                  {(o.materialId || temVar) && (
                    <>
                      <Campo rotulo="Qtd"><input type="text" inputMode="decimal" value={o.quantidade} placeholder="1" onChange={(e) => setO(gi, oi, { quantidade: e.target.value })} style={{ width: 60 }} /></Campo>
                      <Campo rotulo="Perda %"><input type="text" inputMode="decimal" value={o.desperdicio} placeholder="0" onChange={(e) => setO(gi, oi, { desperdicio: e.target.value })} style={{ width: 56 }} /></Campo>
                    </>
                  )}
                  <Campo rotulo="Acréscimo R$ (vazio = automático)"><input type="text" inputMode="decimal" value={o.acrescimo} placeholder="ex.: 6,00" onChange={(e) => setO(gi, oi, { acrescimo: e.target.value })} style={{ width: 100 }} /></Campo>
                  <label className="linha"><input type="checkbox" checked={o.padrao} onChange={(e) => marcarPadrao(gi, oi, e.target.checked)} /> Já marcada</label>
                  {m && <span className="suave">em estoque: {m.disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>}
                  <button className="btn" onClick={() => setG(gi, { opcoes: g.opcoes.filter((_, k) => k !== oi) })}>Remover</button>
                </div>
                <div style={{ marginTop: 6 }}>
                  <Campo rotulo="Pede um texto à cliente? (ex.: Qual nome na capa? — vazio = não pede)">
                    <input type="text" value={o.pedeTexto} onChange={(e) => setO(gi, oi, { pedeTexto: e.target.value })} />
                  </Campo>
                </div>
                <details style={{ marginTop: 6 }}>
                  <summary className="suave">Deixar escolher o tipo entre materiais do estoque ({o.variantes.length})</summary>
                  <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>
                    Ex.: opção “Cantoneira” +R$ 6,00 e aqui os modelos de cantoneira. A cliente só vê os que têm estoque.
                  </p>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {p.materiais.map((x) => (
                      <label key={x.id} className="linha" style={{ gap: 6 }}>
                        <input type="checkbox" checked={o.variantes.includes(x.id)}
                          onChange={(e) => setO(gi, oi, { variantes: e.target.checked ? [...o.variantes, x.id] : o.variantes.filter((v) => v !== x.id), materialId: '' })} />
                        {x.nome} <span className="suave">({(p.info[x.id]?.disponivel ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })})</span>
                      </label>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
          <div className="linha" style={{ marginTop: 8 }}>
            {ehEscolha(g.tipo) && (
              <button className="btn" onClick={() => setG(gi, { opcoes: [...g.opcoes, { id: novoId(), nome: '', materialId: '', quantidade: '', desperdicio: '', acrescimo: '', padrao: false, variantes: [], pedeTexto: '' }] })}>+ Opção</button>
            )}
            <button className="btn" disabled={gi === 0} onClick={() => p.aoMudar(mover(grupos, gi, -1))}>↑</button>
            <button className="btn" disabled={gi === grupos.length - 1} onClick={() => p.aoMudar(mover(grupos, gi, 1))}>↓</button>
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => p.aoMudar(grupos.filter((_, k) => k !== gi))}>Remover pergunta</button>
          </div>
        </div>
      ))}
      <div className="linha" style={{ marginTop: 8, gap: 8 }}>
        <button className="btn" onClick={() => p.aoMudar([...grupos, { id: novoId(), nome: '', descricao: '', tipo: 'unica', obrigatorio: false, permiteOutro: false, condicoes: [], maxSelecao: '', opcoes: [] }])}>+ Adicionar pergunta</button>
        <button className="btn" onClick={() => p.aoMudar([...grupos, ...gruposParaForm(formularioPadrao(novoId))])}>+ Adicionar perguntas padrão</button>
      </div>
    </>
  );
}

function mover<T>(l: T[], i: number, d: number): T[] {
  const n = [...l];
  [n[i], n[i + d]] = [n[i + d], n[i]];
  return n;
}
