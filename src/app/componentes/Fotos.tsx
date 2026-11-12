import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { reduzirImagem } from '../../dados/imagem.ts';

/** Devolve a mesma lista enquanto as fotos forem as mesmas, mesmo que o array seja recriado a cada renderização. */
function useEstavel(fotos: Blob[]): Blob[] {
  const ref = useRef<Blob[]>(fotos);
  if (ref.current.length !== fotos.length || ref.current.some((f, i) => f !== fotos[i])) ref.current = fotos;
  return ref.current;
}

function useUrls(entrada: Blob[]): string[] {
  const fotos = useEstavel(entrada);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const novas = fotos.map((f) => URL.createObjectURL(f));
    setUrls(novas);
    return () => novas.forEach((u) => URL.revokeObjectURL(u));
  }, [fotos]);
  return urls;
}

/** Miniatura para listas. Sem foto, mostra um quadrado vazio do mesmo tamanho. */
export function Miniatura({ foto, tamanho = 44 }: { foto?: Blob | null; tamanho?: number }) {
  const lista = foto ? [foto] : [];
  const [url] = useUrls(lista);
  const caixa = { width: tamanho, height: tamanho, borderRadius: 10, flex: 'none' as const, objectFit: 'cover' as const };
  return url ? <img src={url} alt="" style={caixa} /> : <div style={{ ...caixa, background: 'var(--neutro)', border: '1px dashed var(--borda)' }} aria-hidden />;
}

/** Campo para adicionar e remover fotos (até `max`). */
export function CampoFotos(p: { fotos: Blob[]; max: number; aoMudar: (f: Blob[]) => void; rotulo?: string }) {
  const urls = useUrls(p.fotos);
  const [erro, setErro] = useState('');

  async function adicionar(e: ChangeEvent<HTMLInputElement>) {
    setErro('');
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    const vagas = p.max - p.fotos.length;
    try {
      const novas: Blob[] = [];
      for (const a of arquivos.slice(0, Math.max(0, vagas))) novas.push(await reduzirImagem(a));
      if (novas.length) p.aoMudar([...p.fotos, ...novas]);
      if (arquivos.length > vagas) setErro(`No máximo ${p.max} foto${p.max === 1 ? '' : 's'}.`);
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui usar essa foto.');
    }
  }

  return (
    <div>
      <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))', fontWeight: 600, marginBottom: 6 }}>{p.rotulo ?? 'Fotos'}</div>
      <div className="linha">
        {urls.map((u, i) => (
          <div key={u} style={{ position: 'relative' }}>
            <img src={u} alt={`Foto ${i + 1}`} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
            <button
              className="btn"
              style={{ position: 'absolute', top: -8, right: -8, minHeight: 30, width: 30, padding: 0, borderRadius: 15 }}
              aria-label={`Remover foto ${i + 1}`}
              onClick={() => p.aoMudar(p.fotos.filter((_, k) => k !== i))}
            >
              ×
            </button>
          </div>
        ))}
        {p.fotos.length < p.max && (
          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', width: 'auto' }}>
            + Foto
            <input type="file" accept="image/*" multiple={p.max > 1} hidden onChange={(e) => void adicionar(e)} />
          </label>
        )}
      </div>
      {erro && <p className="aviso">{erro}</p>}
    </div>
  );
}
