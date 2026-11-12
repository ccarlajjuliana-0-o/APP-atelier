import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { db, novoId } from '../../dados/db.ts';

// Teste de escrita com a S Pen: usa eventos de ponteiro (pressão e tipo do ponteiro).
export function TesteCaneta() {
  const tela = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const [info, setInfo] = useState('Escreva com a caneta (ou o dedo) no quadro.');
  const [salvas, setSalvas] = useState(0);

  useEffect(() => {
    const c = tela.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    c.getContext('2d')?.scale(dpr, dpr);
    void db.escritas.count().then(setSalvas);
  }, []);

  function ponto(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function aoPressionar(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    desenhando.current = true;
    ultimo.current = ponto(e);
  }

  function aoMover(e: PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current || !ultimo.current) return;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = ponto(e);
    const pressao = e.pointerType === 'pen' ? e.pressure : 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2B2745';
    ctx.lineWidth = 1 + pressao * 5;
    ctx.beginPath();
    ctx.moveTo(ultimo.current.x, ultimo.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = p;
    setInfo(`Ponteiro: ${e.pointerType} · pressão: ${pressao.toFixed(2)}`);
  }

  function aoSoltar() {
    desenhando.current = false;
    ultimo.current = null;
  }

  function limpar() {
    const c = tela.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  async function salvar() {
    const c = tela.current;
    if (!c) return;
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    if (!blob) return;
    await db.escritas.add({ id: novoId(), imagem: blob, criadoEm: new Date().toISOString() });
    setSalvas(await db.escritas.count());
    limpar();
  }

  return (
    <>
      <h2>Teste da caneta</h2>
      <p className="suave">{info}</p>
      <div className="cartao">
        <canvas ref={tela} className="quadro" onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} />
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="btn" onClick={limpar}>Limpar</button>
          <button className="btn primario" onClick={() => void salvar()}>Salvar escrita</button>
          <span className="suave">{salvas} escritas salvas neste aparelho</span>
        </div>
      </div>
    </>
  );
}
