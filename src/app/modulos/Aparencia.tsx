import { PALETAS, type Modo, type Preferencias } from '../tema/tema.ts';

const MODOS: { id: Modo; nome: string }[] = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'automatico', nome: 'Automático' },
];

export function Aparencia({ prefs, aoMudar }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void }) {
  const paleta = PALETAS.find((p) => p.id === prefs.paletaId) ?? PALETAS[0];
  return (
    <>
      <h1>Aparência e marca</h1>
      <div className="grade">
        <section className="cartao">
          <h2>Modo</h2>
          <div className="linha">
            {MODOS.map((m) => (
              <button key={m.id} className="pilula" aria-pressed={prefs.modo === m.id} onClick={() => aoMudar({ ...prefs, modo: m.id })}>
                {m.nome}
              </button>
            ))}
          </div>
          <p className="suave">Automático segue o modo do tablet.</p>
        </section>
        <section className="cartao">
          <h2>Cores</h2>
          <div className="linha" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {PALETAS.map((p) => (
              <button
                key={p.id}
                className="pilula"
                aria-pressed={prefs.paletaId === p.id}
                onClick={() => aoMudar({ ...prefs, paletaId: p.id, principalLivre: undefined, apoioLivre: undefined })}
                style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 11, background: p.principal, display: 'inline-block' }} />
                <span style={{ width: 22, height: 22, borderRadius: 11, background: p.apoio, display: 'inline-block' }} />
                {p.nome}
              </button>
            ))}
          </div>
          <div className="linha" style={{ marginTop: 12 }}>
            <label>
              Cor principal{' '}
              <input type="color" value={prefs.principalLivre ?? paleta.principal} onChange={(e) => aoMudar({ ...prefs, principalLivre: e.target.value })} />
            </label>
            <label>
              Cor de apoio{' '}
              <input type="color" value={prefs.apoioLivre ?? paleta.apoio} onChange={(e) => aoMudar({ ...prefs, apoioLivre: e.target.value })} />
            </label>
          </div>
          <p className="suave">O texto sobre a cor principal troca sozinho entre branco e escuro para manter a leitura.</p>
        </section>
        <section className="cartao">
          <h2>Prévia</h2>
          <div className="linha">
            <button className="btn primario">Concluir etapa</button>
            <button className="btn">Ver pedido</button>
            <span className="etiqueta">Em produção</span>
          </div>
        </section>
      </div>
    </>
  );
}
