import { useEffect, useMemo, useState } from 'react';
import { nuvem } from '../../dados/nuvem.ts';
import {
  descartarSolicitacao, estadoDaPublicacao, importarSolicitacao, listarSolicitacoes, pausarFormulario, publicarFormulario,
  type EstadoPublicacao, type Solicitacao,
} from '../../dados/publico.ts';
import { qrSvg } from '../../dominio/qr.ts';
import { BOAS_VINDAS_PADRAO, TITULO_PADRAO, linkPublico } from '../../dominio/publico.ts';
import type { Orcamento } from '../../dominio/orcamentos.ts';

const PEQUENO = { fontSize: 'calc(13px * var(--escala, 1))' } as const;

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function svgParaPng(svg: string, lado: number): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((ok, falha) => { img.onload = () => ok(); img.onerror = () => falha(new Error('Não consegui montar a imagem.')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = lado;
  c.height = lado;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, lado, lado);
  URL.revokeObjectURL(url);
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não consegui gerar o PNG.'))), 'image/png'));
}

/** Painel da dona: publicar o formulário, copiar o link e baixar o QR code. */
export function LinkPublico() {
  const [estado, setEstado] = useState<EstadoPublicacao | null>(null);
  const [titulo, setTitulo] = useState(TITULO_PADRAO);
  const [boasVindas, setBoasVindas] = useState(BOAS_VINDAS_PADRAO);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const link = useMemo(() => linkPublico(window.location.origin, window.location.pathname), []);
  const svg = useMemo(() => qrSvg(link, { modulo: 10 }), [link]);

  async function carregar() {
    try {
      const e = await estadoDaPublicacao();
      setEstado(e);
      if (e?.titulo) setTitulo(e.titulo);
      if (e?.boasVindas) setBoasVindas(e.boasVindas);
    } catch { /* sem nuvem ou sem tabela: o painel explica */ }
  }
  useEffect(() => { void carregar(); }, []);

  async function publicar() {
    setErro(''); setMsg(''); setOcupado(true);
    try {
      await publicarFormulario(titulo, boasVindas);
      setMsg('Formulário publicado com as perguntas, os preços e o estoque de agora. 🌸');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui publicar.');
    } finally { setOcupado(false); }
  }
  async function pausar() {
    setErro(''); setMsg(''); setOcupado(true);
    try {
      await pausarFormulario();
      setMsg('Link pausado: quem abrir vê um aviso de que não está recebendo pedidos.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui pausar.');
    } finally { setOcupado(false); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(link); setMsg('Link copiado.'); } catch { setMsg('Não consegui copiar sozinha: selecione o link e copie.'); }
  }

  if (!nuvem) return <div className="cartao"><strong>Link público e QR code</strong><p className="suave">Precisa da nuvem ligada (login com GitHub) para funcionar.</p></div>;

  return (
    <div className="cartao">
      <strong>Link público e QR code</strong>
      <p className="suave" style={{ marginTop: 4 }}>
        A cliente abre o link (ou aponta a câmera para o QR), preenche as mesmas perguntas do seu formulário e o pedido chega aqui em “Solicitações recebidas”, para você revisar. Ela vê só as opções que têm estoque, com o preço de cada uma.
      </p>
      <p style={{ margin: '6px 0' }}>
        {estado ? (estado.ativo ? <span className="etiqueta">No ar</span> : <span className="etiqueta">Pausado</span>) : <span className="etiqueta">Ainda não publicado</span>}
        {estado && <span className="suave"> · publicado em {new Date(estado.publicadoEm).toLocaleString('pt-BR')}</span>}
      </p>
      <div className="formgrid">
        <label className="campo"><span>Título da página</span><input type="text" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} /></label>
        <label className="campo"><span>Mensagem de boas-vindas</span><textarea rows={3} value={boasVindas} maxLength={400} onChange={(e) => setBoasVindas(e.target.value)} style={{ width: '100%' }} /></label>
      </div>
      <div className="linha" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn primario" disabled={ocupado} onClick={() => void publicar()}>{estado ? 'Atualizar formulário publicado' : 'Publicar formulário'}</button>
        {estado?.ativo && <button className="btn" disabled={ocupado} onClick={() => void pausar()}>Pausar link</button>}
      </div>
      <p className="suave" style={PEQUENO}>Atualize sempre que mudar perguntas, extras, preços ou o estoque: o que a cliente vê é uma cópia do momento da publicação.</p>
      {msg && <p role="status" className="ok">{msg}</p>}
      {erro && <p className="aviso">{erro}</p>}

      <div className="linha" style={{ marginTop: 12, gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 200, maxWidth: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--borda, #ddd)' }} dangerouslySetInnerHTML={{ __html: svg.replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"') }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="campo"><span>Link da cliente</span><input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></label>
          <div className="linha" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => void copiar()}>Copiar link</button>
            <a className="btn" href={link} target="_blank" rel="noreferrer">Abrir como cliente</a>
            <button className="btn" onClick={() => baixar('qr-pedido-craft-notes.svg', new Blob([svg], { type: 'image/svg+xml' }))}>Baixar QR (SVG)</button>
            <button className="btn" onClick={() => void svgParaPng(svg, 1200).then((b) => baixar('qr-pedido-craft-notes.png', b)).catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Não consegui gerar o PNG.'))}>Baixar QR (PNG)</button>
          </div>
          <p className="suave" style={PEQUENO}>O QR leva ao mesmo link. Se você mudar o endereço do app, gere o QR de novo.</p>
        </div>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Primeira vez? O que preparar no Supabase</summary>
        <ol className="suave" style={PEQUENO}>
          <li>No Supabase, abra SQL Editor, cole o arquivo <code>docs/orcamento-publico.sql</code> e clique em Run.</li>
          <li>Publique a função de recebimento (sem exigir login): <code>supabase functions deploy orcamento-publico --no-verify-jwt</code>.</li>
          <li>Volte aqui e clique em “Publicar formulário”. Depois teste com “Abrir como cliente”.</li>
        </ol>
      </details>
    </div>
  );
}

/** Pedidos que chegaram pelo link público, esperando a sua revisão. */
export function SolicitacoesRecebidas(p: { aoVirarOrcamento: (o: Orcamento, aviso: string) => Promise<void> }) {
  const [lista, setLista] = useState<Solicitacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [descartando, setDescartando] = useState('');

  async function carregar() {
    try { setLista(await listarSolicitacoes()); setErro(''); } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui buscar as solicitações.'); }
  }
  useEffect(() => {
    void carregar();
    const aoVoltar = () => { if (document.visibilityState === 'visible') void carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, []);

  if (!nuvem || (lista !== null && lista.length === 0 && !erro)) return null;

  async function virar(s: Solicitacao) {
    setOcupado(s.id); setErro('');
    try {
      const o = await importarSolicitacao(s);
      await p.aoVirarOrcamento(o, `A solicitação de ${s.nome} virou o orçamento #${o.numero}. Falta definir o valor base do produto.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui transformar em orçamento.');
    } finally { setOcupado(''); }
  }
  async function descartar(s: Solicitacao) {
    setOcupado(s.id); setErro('');
    try { await descartarSolicitacao(s.id); setDescartando(''); await carregar(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui descartar.'); } finally { setOcupado(''); }
  }

  return (
    <div className="cartao">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <strong>Solicitações recebidas {lista ? `(${lista.length})` : ''}</strong>
        <button className="btn" onClick={() => void carregar()}>Atualizar</button>
      </div>
      {erro && <p className="aviso">{erro}</p>}
      {lista?.map((s) => (
        <div key={s.id} className="cartao" style={{ marginTop: 8, background: 'var(--neutro)' }}>
          <div><strong>{s.nome}</strong> <span className="suave">· {s.contato} · {new Date(s.criadoEm).toLocaleString('pt-BR')}</span></div>
          <div className="suave">{s.quantidade}× {s.escolhas.map((e) => e.texto ? `${e.opcaoNome}` : e.opcaoNome).filter(Boolean).join(' · ') || 'sem escolhas'}</div>
          {s.observacao && <div className="suave">“{s.observacao}”</div>}
          <div className="linha" style={{ marginTop: 6 }}>
            <button className="btn primario" disabled={ocupado === s.id} onClick={() => void virar(s)}>Virar orçamento</button>
            {descartando === s.id
              ? <><button className="btn" disabled={ocupado === s.id} onClick={() => void descartar(s)}>Sim, descartar</button><button className="btn" onClick={() => setDescartando('')}>Voltar</button></>
              : <button className="btn" onClick={() => setDescartando(s.id)}>Descartar</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
