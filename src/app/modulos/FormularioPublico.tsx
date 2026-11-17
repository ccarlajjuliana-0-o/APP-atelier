import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buscarFormularioPublico, enviarSolicitacao } from '../../dados/publico.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { acrescimoTotal, escolhasPadrao, linhasDeEscolhas, type EscolhaItem } from '../../dominio/opcoes.ts';
import { infoPublica, MAX_QUANTIDADE, paraEnvio, pendentesPublicos, problemaNoEnvio, type FormularioPublicado } from '../../dominio/publico.ts';
import { FormularioItem } from '../componentes/FormularioItem.tsx';
import { Logo } from '../componentes/Logo.tsx';

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

const ESCONDIDO = { position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' } as const;

/** Página que a cliente abre pelo link ou QR: sem login, só o formulário do ateliê. */
export function FormularioPublico() {
  const [pub, setPub] = useState<FormularioPublicado | null | undefined>(undefined);
  const [escolhas, setEscolhas] = useState<EscolhaItem[]>([]);
  const [nome, setNome] = useState('');
  const [contato, setContato] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [site, setSite] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const abertoEm = useRef(Date.now());

  useEffect(() => {
    void buscarFormularioPublico().then((f) => {
      setPub(f);
      if (f) setEscolhas(escolhasPadrao(f.grupos, infoPublica(f), 1));
    });
  }, []);

  const info = useMemo(() => (pub ? infoPublica(pub) : {}), [pub]);
  const qtd = Math.round(Number(quantidade.replace(',', '.')));
  const porUnidade = acrescimoTotal(escolhas);

  async function enviar() {
    if (!pub) return;
    const problema = problemaNoEnvio({ nome, contato, quantidade: qtd }, pendentesPublicos(pub, escolhas));
    if (problema) return setErro(problema);
    setErro('');
    setEnviando(true);
    try {
      await enviarSolicitacao({
        nome: nome.trim(), contato: contato.trim(), quantidade: qtd, observacao: observacao.trim(), escolhas: paraEnvio(escolhas),
        versao: pub.publicadoEm, abertoEm: abertoEm.current, site,
      });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar agora.');
    } finally {
      setEnviando(false);
    }
  }

  const cabecalho = (
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <Logo alt="Craft Notes Unique" largura={88} estilo={{ borderRadius: 18, objectFit: 'contain' }} />
      <h1 style={{ marginBottom: 0 }}>Craft Notes Unique</h1>
      <p className="suave" style={{ marginTop: 0 }}>atelier criativo</p>
    </div>
  );

  let corpo: ReactNode;
  if (pub === undefined) corpo = <p className="suave" style={{ textAlign: 'center' }}>Carregando…</p>;
  else if (pub === null) {
    corpo = (
      <div className="cartao" style={{ textAlign: 'center' }}>
        <p>Este formulário não está recebendo pedidos agora. 🤍</p>
        <p className="suave">Fale comigo pelo WhatsApp ou pelo Instagram que eu te ajudo.</p>
      </div>
    );
  } else if (enviado) {
    corpo = (
      <div className="cartao" style={{ textAlign: 'center' }}>
        <h2>Recebi o seu pedido 💜</h2>
        <p>Obrigada, {nome.trim().split(' ')[0]}! Vou olhar com carinho e entro em contato pelo {contato.includes('@') ? 'e-mail' : 'WhatsApp'} que você deixou para confirmar os detalhes e o valor.</p>
        <button className="btn" onClick={() => { setEnviado(false); setEscolhas(escolhasPadrao(pub.grupos, info, 1)); setObservacao(''); abertoEm.current = Date.now(); }}>Fazer outro pedido</button>
      </div>
    );
  } else {
    corpo = (
      <div className="cartao">
        <h2>{pub.titulo}</h2>
        <p className="suave">{pub.boasVindas}</p>

        <div className="formgrid" style={{ marginTop: 8 }}>
          <Campo rotulo="Seu nome"><input type="text" autoComplete="name" value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} /></Campo>
          <Campo rotulo="WhatsApp ou e-mail"><input type="text" autoComplete="off" value={contato} maxLength={160} onChange={(e) => setContato(e.target.value)} /></Campo>
          <Campo rotulo="Quantas unidades?"><input type="number" min={1} max={MAX_QUANTIDADE} inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></Campo>
        </div>

        <FormularioItem grupos={pub.grupos} escolhas={escolhas} unidades={Number.isFinite(qtd) && qtd > 0 ? qtd : 1} info={info} mult={1} aoMudar={setEscolhas} />

        <div className="formgrid" style={{ marginTop: 12 }}>
          <Campo rotulo="Quer contar mais alguma coisa? (opcional)">
            <textarea rows={3} style={{ width: '100%' }} maxLength={1000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        </div>

        {/* campo-armadilha para robôs: pessoas não veem nem preenchem */}
        <div style={ESCONDIDO} aria-hidden="true">
          <label>Não preencha este campo<input type="text" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} /></label>
        </div>

        {escolhas.length > 0 && (
          <div className="cartao" style={{ background: 'var(--neutro)', marginTop: 12 }}>
            <strong>Resumo do seu pedido</strong>
            <ul style={{ margin: '6px 0' }}>{linhasDeEscolhas(escolhas).map((l, k) => <li key={k}>{l}</li>)}</ul>
            {porUnidade > 0 && (
              <p style={{ margin: 0 }}>
                Opções escolhidas: <strong>{centavosParaTexto(porUnidade)}</strong>{qtd > 1 && Number.isFinite(qtd) ? ` por unidade (${centavosParaTexto(porUnidade * qtd)} em ${qtd})` : ''}
              </p>
            )}
            <p className="suave" style={{ margin: '4px 0 0', fontSize: 'calc(13px * var(--escala, 1))' }}>
              É uma estimativa só das opções que você marcou. O valor final, com o produto em si, eu confirmo com você antes de começar.
            </p>
          </div>
        )}

        {erro && <p className="aviso" style={{ marginTop: 10 }}>{erro}</p>}
        <div className="linha" style={{ marginTop: 12 }}>
          <button className="btn primario" disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Enviando…' : 'Enviar meu pedido'}</button>
        </div>
        <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>Enviar não é uma compra: é só o primeiro passo para a gente combinar tudo. 🌸</p>
      </div>
    );
  }

  return (
    <main className="conteudo" style={{ maxWidth: 720, margin: '0 auto', padding: '16px' }}>
      {cabecalho}
      <div className="faixa" />
      {corpo}
    </main>
  );
}
