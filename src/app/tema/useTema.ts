import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db, type PreferenciasRegistro } from '../../dados/db.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import { resolverTema, type TemaPersonalizado, type TemaResolvido } from '../../dominio/temas.ts';
import { useFundosDoTema } from './fundos.ts';
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
export function useTema(): [Preferencias, (p: Preferencias) => void, TemaResolvido | null] {
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

  // Tema festivo: depende da data de hoje e dos temas criados por você.
  const [personalizados, setPersonalizados] = useState<TemaPersonalizado[]>([]);
  const [hoje, setHoje] = useState<string>(() => hojeLocal());
  useEffect(() => {
    const inscricao = liveQuery(() => db.temas.toArray()).subscribe({ next: setPersonalizados, error: () => undefined });
    const atualizarDia = () => setHoje(hojeLocal());
    const relogio = window.setInterval(atualizarDia, 30 * 60_000);
    document.addEventListener('visibilitychange', atualizarDia);
    return () => {
      inscricao.unsubscribe();
      window.clearInterval(relogio);
      document.removeEventListener('visibilitychange', atualizarDia);
    };
  }, []);
  const tema = useMemo(
    () => resolverTema(prefs, personalizados, hoje),
    [prefs.temaFestivo, prefs.temaDiasAntes, prefs.temaDiasDepois, personalizados, hoje], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Fundo da tela e do menu lateral (imagem única ou repetida, ou só o desenho do tema).
  const fundos = useFundosDoTema(tema);
  useEffect(() => {
    const raiz = document.documentElement.style;
    const chaves = ['fundo', 'menu'].flatMap((n) => ['camadas', 'tamanho', 'repeticao', 'fixacao'].map((k) => `--${n}-${k}`));
    const limpar = () => chaves.forEach((k) => raiz.removeProperty(k));
    if (!tema) return limpar();
    const f = fundos;
    for (const [nome, c] of [['fundo', f.conteudo], ['menu', f.menu]] as const) {
      if (!c) {
        ['camadas', 'tamanho', 'repeticao', 'fixacao'].forEach((k) => raiz.removeProperty(`--${nome}-${k}`));
        continue;
      }
      raiz.setProperty(`--${nome}-camadas`, c.camadas);
      raiz.setProperty(`--${nome}-tamanho`, c.tamanho);
      raiz.setProperty(`--${nome}-repeticao`, c.repeticao);
      raiz.setProperty(`--${nome}-fixacao`, c.fixacao);
    }
    return limpar;
  }, [tema, fundos]);

  useEffect(() => {
    const v = variaveis(prefs, sistemaEscuro, tema?.cores ?? null);
    for (const [k, val] of Object.entries(v)) document.documentElement.style.setProperty(k, val);
    carregarFontes('tema', urlDasFontes([achar(FONTES_CORPO, prefs.fonteCorpo), achar(FONTES_TITULO, prefs.fonteTitulo), achar(FONTES_SCRIPT, prefs.fonteScript)]));
  }, [prefs, sistemaEscuro, tema?.cores]);

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

  return [prefs, mudar, tema];
}
