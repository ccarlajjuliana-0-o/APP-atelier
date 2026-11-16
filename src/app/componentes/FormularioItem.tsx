import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import {
  alternarEscolha, definirOutro, definirTexto, ehEscolha, ehTexto, ID_OUTRO, ID_TEXTO, opcaoDisponivel, trocarVariante, variantesDisponiveis,
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
  return (
    <div style={{ marginTop: 10 }}>
      {p.grupos.map((g) => {
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
                ? <textarea rows={3} style={{ width: '100%' }} value={v} onChange={(e) => p.aoMudar(definirTexto(p.escolhas, g, e.target.value))} />
                : <input type={g.tipo === 'email' ? 'email' : 'text'} style={{ width: '100%' }} value={v} onChange={(e) => p.aoMudar(definirTexto(p.escolhas, g, e.target.value))} />}
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
                  <button key={o.id} type="button" className={e ? 'btn primario' : 'btn'} onClick={() => p.aoMudar(alternarEscolha(p.escolhas, g, o, p.info, p.mult, p.unidades))}>
                    {o.nome}{acr > 0 ? ` +${centavosParaTexto(acr)}` : ''}{falta ? ' (estoque curto)' : ''}
                  </button>
                );
              })}
              {g.permiteOutro && (
                <button type="button" className={outro ? 'btn primario' : 'btn'} onClick={() => p.aoMudar(definirOutro(p.escolhas, g, outro ? null : ''))}>Outro</button>
              )}
            </div>
            {outro && (
              <input type="text" placeholder="Escreva aqui" style={{ width: '100%', marginTop: 6 }}
                value={outro.opcaoNome === 'Outro' ? '' : outro.opcaoNome}
                onChange={(e) => p.aoMudar(definirOutro(p.escolhas, g, e.target.value))} />
            )}
            {g.opcoes.filter((o) => o.variantes?.length && doGrupo.some((e) => e.opcaoId === o.id)).map((o) => {
              const atual = doGrupo.find((e) => e.opcaoId === o.id)?.materialId ?? '';
              const lista = variantesDisponiveis(o, p.info, p.unidades);
              const ids = atual && !lista.includes(atual) ? [atual, ...lista] : lista;
              return (
                <label key={o.id} className="campo" style={{ marginTop: 6 }}>
                  <span>{o.nome}: qual tipo?</span>
                  <select value={atual} onChange={(e) => p.aoMudar(trocarVariante(p.escolhas, g, o, e.target.value, p.info, p.mult))}>
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
