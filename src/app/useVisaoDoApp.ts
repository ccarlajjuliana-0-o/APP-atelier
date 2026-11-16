import { useCallback, useEffect, useState } from 'react';

const CHAVE_MENU = 'craft-notes:menu-recolhido';

/** Menu lateral recolhido ou aberto; a escolha fica guardada neste aparelho. */
export function useMenuRecolhido(): [boolean, (v: boolean) => void] {
  const [recolhido, setRecolhido] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHAVE_MENU) === '1';
    } catch {
      return false;
    }
  });
  const mudar = useCallback((v: boolean) => {
    setRecolhido(v);
    try {
      localStorage.setItem(CHAVE_MENU, v ? '1' : '0');
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }, []);
  return [recolhido, mudar];
}

type DocumentoComPrefixo = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type ElementoComPrefixo = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/** Tela cheia do navegador (some a barra de endereço). `disponivel` é falso onde o aparelho não permite (ex.: iPhone). */
export function useTelaCheia(): { disponivel: boolean; ativa: boolean; alternar: () => void } {
  const doc = document as DocumentoComPrefixo;
  const disponivel = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  const [ativa, setAtiva] = useState<boolean>(() => !!(doc.fullscreenElement || doc.webkitFullscreenElement));
  useEffect(() => {
    const atualizar = () => setAtiva(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', atualizar);
    document.addEventListener('webkitfullscreenchange', atualizar);
    return () => {
      document.removeEventListener('fullscreenchange', atualizar);
      document.removeEventListener('webkitfullscreenchange', atualizar);
    };
  }, [doc]);
  const alternar = useCallback(() => {
    const raiz = document.documentElement as ElementoComPrefixo;
    const entrar = raiz.requestFullscreen?.bind(raiz) ?? raiz.webkitRequestFullscreen?.bind(raiz);
    const sair = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
    const aberta = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    void (aberta ? sair?.() : entrar?.())?.catch?.(() => undefined);
  }, [doc]);
  return { disponivel, ativa, alternar };
}
