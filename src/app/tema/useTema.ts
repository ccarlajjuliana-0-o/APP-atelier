import { useEffect, useState } from 'react';
import { PREFERENCIAS_PADRAO, variaveis, type Preferencias } from './tema.ts';

const CHAVE = 'craft-notes:tema';

function ler(): Preferencias {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...PREFERENCIAS_PADRAO, ...JSON.parse(bruto) };
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return PREFERENCIAS_PADRAO;
}

export function useTema(): [Preferencias, (p: Preferencias) => void] {
  const [prefs, setPrefs] = useState<Preferencias>(ler);
  const [sistemaEscuro, setSistemaEscuro] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const ouvir = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, []);

  useEffect(() => {
    const v = variaveis(prefs, sistemaEscuro);
    for (const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(prefs));
    } catch {
      /* ignora */
    }
  }, [prefs, sistemaEscuro]);

  return [prefs, setPrefs];
}
