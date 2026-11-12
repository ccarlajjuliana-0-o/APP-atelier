import { useEffect, useState, type ChangeEvent } from 'react';
import { prepararLogo } from '../../dados/imagem.ts';
import { salvarLogo } from '../../dados/temas.ts';
import { useLogo } from '../componentes/Logo.tsx';
import {
  ESCALA_MAX, ESCALA_MIN, TEXTO_MINIMO, FONTES_CORPO, FONTES_SCRIPT, FONTES_TITULO, PALETAS, PREFERENCIAS_PADRAO, achar, contraste, escalaDe, urlDasFontes, variaveis, type Fonte, type Modo, type Preferencias,
} from '../tema/tema.ts';
import { carregarFontes } from '../tema/fontes.ts';
import { Escolha } from '../componentes/Escolha.tsx';

const MODOS: { id: Modo; nome: string }[] = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'automatico', nome: 'Automático' },
];

const Bolinha = ({ cor }: { cor: string }) => <span style={{ width: 22, height: 22, borderRadius: 11, background: cor, display: 'inline-block', border: '1px solid var(--borda)', flex: 'none' }} />;

function EscolhaDeFonte(p: { titulo: string; fontes: Fonte[]; escolhida: string | undefined; amostra: string; tamanho: number; aoEscolher: (id: string) => void }) {
  const atual = achar(p.fontes, p.escolhida);
  return (
    <Escolha
      rotulo={p.titulo}
      valor={atual.id}
      aoEscolher={p.aoEscolher}
      opcoes={p.fontes.map((f) => ({
        id: f.id,
        estilo: { fontFamily: f.familia, fontSize: p.tamanho },
        rotulo: <>{p.amostra} <span style={{ fontSize: 'calc(12px * var(--escala, 1))', opacity: 0.75, fontFamily: 'var(--fonte-corpo)' }}>· {f.nome}</span></>,
      }))}
    />
  );
}

function CartaoLogo() {
  const { url, personalizada } = useLogo();
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  async function enviar(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    setMsg('');
    try {
      await salvarLogo(await prepararLogo(arquivo));
      setMsg('Logo atualizada. Ela aparece no menu e na tela de entrada.');
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui usar essa imagem.');
    }
  }

  return (
    <section className="cartao" style={{ marginTop: 0 }}>
      <h2>Logomarca</h2>
      <div className="linha" style={{ gap: 16, alignItems: 'center' }}>
        <img className="logo-previa" src={url} alt="Logomarca atual" />
        <div>
          <div className="linha">
            <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
              Enviar nova logo
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => void enviar(e)} />
            </label>
            {personalizada && <button className="btn" onClick={() => void salvarLogo(null).then(() => setMsg('Voltou à logo original.'))}>Voltar à original</button>}
          </div>
          <p className="suave" style={{ margin: '8px 0 0', fontSize: 'calc(13px * var(--escala, 1))' }}>PNG com fundo transparente fica melhor. Vale para o menu e a tela de entrada, e vai para a nuvem junto com o resto. O ícone do app instalado no aparelho não muda por aqui.</p>
        </div>
      </div>
      {msg && <p role="status" className="ok">{msg}</p>}
      {erro && <p className="aviso" role="alert">{erro}</p>}
    </section>
  );
}

