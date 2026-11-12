import { useCallback, useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type PreferenciasRegistro } from '../../dados/db.ts';
import {
  FONTES_CORPO, FONTES_SCRIPT, FONTES_TITULO, PREFERENCIAS_PADRAO, achar, remotoMaisNovo, urlDasFontes, variaveis, type Preferencias,
} from './tema.ts';
import { carregarFontes } from './fontes.ts';

const CHAVE = 'craft-notes:tema';

function ler(): { prefs: Preferencias; existia: boolean } {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { prefs: { ...PREFERENCIAS_PADRAO, ...JSON.parse(bruto) }, existia: true };
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { prefs: PREFERENCIAS_PADRAO, existia: false };
}

function guardarLocal(p: Preferencias): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* ignora */
  }
}

/**
 * Visual do app. Fica guardado no aparelho (abre sem piscar) e também na nuvem, para o tablet abrir igual:
 * o que for alterado mais recentemente vale.
 */
export function useTema(): [Preferencias, (p: Preferencias) => void] {
  const [prefs, setPrefsEstado] = useState<Preferencias>(() => ler().prefs);
  const atual = useRef(prefs);
  atual.current = prefs;
  const [sistemaEscuro, setSistemaEscuro] = useState<boolean>(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const ouvir = (e: MediaQueryListEvent) => setSistemaEscuro(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
  }, []);

  useEffect(() => {
    const v = variaveis(prefs, sistemaEscuro);
    for (const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    carregarFontes('tema', urlDasFontes([achar(FONTES_CORPO, prefs.fonteCorpo), achar(FONTES_TITULO, prefs.fonteTitulo), achar(FONTES_SCRIPT, prefs.fonteScript)]));
  }, [prefs, sistemaEscuro]);

  // Mudança feita pela pessoa: guarda no aparelho e no banco local (que vai para a nuvem).
  const mudar = useCallback((p: Preferencias) => {
    const novo: Preferencias = { ...p, atualizadoEm: new Date().toISOString() };
    setPrefsEstado(novo);
    guardarLocal(novo);
    void db.preferencias.put({ ...novo, id: 'tema', atualizadoEm: novo.atualizadoEm as string }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Quem já tinha um visual escolhido antes desta versão leva esse visual para a nuvem.
    void (async () => {
      try {
        if (!(await db.preferencias.get('tema')) && ler().existia) {
          const p = atual.current;
          await db.preferencias.put({ ...p, id: 'tema', atualizadoEm: p.atualizadoEm ?? new Date().toISOString() });
        }
      } catch {
        /* sem banco: segue só com o aparelho */
      }
    })();
    // Visual que chegou da nuvem (ou de outra aba) e é mais novo que o daqui.
    const inscricao = liveQuery(() => db.preferencias.get('tema')).subscribe({
      next: (reg: PreferenciasRegistro | undefined) => {
        if (!reg || !remotoMaisNovo(atual.current.atualizadoEm, reg.atualizadoEm)) return;
        const { id: _id, ...p } = reg;
        setPrefsEstado(p);
        guardarLocal(p);
      },
      error: () => undefined,
    });
    return () => inscricao.unsubscribe();
  }, []);

  return [prefs, mudar];
}
