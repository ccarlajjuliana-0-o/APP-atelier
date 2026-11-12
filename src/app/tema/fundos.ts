import { useEffect, useState, type CSSProperties } from 'react';
import { fundosDoTema, type AparenciaDoTema, type CamadasFundo } from '../../dominio/temas.ts';

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

export const estiloDeCamadas = (c: CamadasFundo | null): CSSProperties =>
  c ? { backgroundImage: c.camadas, backgroundSize: c.tamanho, backgroundRepeat: c.repeticao, backgroundAttachment: c.fixacao } : {};

export { fundosDoTema };
