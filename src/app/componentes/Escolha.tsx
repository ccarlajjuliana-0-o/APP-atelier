import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface Opcao { id: string; rotulo: ReactNode; estilo?: React.CSSProperties }

/** Caixa de seleção que mostra a opção atual e abre a lista ao tocar (cada opção pode ter seu próprio visual). */
export function Escolha(p: { rotulo: string; opcoes: Opcao[]; valor: string; aoEscolher: (id: string) => void }) {
  const [aberta, setAberta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const atual = p.opcoes.find((o) => o.id === p.valor) ?? p.opcoes[0];

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberta(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberta(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberta]);

  return (
    <div className="escolha" ref={caixa}>
      <span className="escolha-rotulo">{p.rotulo}</span>
      <button type="button" className="escolha-botao" aria-haspopup="listbox" aria-expanded={aberta} aria-controls={idLista} onClick={() => setAberta(!aberta)}>
        <span className="escolha-atual" style={atual.estilo}>{atual.rotulo}</span>
        <span aria-hidden="true">{aberta ? '▴' : '▾'}</span>
      </button>
      {aberta && (
        <ul className="escolha-lista" id={idLista} role="listbox" aria-label={p.rotulo}>
          {p.opcoes.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === atual.id}>
              <button type="button" style={o.estilo} onClick={() => { p.aoEscolher(o.id); setAberta(false); }}>{o.rotulo}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
