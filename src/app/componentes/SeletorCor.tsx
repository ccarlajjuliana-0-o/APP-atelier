import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PE } from 'react';
import { hexParaRgb, hsvParaRgb, normalizarHex, rgbParaHex, rgbParaHsv, type Hsv } from '../../dominio/cor.ts';

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Quadradinho com a cor; ao tocar abre um seletor com espectro, brilho, RGB e código hexadecimal. */
export function SeletorCor(p: { rotulo: string; valor: string; aoMudar: (hex: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => rgbParaHsv(hexParaRgb(p.valor)));
  const [texto, setTexto] = useState(p.valor);
  const caixa = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const [alinhar, setAlinhar] = useState<'esq' | 'dir'>('esq');
  const hex = rgbParaHex(hsvParaRgb(hsv));
  const [r, g, b] = hsvParaRgb(hsv);

  // Se a cor mudou por fora (restaurar, trocar de paleta), o seletor acompanha.
  useEffect(() => {
    if (normalizarHex(p.valor) !== hex) {
      setHsv(rgbParaHsv(hexParaRgb(p.valor)));
      setTexto(normalizarHex(p.valor) ?? p.valor);
    }
  }, [p.valor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  useLayoutEffect(() => {
    if (!aberto || !painel.current || !caixa.current) return;
    const larguraPainel = painel.current.offsetWidth;
    const esq = caixa.current.getBoundingClientRect().left;
    setAlinhar(esq + larguraPainel > window.innerWidth - 12 ? 'dir' : 'esq');
  }, [aberto]);

  function aplicar(novo: Hsv) {
    setHsv(novo);
    const h = rgbParaHex(hsvParaRgb(novo));
    setTexto(h);
    p.aoMudar(h);
  }
  function arrastar(e: PE<HTMLDivElement>) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const mover = (ev: { clientX: number; clientY: number }) => {
      const a = el.getBoundingClientRect();
      aplicar({ ...hsv, h: limitar((ev.clientX - a.left) / a.width, 0, 1) * 360, s: 1 - limitar((ev.clientY - a.top) / a.height, 0, 1) });
    };
    mover(e);
    const aoMover = (ev: PointerEvent) => mover(ev);
    const soltar = () => {
      el.removeEventListener('pointermove', aoMover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
    };
    el.addEventListener('pointermove', aoMover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }
  function canal(i: 0 | 1 | 2, v: string) {
    const rgb: [number, number, number] = [r, g, b];
    rgb[i] = limitar(Math.round(Number(v) || 0), 0, 255);
    aplicar(rgbParaHsv(rgb));
  }
  function digitarHex(v: string) {
    setTexto(v);
    const ok = normalizarHex(v);
    if (ok) {
      setHsv(rgbParaHsv(hexParaRgb(ok)));
      p.aoMudar(ok);
    }
  }
  const puro = rgbParaHex(hsvParaRgb({ h: hsv.h, s: hsv.s, v: 1 }));

  return (
    <div className="seletor-cor" ref={caixa}>
      <button type="button" className="amostra-cor" aria-label={`${p.rotulo}: ${hex}. Tocar para escolher`} aria-expanded={aberto} onClick={() => setAberto(!aberto)} style={{ background: normalizarHex(p.valor) ?? p.valor }} />
      {aberto && (
        <div className={`seletor-painel ${alinhar}`} ref={painel} role="dialog" aria-label={`Escolher ${p.rotulo}`}>
          <div className="seletor-topo">
            <div className="espectro" onPointerDown={arrastar} role="presentation">
              <span className="alvo" style={{ left: `${(hsv.h / 360) * 100}%`, top: `${(1 - hsv.s) * 100}%` }} />
            </div>
            <div className="previa-cor" style={{ background: hex }} aria-hidden="true" />
          </div>
          <input
            type="range" className="brilho" aria-label="Brilho" min={0} max={100} value={Math.round(hsv.v * 100)}
            onChange={(e) => aplicar({ ...hsv, v: Number(e.target.value) / 100 })}
            style={{ background: `linear-gradient(90deg, #000, ${puro})` }}
          />
          <div className="seletor-campos">
            <label className="hex">Código <input type="text" value={texto} maxLength={7} spellCheck={false} onChange={(e) => digitarHex(e.target.value)} onBlur={() => setTexto(hex)} aria-invalid={!normalizarHex(texto)} /></label>
            {(['Vermelho', 'Verde', 'Azul'] as const).map((n, i) => (
              <label key={n}>{n} <input type="number" min={0} max={255} value={[r, g, b][i]} onChange={(e) => canal(i as 0 | 1 | 2, e.target.value)} /></label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
