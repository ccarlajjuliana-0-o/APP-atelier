import { useEffect, useState, type ReactNode } from 'react';
import { nuvem, entrarComGitHub } from '../dados/nuvem.ts';

export function AuthGate({ children }: { children: (modoLocal: boolean) => ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    if (!nuvem) {
      setCarregando(false);
      return;
    }
    nuvem.auth.getSession().then(({ data }) => {
      setLogado(!!data.session);
      setCarregando(false);
    });
    const { data } = nuvem.auth.onAuthStateChange((_e, sessao) => setLogado(!!sessao));
    return () => data.subscription.unsubscribe();
  }, []);

  if (carregando) return <div className="centro">Carregando…</div>;
  if (!nuvem) return <>{children(true)}</>;
  if (!logado) {
    return (
      <div className="centro">
        <div className="cartao">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Craft Notes Unique" width={96} height={96} style={{ borderRadius: 18 }} />
          <h1>Craft Notes Unique</h1>
          <p className="suave">atelier criativo</p>
          <button className="btn primario" onClick={() => void entrarComGitHub()}>
            Entrar com GitHub
          </button>
        </div>
      </div>
    );
  }
  return <>{children(false)}</>;
}
