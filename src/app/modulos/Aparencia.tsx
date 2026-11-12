import { useEffect } from 'react';
import {
  FONTES_CORPO, FONTES_SCRIPT, FONTES_TITULO, PALETAS, PREFERENCIAS_PADRAO, achar, urlDasFontes, type Fonte, type Modo, type Preferencias,
} from '../tema/tema.ts';
import { carregarFontes } from '../tema/fontes.ts';

const MODOS: { id: Modo; nome: string }[] = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'automatico', nome: 'Automático' },
];

const Bolinha = ({ cor }: { cor: string }) => <span style={{ width: 22, height: 22, borderRadius: 11, background: cor, display: 'inline-block', border: '1px solid var(--borda)', flex: 'none' }} />;

function EscolhaDeFonte(p: { titulo: string; dica: string; fontes: Fonte[]; escolhida: string | undefined; amostra: string; tamanho: number; aoEscolher: (id: string) => void }) {
  const atual = achar(p.fontes, p.escolhida);
  return (
    <section className="cartao" style={{ marginTop: 0 }}>
      <h2>{p.titulo}</h2>
      <p className="suave" style={{ marginTop: 0 }}>{p.dica}</p>
      <div className="linha" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {p.fontes.map((f) => (
          <button key={f.id} className="pilula" aria-pressed={atual.id === f.id} onClick={() => p.aoEscolher(f.id)} style={{ textAlign: 'left', fontFamily: f.familia, fontSize: p.tamanho, minHeight: 48 }}>
            {p.amostra} <span style={{ fontSize: 12, opacity: 0.75, fontFamily: 'var(--fonte-corpo)' }}> · {f.nome}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Aparencia({ prefs, aoMudar }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void }) {
  const paleta = PALETAS.find((p) => p.id === prefs.paletaId) ?? PALETAS[0];

  // Para mostrar cada opção na sua própria fonte, baixa todas enquanto esta tela está aberta.
  useEffect(() => {
    carregarFontes('opcoes', urlDasFontes([...FONTES_CORPO, ...FONTES_TITULO, ...FONTES_SCRIPT]));
    return () => carregarFontes('opcoes', '');
  }, []);

  return (
    <>
      <h1>Aparência e marca</h1>
      <p className="suave">Estas escolhas ficam guardadas neste aparelho. No tablet, escolha de novo do seu jeito.</p>
      <div className="grade">
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
          <div className="script" style={{ fontSize: 36, lineHeight: 1.2 }}>Craft Notes Unique</div>
          <h3 style={{ margin: '4px 0' }}>Pedido #12 · Maria</h3>
          <p style={{ margin: '0 0 10px' }}>Cada caderno nasce pensado pra sua história.</p>
          <div className="linha">
            <button className="btn primario">Concluir etapa</button>
            <button className="btn">Ver pedido</button>
            <span className="etiqueta">Em produção</span>
          </div>
        </section>
      </div>

      <section className="cartao">
        <h2>Cores</h2>
        <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
          {PALETAS.map((p) => (
            <button
              key={p.id}
              className="pilula"
              aria-pressed={prefs.paletaId === p.id}
              onClick={() => aoMudar({ ...prefs, paletaId: p.id, principalLivre: undefined, apoioLivre: undefined, menuLivre: undefined })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
            >
              <Bolinha cor={p.principal} />
              <Bolinha cor={p.apoio} />
              <Bolinha cor={p.menu} />
              <span>{p.nome}</span>
            </button>
          ))}
        </div>
        <h3 style={{ margin: '16px 0 6px' }}>Ou escolha as suas cores</h3>
        <div className="linha" style={{ gap: 18 }}>
          <label>Botões e destaques{' '}<input type="color" value={prefs.principalLivre ?? paleta.principal} onChange={(e) => aoMudar({ ...prefs, principalLivre: e.target.value })} /></label>
          <label>Detalhes suaves{' '}<input type="color" value={prefs.apoioLivre ?? paleta.apoio} onChange={(e) => aoMudar({ ...prefs, apoioLivre: e.target.value })} /></label>
          <label>Menu lateral{' '}<input type="color" value={prefs.menuLivre ?? paleta.menu} onChange={(e) => aoMudar({ ...prefs, menuLivre: e.target.value })} /></label>
          <button className="btn" onClick={() => aoMudar({ ...prefs, principalLivre: undefined, apoioLivre: undefined, menuLivre: undefined })}>Voltar às cores da paleta</button>
        </div>
        <p className="suave">O texto sobre as cores troca sozinho entre claro e escuro para manter a leitura. No modo escuro, o menu fica escuro, a menos que você escolha uma cor para ele.</p>
      </section>

      <div className="grade" style={{ marginTop: 16 }}>
        <EscolhaDeFonte titulo="Fonte dos títulos" dica="Nomes de telas e cartões." fontes={FONTES_TITULO} escolhida={prefs.fonteTitulo} amostra="Pedidos em andamento" tamanho={20}
          aoEscolher={(id) => aoMudar({ ...prefs, fonteTitulo: id })} />
        <EscolhaDeFonte titulo="Fonte do texto" dica="Textos, tabelas e botões." fontes={FONTES_CORPO} escolhida={prefs.fonteCorpo} amostra="Cada detalhe feito à mão" tamanho={16}
          aoEscolher={(id) => aoMudar({ ...prefs, fonteCorpo: id })} />
        <EscolhaDeFonte titulo="Fonte cursiva" dica="O nome do atelier no menu." fontes={FONTES_SCRIPT} escolhida={prefs.fonteScript} amostra="Craft Notes Unique" tamanho={26}
          aoEscolher={(id) => aoMudar({ ...prefs, fonteScript: id })} />
      </div>
      <p className="suave">As fontes vêm da internet. Sem conexão, o app usa uma fonte parecida até voltar.</p>
      <div className="rodape" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => aoMudar({ ...PREFERENCIAS_PADRAO, modo: prefs.modo })}>Voltar ao visual padrão da marca</button>
      </div>
    </>
  );
}