export function Aparencia({ prefs, aoMudar }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void }) {
  const paleta = PALETAS.find((p) => p.id === prefs.paletaId) ?? PALETAS[0];
  const atuais = variaveis(prefs, window.matchMedia('(prefers-color-scheme: dark)').matches);
  const escala = escalaDe(prefs);
  const legivel = contraste(atuais['--texto'], atuais['--fundo']) >= 4.5;
  const textoRecusado = !!prefs.textoLivre && contraste(prefs.textoLivre, atuais['--fundo']) < TEXTO_MINIMO;
  const mudarEscala = (n: number) => aoMudar({ ...prefs, escalaFonte: Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, n)) });

  // Para mostrar cada opção na sua própria fonte, baixa todas enquanto esta tela está aberta.
  useEffect(() => {
    carregarFontes('opcoes', urlDasFontes([...FONTES_CORPO, ...FONTES_TITULO, ...FONTES_SCRIPT]));
    return () => carregarFontes('opcoes', '');
  }, []);

  return (
    <>
      <p className="suave">Estas escolhas ficam guardadas neste aparelho. No tablet, escolha de novo do seu jeito.</p>
      <div className="grade">
        <CartaoLogo />
        <section className="cartao">
          <h2>Modo</h2>
          <div className="linha">
            {MODOS.map((m) => (
              <button key={m.id} className="pilula" aria-pressed={prefs.modo === m.id} onClick={() => aoMudar({ ...prefs, modo: m.id })}>
                {m.nome}
              </button>
            ))}
          </div>
          <p className="suave">Automático segue o modo do aparelho.</p>
        </section>
        <section className="cartao">
          <h2>Prévia</h2>
          <div className="script" style={{ fontSize: 'calc(36px * var(--escala, 1))', lineHeight: 1.2 }}>Craft Notes Unique</div>
          <h3 style={{ margin: '4px 0' }}>Pedido #12 · Maria</h3>
          <p style={{ margin: '0 0 10px' }}>Cada caderno nasce pensado pra sua história.</p>
          <div className="linha">
            <button className="btn primario">Concluir etapa</button>
            <button className="btn">Ver pedido</button>
            <span className="etiqueta">Em produção</span>
          </div>
        </section>
      </div>

      <div className="grade" style={{ marginTop: 16, alignItems: 'start' }}>
        <section className="cartao" style={{ marginTop: 0 }}>
          <h2>Cores</h2>
          <Escolha
            rotulo="Paleta"
            valor={paleta.id}
            aoEscolher={(id) => aoMudar({ ...prefs, paletaId: id, principalLivre: undefined, apoioLivre: undefined, menuLivre: undefined })}
            opcoes={PALETAS.map((p) => ({ id: p.id, rotulo: <><Bolinha cor={p.principal} /><Bolinha cor={p.apoio} /><Bolinha cor={p.menu} /><span>{p.nome}</span></> }))}
          />
          <div className="linha" style={{ marginTop: 12, gap: 10 }}>
            <label>Cor do plano de fundo{' '}<input type="color" value={atuais['--fundo']} onChange={(e) => aoMudar({ ...prefs, fundoLivre: e.target.value })} /></label>
            {prefs.fundoLivre && <button className="btn" onClick={() => aoMudar({ ...prefs, fundoLivre: undefined })}>Padrão do modo</button>}
          </div>
          <p className="suave" style={{ margin: '4px 0 0', fontSize: 13 }}>É o fundo das telas, nos modos claro e escuro. O texto troca sozinho entre claro e escuro para continuar legível, a menos que você escolha a cor dele em Fontes.</p>
          <details className="recolhivel" style={{ marginTop: 10 }}>
            <summary>Ou escolher minhas cores</summary>
            <div className="linha" style={{ gap: 18, marginTop: 6 }}>
              <label>Botões e destaques{' '}<input type="color" value={prefs.principalLivre ?? paleta.principal} onChange={(e) => aoMudar({ ...prefs, principalLivre: e.target.value })} /></label>
              <label>Detalhes suaves{' '}<input type="color" value={prefs.apoioLivre ?? paleta.apoio} onChange={(e) => aoMudar({ ...prefs, apoioLivre: e.target.value })} /></label>
              <label>Menu lateral{' '}<input type="color" value={prefs.menuLivre ?? paleta.menu} onChange={(e) => aoMudar({ ...prefs, menuLivre: e.target.value })} /></label>
              <button className="btn" onClick={() => aoMudar({ ...prefs, principalLivre: undefined, apoioLivre: undefined, menuLivre: undefined })}>Voltar às cores da paleta</button>
            </div>
          </details>
          <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>O texto sobre as cores troca sozinho entre claro e escuro para manter a leitura. No modo escuro, o menu fica escuro, a menos que você escolha uma cor para ele.</p>
        </section>
        <section className="cartao" style={{ marginTop: 0 }}>
          <h2>Fontes</h2>
          <div className="linha" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <EscolhaDeFonte titulo="Títulos" fontes={FONTES_TITULO} escolhida={prefs.fonteTitulo} amostra="Pedidos em andamento" tamanho={20} aoEscolher={(id) => aoMudar({ ...prefs, fonteTitulo: id })} />
            <EscolhaDeFonte titulo="Texto" fontes={FONTES_CORPO} escolhida={prefs.fonteCorpo} amostra="Cada detalhe feito à mão" tamanho={16} aoEscolher={(id) => aoMudar({ ...prefs, fonteCorpo: id })} />
            <EscolhaDeFonte titulo="Cursiva (nome do atelier no menu)" fontes={FONTES_SCRIPT} escolhida={prefs.fonteScript} amostra="Craft Notes Unique" tamanho={26} aoEscolher={(id) => aoMudar({ ...prefs, fonteScript: id })} />
          </div>
          <div className="linha" style={{ marginTop: 14, gap: 10 }}>
            <label>Cor do texto{' '}<input type="color" value={atuais['--texto']} onChange={(e) => aoMudar({ ...prefs, textoLivre: e.target.value })} /></label>
            {prefs.textoLivre && <button className="btn" onClick={() => aoMudar({ ...prefs, textoLivre: undefined })}>Padrão</button>}
          </div>
          {textoRecusado ? (
            <p className="aviso" role="status">Essa cor de texto ficaria quase invisível sobre o fundo, então o app usou a cor automática. Escolha uma cor mais clara ou mais escura que o fundo. <button className="btn" style={{ minHeight: 32 }} onClick={() => aoMudar({ ...prefs, textoLivre: undefined })}>Voltar ao automático</button></p>
          ) : !legivel && (
            <p className="aviso" role="status">Essa combinação de texto e fundo está difícil de ler. Tente uma cor de texto mais clara ou mais escura. <button className="btn" style={{ minHeight: 32 }} onClick={() => aoMudar({ ...prefs, textoLivre: undefined })}>Texto automático</button></p>
          )}
          <div style={{ marginTop: 14 }}>
            <span className="escolha-rotulo">Tamanho das letras: {escala}%</span>
            <div className="linha" style={{ gap: 8, marginTop: 4 }}>
              <button className="btn" aria-label="Diminuir letras" disabled={escala <= ESCALA_MIN} onClick={() => mudarEscala(escala - 5)}>A−</button>
              <input type="range" aria-label="Tamanho das letras" min={ESCALA_MIN} max={ESCALA_MAX} step={5} value={escala} onChange={(e) => mudarEscala(Number(e.target.value))} style={{ flex: 1, minWidth: 120 }} />
              <button className="btn" aria-label="Aumentar letras" disabled={escala >= ESCALA_MAX} onClick={() => mudarEscala(escala + 5)}>A+</button>
              {escala !== 100 && <button className="btn" onClick={() => mudarEscala(100)}>Normal</button>}
            </div>
          </div>
          <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>As fontes vêm da internet. Sem conexão, o app usa uma fonte parecida até voltar.</p>
        </section>
      </div>
      <div className="rodape" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => aoMudar({ ...PREFERENCIAS_PADRAO, modo: prefs.modo })}>Voltar ao visual padrão da marca</button>
      </div>
    </>
  );
}
