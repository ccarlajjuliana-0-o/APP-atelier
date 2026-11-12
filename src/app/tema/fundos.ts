import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { fundosDoTema, ladrilhoDoTema, type AparenciaDoTema, type CamadasFundo, type LadrilhoPronto } from '../../dominio/temas.ts';
import { desenharLadrilho } from './ladrilho.ts';

/** Endereços temporários das imagens de um tema (liberados quando deixam de ser usados). */
export function useUrlsDoTema(a: Pick<AparenciaDoTema, 'imagem' | 'menuImagemPropria'> | null): { imagem: string | null; menu: string | null } {
  const [urls, setUrls] = useState<{ imagem: string | null; menu: string | null }>({ imagem: null, menu: null });
  const img = a?.imagem ?? null;
  const menu = a?.menuImagemPropria ?? null;
  useEffect(() => {
    const i = img ? URL.createObjectURL(img) : null;
    const m = menu ? URL.createObjectURL(menu) : null;
    setUrls({ imagem: i, menu: m });
    return () => {
      if (i) URL.revokeObjectURL(i);
      if (m) URL.revokeObjectURL(m);
    };
  }, [img, menu]);
  return urls;
}

const AREA_MENU = 200;
const areaDaTela = () => Math.max(320, window.innerWidth - 232 - 64);

/** Ladrilho montado (se o arranjo pedir) para uma das duas áreas; some e volta ao simples enquanto não fica pronto. */
function useLadrilho(a: AparenciaDoTema | null, alvo: 'tela' | 'menu'): LadrilhoPronto | null {
  const pedido = useMemo(() => (a ? ladrilhoDoTema(a, alvo, alvo === 'tela' ? areaDaTela() : AREA_MENU) : null), [a, alvo]);
  const chave = pedido ? JSON.stringify(pedido.plano) : '';
  const [pronto, setPronto] = useState<LadrilhoPronto | null>(null);
  useEffect(() => {
    if (!pedido) return setPronto(null);
    let ativo = true;
    let url = '';
    const espera = window.setTimeout(() => {
      desenharLadrilho(pedido.fonte, pedido.plano).then(
        (blob) => {
          if (!ativo) return;
          url = URL.createObjectURL(blob);
          setPronto({ url, plano: pedido.plano });
        },
        () => ativo && setPronto(null),
      );
    }, 120);
    return () => {
      ativo = false;
      window.clearTimeout(espera);
      if (url) URL.revokeObjectURL(url);
    };
  }, [pedido?.fonte, chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return pedido && pronto && JSON.stringify(pronto.plano) === chave ? pronto : null;
}

/** Fundo da tela e do menu para um tema, já com imagens e arranjos de repetição prontos. */
export function useFundosDoTema(a: AparenciaDoTema | null): { conteudo: CamadasFundo | null; menu: CamadasFundo | null } {
  const urls = useUrlsDoTema(a);
  const tela = useLadrilho(a, 'tela');
  const menu = useLadrilho(a, 'menu');
  return useMemo(() => (a ? fundosDoTema(a, urls, { tela, menu }) : { conteudo: null, menu: null }), [a, urls, tela, menu]);
}

export const estiloDeCamadas = (c: CamadasFundo | null): CSSProperties =>
  c ? { backgroundImage: c.camadas, backgroundSize: c.tamanho, backgroundRepeat: c.repeticao, backgroundAttachment: c.fixacao } : {};
