import { useEffect, useState, type CSSProperties } from 'react';
import type { AparenciaDoTema } from '../../dominio/temas.ts';
import { variaveis, type Preferencias } from './tema.ts';
import { estiloDeCamadas, useFundosDoTema } from './fundos.ts';

/**
 * Tela em miniatura mostrando como o tema ficaria (cores, fundo da tela e do menu), sem aplicar nada no app.
 * Respeita o modo claro/escuro que você escolheu.
 */
export function PreviaTema({ aparencia, prefs, titulo, grande }: { aparencia: AparenciaDoTema; prefs: Preferencias; titulo?: string; grande?: boolean }) {
  const [escuroSistema, setEscuroSistema] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const ouvir = (e: MediaQueryListEvent) => setEscuroSistema(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, []);
  const vars = variaveis(prefs, escuroSistema, aparencia.cores);
  const f = useFundosDoTema(aparencia);
  return (
    <div className={`previa${grande ? ' grande' : ''}`} style={vars as CSSProperties} role="img" aria-label={`Pré-visualização${titulo ? ` do tema ${titulo}` : ''}`}>
      <div className="pmenu" style={estiloDeCamadas(f.menu)}>
        <b className="on" /><b /><b /><b />
      </div>
      <div className="ptela" style={estiloDeCamadas(f.conteudo)}>
        <strong>{titulo || 'Início'}</strong>
        <div className="pcartao">Seu pedido está quase pronto.</div>
        <div className="plinha"><span className="pbotao">Botão</span><span className="petiqueta">Etiqueta</span></div>
      </div>
    </div>
  );
}
