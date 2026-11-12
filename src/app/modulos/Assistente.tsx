import { useEffect, useRef, useState } from 'react';
import { nuvem } from '../../dados/nuvem.ts';
import { perguntar } from '../../dados/assistente.ts';
import { PERGUNTAS_SUGERIDAS, type Mensagem } from '../../dominio/assistente.ts';

/** Mostra **negrito** como negrito de verdade, sem interpretar mais nada do texto da IA. */
function Texto({ t }: { t: string }) {
  return (
    <>
      {t.split(/(\*\*[^*\n]+\*\*)/g).map((parte, i) =>
        parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? <strong key={i}>{parte.slice(2, -2)}</strong> : <span key={i}>{parte}</span>,
      )}
    </>
  );
}

export function Assistente() {
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversa.length, pensando]);

  if (!nuvem) {
    return (
      <>
        <h1>Assistente</h1>
        <div className="aviso">O assistente usa a nuvem (Supabase) para guardar a chave da IA com segurança. Entre com o GitHub para usar.</div>
      </>
    );
  }

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || pensando) return;
    const nova: Mensagem[] = [...conversa, { role: 'user', content: p }];
    setConversa(nova);
    setTexto('');
    setErro('');
    setPensando(true);
    try {
      const r = await perguntar(nova);
      setConversa([...nova, { role: 'assistant', content: r }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado.');
    } finally {
      setPensando(false);
    }
  }

  return (
    <>
      <h1>Assistente</h1>
      <p className="suave">
        Pergunte sobre estoque, pedidos, preços, caixa e divulgação. Ele só aconselha: não altera nada no app. Para responder, um resumo do ateliê (sem telefone e sem sobrenome de clientes) é enviado à IA.
      </p>
      <div className="faixa" />

      <div className="cartao">
        {conversa.length === 0 && (
          <>
            <p className="suave" style={{ marginTop: 0 }}>Por onde começar? 🌸</p>
            <div className="linha">
              {PERGUNTAS_SUGERIDAS.map((q) => <button key={q} className="pilula" onClick={() => void enviar(q)}>{q}</button>)}
            </div>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
          {conversa.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', whiteSpace: 'pre-wrap', padding: '10px 14px', borderRadius: 16,
              background: m.role === 'user' ? 'var(--principal)' : 'var(--neutro)', color: m.role === 'user' ? 'var(--sobre-principal)' : 'var(--texto)',
            }}><Texto t={m.content} /></div>
          ))}
          {pensando && <div className="suave">Pensando…</div>}
          <div ref={fim} />
        </div>
        {erro && <div className="aviso" role="alert" style={{ marginTop: 10 }}>{erro}</div>}
        <form className="linha" style={{ marginTop: 12, flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
          <input type="text" aria-label="Sua pergunta" placeholder="Pergunte algo sobre o ateliê…" style={{ flex: 1, minWidth: 0 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn primario" type="submit" disabled={pensando || !texto.trim()}>Enviar</button>
          {conversa.length > 0 && <button className="btn" type="button" onClick={() => { setConversa([]); setErro(''); }}>Nova conversa</button>}
        </form>
      </div>
    </>
  );
}
