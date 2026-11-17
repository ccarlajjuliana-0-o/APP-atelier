import { useState } from 'react';
import { novoId } from '../../dados/db.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import { extrasComoGrupo, type ExtraCatalogo } from '../../dominio/extras.ts';
import {
  adicionarAvulso, alternarEscolha, definirOutro, definirTextoDaOpcao, definirTexto, ehEscolha, grupoVisivel, ID_EXTRAS, podarEscolhas, PREFIXO_AVULSO, removerEscolha, ehTexto, ID_OUTRO, ID_TEXTO, opcaoDisponivel, trocarVariante, variantesDisponiveis,
  type EscolhaItem, type GrupoOpcoes,
} from '../../dominio/opcoes.ts';
import type { InfoMaterial } from '../../dominio/produtos.ts';

const PEQUENO = { fontSize: 'calc(13px * var(--escala, 1))' } as const;

/** Perguntas do formulário de um produto, como a cliente vê. Opções sem estoque não aparecem. */
export function FormularioItem(p: {
  grupos: GrupoOpcoes[];
  escolhas: EscolhaItem[];
  unidades: number;
  info: Record<string, InfoMaterial>;
  mult: number;
  aoMudar: (e: EscolhaItem[]) => void;
}) {
  if (p.grupos.length === 0) return null;
  const mudar = (e: EscolhaItem[]) => p.aoMudar(podarEscolhas(p.grupos, e));
  return (
    <div style={{ marginTop: 10 }}>
      {p.grupos.map((g) => {
        if (!grupoVisivel(g, p.grupos, p.escolhas)) return null;
        if (g.tipo === 'secao') {
          return (
            <div key={g.id} style={{ marginTop: 14 }}>
              <h3 style={{ margin: 0 }}>{g.nome}</h3>
              {g.descricao && <div className="suave" style={PEQUENO}>{g.descricao}</div>}
            </div>
          );
        }
        const doGrupo = p.escolhas.filter((e) => e.grupoId === g.id);
        const cabeca = (
          <>
            <strong>{g.nome}</strong>{g.obrigatorio && ' *'}{' '}
            <span className="suave">{g.tipo === 'multipla' ? '(pode marcar várias)' : ''}</span>
            {g.descricao && <div className="suave" style={PEQUENO}>{g.descricao}</div>}
          </>
        );
        if (ehTexto(g.tipo)) {
          const v = doGrupo.find((e) => e.opcaoId === ID_TEXTO)?.opcaoNome ?? '';
          return (
            <div key={g.id} style={{ marginTop: 8 }}>
              {cabeca}
              {g.tipo === 'paragrafo'
                ? <textarea rows={3} style={{ width: '100%' }} value={v} onChange={(e) => mudar(definirTexto(p.escolhas, g, e.target.value))} />
                : <input type={g.tipo === 'email' ? 'email' : 'text'} style={{ width: '100%' }} value={v} onChange={(e) => mudar(definirTexto(p.escolhas, g, e.target.value))} />}
            </div>
          );
        }
        if (!ehEscolha(g.tipo)) return null;
        const visiveis = g.opcoes.filter((o) => opcaoDisponivel(o, p.info, p.unidades) || doGrupo.some((e) => e.opcaoId === o.id));
        if (visiveis.length === 0 && !g.permiteOutro) return null;
        const outro = doGrupo.find((e) => e.opcaoId === ID_OUTRO);
        return (
          <div key={g.id} style={{ marginTop: 8 }}>
            {cabeca}
            <div className="linha" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {visiveis.map((o) => {
                const e = doGrupo.find((x) => x.opcaoId === o.id);
                const acr = e ? e.acrescimoCentavos : alternarEscolha([], g, o, p.info, p.mult, p.unidades)[0].acrescimoCentavos;
                const falta = !!e && !opcaoDisponivel(o, p.info, p.unidades);
                return (
                  <button key={o.id} type="button" className={e ? 'btn primario' : 'btn'} onClick={() => mudar(alternarEscolha(p.escolhas, g, o, p.info, p.mult, p.unidades))}>
                    {o.nome}{acr > 0 ? ` +${centavosParaTexto(acr)}` : ''}{falta ? ' (estoque curto)' : ''}
                  </button>
                );
              })}
              {g.permiteOutro && (
                <button type="button" className={outro ? 'btn primario' : 'btn'} onClick={() => mudar(definirOutro(p.escolhas, g, outro ? null : ''))}>Outro</button>
              )}
            </div>
            {outro && (
              <input type="text" placeholder="Escreva aqui" style={{ width: '100%', marginTop: 6 }}
                value={outro.opcaoNome === 'Outro' ? '' : outro.opcaoNome}
                onChange={(e) => mudar(definirOutro(p.escolhas, g, e.target.value))} />
            )}
            {g.opcoes.filter((o) => o.pedeTexto && doGrupo.some((e) => e.opcaoId === o.id)).map((o) => (
              <label key={o.id} className="campo" style={{ marginTop: 6 }}>
                <span>{o.pedeTexto} *</span>
                <input type="text" value={doGrupo.find((e) => e.opcaoId === o.id)?.texto ?? ''}
                  onChange={(e) => mudar(definirTextoDaOpcao(p.escolhas, g, o, e.target.value, p.info, p.mult))} />
              </label>
            ))}
            {g.opcoes.filter((o) => o.variantes?.length && doGrupo.some((e) => e.opcaoId === o.id)).map((o) => {
              const atual = doGrupo.find((e) => e.opcaoId === o.id)?.materialId ?? '';
              const lista = variantesDisponiveis(o, p.info, p.unidades);
              const ids = atual && !lista.includes(atual) ? [atual, ...lista] : lista;
              return (
                <label key={o.id} className="campo" style={{ marginTop: 6 }}>
                  <span>{o.nome}: qual tipo?</span>
                  <select value={atual} onChange={(e) => mudar(trocarVariante(p.escolhas, g, o, e.target.value, p.info, p.mult))}>
                    {ids.map((id) => <option key={id} value={id}>{p.info[id]?.nome ?? '—'}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Variações do produto ou perguntas do orçamento, mais os extras do catálogo (botões com valor) e extras avulsos. */
export function PersonalizacaoDoItem(p: {
  grupos: GrupoOpcoes[]; // variações do produto, ou as perguntas do orçamento personalizado
  extras: ExtraCatalogo[] | null; // null = sem extras
  escolhas: EscolhaItem[];
  unidades: number;
  info: Record<string, InfoMaterial>;
  mult: number;
  aoMudar: (e: EscolhaItem[]) => void;
}) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const grupoExtras = p.extras ? extrasComoGrupo(p.extras) : null;
  const todos = grupoExtras && grupoExtras.opcoes.length ? [...p.grupos, grupoExtras] : p.grupos;
  const avulsos = p.escolhas.filter((e) => e.grupoId === ID_EXTRAS && e.opcaoId.startsWith(PREFIXO_AVULSO));

  function incluir() {
    const v = lerNumero(valor || '0');
    if (!nome.trim() || Number.isNaN(v) || v < 0) return;
    p.aoMudar(adicionarAvulso(p.escolhas, novoId(), nome, Math.round(v * 100)));
    setNome('');
    setValor('');
  }

  return (
    <>
      <FormularioItem grupos={todos} escolhas={p.escolhas} unidades={p.unidades} info={p.info} mult={p.mult} aoMudar={p.aoMudar} />
      {p.extras && (
        <div style={{ marginTop: 10 }}>
          <strong>Outro extra (escreva e coloque o valor)</strong>
          {avulsos.map((a) => (
            <div key={a.opcaoId} className="linha" style={{ marginTop: 4 }}>
              <span>{a.opcaoNome} +{centavosParaTexto(a.acrescimoCentavos)}</span>
              <button type="button" className="btn" onClick={() => p.aoMudar(removerEscolha(p.escolhas, a.grupoId, a.opcaoId))}>Tirar</button>
            </div>
          ))}
          <div className="linha" style={{ marginTop: 4, flexWrap: 'wrap', gap: 6 }}>
            <input type="text" placeholder="Ex.: chaveiro" value={nome} onChange={(e) => setNome(e.target.value)} style={{ width: 180 }} />
            <input type="text" inputMode="decimal" placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 100 }} />
            <button type="button" className="btn" onClick={incluir}>+ Incluir</button>
          </div>
        </div>
      )}
    </>
  );
}
