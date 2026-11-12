import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { perguntar } from '../../dados/assistente.ts';
import { PERGUNTAS_SUGERIDAS, type Mensagem } from '../../dominio/assistente.ts';
import { janelaPadrao, lerJanelaGuardada, limitarJanela, type Janela } from '../../dominio/janela.ts';

const CHAVE_JANELA = 'craft-notes:janela-assistente';

function janelaInicial(): Janela {
  let guardada: Janela | null = null;
  try { guardada = lerJanelaGuardada(localStorage.getItem(CHAVE_JANELA)); } catch { /* sem armazenamento */ }
  return limitarJanela(guardada ?? janelaPadrao(window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight);
}

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

/**
 * Assistente em botão flutuante: fica por cima de qualquer tela, sem tirar você do que está fazendo.
 * Vive no App (nunca desmonta), então a conversa continua ao trocar de tela.
 */
export function AssistenteFlutuante({ telaAtual }: { telaAtual: string }) {
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState('');
  const fim = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  const [janela, setJanela] = useState<Janela>(janelaInicial);
  const gesto = useRef<{ tipo: 'mover' | 'tamanho'; px: number; py: number; ini: Janela } | null>(null);

  // Mantém a janela dentro da tela quando a tela muda de tamanho (girar o tablet, por exemplo).
  useEffect(() => {
    const ajustar = () => setJanela((j) => limitarJanela(j, window.innerWidth, window.innerHeight));
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  function guardarJanela(j: Janela) {
    try { localStorage.setItem(CHAVE_JANELA, JSON.stringify(j)); } catch { /* ignora */ }
  }
  function comecar(tipo: 'mover' | 'tamanho', e: PointerEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesto.current = { tipo, px: e.clientX, py: e.clientY, ini: janela };
  }
  function arrastar(e: PointerEvent<HTMLElement>) {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    const novo = g.tipo === 'mover' ? { ...g.ini, x: g.ini.x + dx, y: g.ini.y + dy } : { ...g.ini, w: g.ini.w + dx, h: g.ini.h + dy };
    setJanela(limitarJanela(novo, window.innerWidth, window.innerHeight));
  }
  function soltar() {
    if (!gesto.current) return;
    gesto.current = null;
    setJanela((j) => { guardarJanela(j); return j; });
  }
  function restaurar() {
    const j = limitarJanela(janelaPadrao(window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight);
    setJanela(j);
    guardarJanela(j);
  }

  useEffect(() => {
    if (aberto) fim.current?.scrollIntoView({ block: 'end' });
  }, [aberto, conversa.length, pensando]);

  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    const fechar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [aberto]);

  async function enviar(pergunta: string) {
    const p = pergunta.trim();
    if (!p || pensando) return;
    const nova: Mensagem[] = [...conversa, { role: 'user', content: p }];
    setConversa(nova);
    setTexto('');
    setErro('');
    setPensando(true);
    try {
      const r = await perguntar(nova, telaAtual);
      setConversa([...nova, { role: 'assistant', content: r }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado.');
    } finally {
      setPensando(false);
    }
  }

  if (!aberto) {
    return (
      <button className="fab" onClick={() => setAberto(true)} aria-label="Abrir o assistente">
        <span aria-hidden="true">✨</span> Assistente
      </button>
    );
  }

  return (
    <div className="janela-assistente" role="dialog" aria-label="Assistente" style={{ left: janela.x, top: janela.y, width: janela.w, height: janela.h }}>
      <header onPointerDown={(e) => comecar('mover', e)} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} title="Arraste para mover">
        <strong>Assistente</strong>
        <button className="btn" style={{ minHeight: 36, padding: '0 12px' }} onClick={restaurar} title="Voltar ao tamanho e lugar padrão">Restaurar</button>
        {conversa.length > 0 && <button className="btn" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => { setConversa([]); setErro(''); }}>Nova conversa</button>}
        <button className="btn" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => setAberto(false)} aria-label="Fechar o assistente">Fechar</button>
      </header>
      <div className="mensagens" aria-live="polite">
        {conversa.length === 0 && (
          <>
            <p className="suave" style={{ margin: 0 }}>
              Pergunte sobre estoque, pedidos, preços, caixa e divulgação. Eu só aconselho, não altero nada. Um resumo do ateliê (sem telefone e sem sobrenome de clientes) é enviado à IA para responder. 🌸
            </p>
            <div className="linha">
              {PERGUNTAS_SUGERIDAS.map((q) => <button key={q} className="pilula" style={{ minHeight: 38, fontSize: 14 }} onClick={() => void enviar(q)}>{q}</button>)}
            </div>
          </>
        )}
        {conversa.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', whiteSpace: 'pre-wrap', padding: '10px 14px', borderRadius: 16,
            background: m.role === 'user' ? 'var(--principal)' : 'var(--neutro)', color: m.role === 'user' ? 'var(--sobre-principal)' : 'var(--texto)',
          }}><Texto t={m.content} /></div>
        ))}
        {pensando && <div className="suave">Pensando…</div>}
        {erro && <div className="aviso" role="alert">{erro}</div>}
        <div ref={fim} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void enviar(texto); }}>
        <input ref={campo} type="text" aria-label="Sua pergunta" placeholder="Pergunte algo sobre o ateliê…" style={{ flex: 1, minWidth: 0 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn primario" type="submit" disabled={pensando || !texto.trim()}>Enviar</button>
      </form>
      <div className="alca" role="presentation" title="Arraste para mudar o tamanho" onPointerDown={(e) => comecar('tamanho', e)} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} />
    </div>
  );
}
