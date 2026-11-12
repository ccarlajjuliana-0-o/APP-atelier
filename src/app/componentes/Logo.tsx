import { useEffect, useState, type CSSProperties } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../../dados/db.ts';

/** A logo que você enviou (ou a original). Atualiza sozinha quando ela muda, inclusive vinda da nuvem. */
export function useLogo(): { url: string; personalizada: boolean } {
  const original = `${import.meta.env.BASE_URL}icons/icon-192.png`;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let atual: string | null = null;
    const inscricao = liveQuery(() => db.identidade.get('logo')).subscribe({
      next: (r) => {
        if (atual) URL.revokeObjectURL(atual);
        atual = r?.imagem ? URL.createObjectURL(r.imagem) : null;
        setUrl(atual);
      },
      error: () => undefined,
    });
    return () => {
      inscricao.unsubscribe();
      if (atual) URL.revokeObjectURL(atual);
    };
  }, []);
  return { url: url ?? original, personalizada: !!url };
}

export function Logo({ alt, largura, estilo }: { alt: string; largura?: number; estilo?: CSSProperties }) {
  const { url } = useLogo();
  return <img src={url} alt={alt} width={largura} height={largura} style={estilo} />;
}
