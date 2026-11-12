import { useEffect, useState, type ChangeEvent } from 'react';
import { listarTemasPersonalizados, salvarTema } from '../../dados/temas.ts';
import { reduzirImagem } from '../../dados/imagem.ts';
import type { Preferencias } from '../tema/tema.ts';
import {
  DIAS_ANTES, DIAS_DEPOIS, MOTIVOS, TEMAS_PRONTOS, clarear, completarTema, daBase, proximaDataDoTema,
  type AparenciaDoTema, type ImagemDoMenu, type Motivo, type TemaBase, type TemaPersonalizado, type TemaResolvido,
} from '../../dominio/temas.ts';
import { PreviaTema } from '../tema/PreviaTema.tsx';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import { Campo } from './FinanceiroCampos.tsx';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ehPronto = (id: string) => TEMAS_PRONTOS.some((b) => b.id === id);

function novo(): TemaPersonalizado {
  return completarTema({
    id: '', nome: '', regra: { tipo: 'fixa', mes: 1, dia: 1 }, cores: { principal: '#8A4F9E', principalEscuro: clarear('#8A4F9E'), apoio: '#F1CDD9', menu: '#4A2E5F' },
    motivo: 'estrela', corMotivo: '#C398C8', saudacao: '',
  });
}

type ComNome = AparenciaDoTema & { nome: string };

function CartaoTema(p: {
  t: TemaBase & AparenciaDoTema; prefs: Preferencias; ajustado?: boolean; ativo: boolean; hoje: string; depois: number;
  aoUsar: () => void; aoVer: () => void; aoEditar: () => void; aoRestaurar?: () => void;
}) {
  const data = proximaDataDoTema(p.t.regra, p.hoje, p.depois);
  return (
    <div className="tema-cartao" aria-current={p.ativo}>
      <div style={{ padding: 8 }}><PreviaTema aparencia={p.t} prefs={p.prefs} titulo={p.t.nome} /></div>
      <div className="corpo">
        <strong>{p.t.nome}{p.ajustado ? ' ✨' : ''}</strong>
        <span className="suave" style={{ fontSize: 13 }}>{data ? dataParaTexto(data) : 'sem data (uso manual)'}{p.ajustado ? ' · ajustado por você' : ''}</span>
        <div className="linha" style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ minHeight: 36 }} onClick={p.aoUsar} disabled={p.ativo}>{p.ativo ? 'Em uso' : 'Usar agora'}</button>
          <button className="btn" style={{ minHeight: 36 }} onClick={p.aoVer}>Ver maior</button>
          <button className="btn" style={{ minHeight: 36 }} onClick={p.aoEditar}>Editar</button>
          {p.aoRestaurar && <button className="btn" style={{ minHeight: 36 }} onClick={p.aoRestaurar}>Restaurar original</button>}
        </div>
      </div>
    </div>
  );
}

function SeletorImagem(p: { rotulo: string; imagem: Blob | null; aoMudar: (b: Blob | null) => void; aoErro: (m: string) => void }) {
  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      p.aoMudar(await reduzirImagem(f, 1920));
      p.aoErro('');
    } catch (x) {
      p.aoErro(x instanceof Error ? x.message : 'Não consegui usar essa imagem.');
    }
  }
  return (
    <div className="linha">
      <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {p.imagem ? `Trocar ${p.rotulo}` : `Enviar ${p.rotulo}`}
        <input type="file" accept="image/*" hidden onChange={(e) => void escolher(e)} />
      </label>
      {p.imagem && <button className="btn" onClick={() => p.aoMudar(null)}>Tirar</button>}
    </div>
  );
}

function ModoDaImagem(p: { modo: 'unica' | 'repetida'; aoModo: (m: 'unica' | 'repetida') => void; tamanho?: number; aoTamanho?: (n: number) => void }) {
  return (
    <>
      <div className="linha">
        <button className="pilula" aria-pressed={p.modo === 'unica'} onClick={() => p.aoModo('unica')}>Uma imagem só</button>
        <button className="pilula" aria-pressed={p.modo === 'repetida'} onClick={() => p.aoModo('repetida')}>Imagem repetida</button>
      </div>
      {p.modo === 'repetida' && p.aoTamanho && (
        <Campo rotulo={`Tamanho de cada repetição: ${p.tamanho}px`}>
          <input type="range" min={60} max={400} step={20} value={p.tamanho} onChange={(e) => p.aoTamanho!(Number(e.target.value))} />
        </Campo>
      )}
    </>
  );
}

function Formulario(p: { inicial: TemaPersonalizado; prefs: Preferencias; aoSalvar: (t: TemaPersonalizado) => Promise<void>; aoCancelar: () => void }) {
  const [t, setT] = useState(p.inicial);
  const [erro, setErro] = useState('');
  const pronto = ehPronto(p.inicial.id);
  const comData = t.regra.tipo === 'fixa';
  const regra = t.regra.tipo === 'fixa' ? t.regra : { tipo: 'fixa' as const, mes: 1, dia: 1 };
  const temFundo = !!t.imagem || t.motivo !== 'nenhum';

  function salvar() {
    if (!t.nome.trim()) return setErro('Dê um nome ao tema.');
    if (regra.tipo === 'fixa' && comData) {
      const d = new Date(Date.UTC(2024, regra.mes - 1, regra.dia));
      if (d.getUTCMonth() !== regra.mes - 1) return setErro('Essa data não existe nesse mês.');
    }
    void p.aoSalvar({ ...t, nome: t.nome.trim(), cores: { ...t.cores, principalEscuro: clarear(t.cores.principal) }, regra: comData ? regra : { tipo: 'nenhuma' } });
  }

  return (
    <section className="cartao">
      <h2>{pronto ? `Ajustar “${p.inicial.nome}”` : p.inicial.id ? 'Editar tema' : 'Novo tema'}</h2>
      {pronto && <p className="suave" style={{ marginTop: 0 }}>É um tema pronto: o que você mudar aqui passa a valer no lugar dele, e dá para voltar ao original quando quiser.</p>}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--cartao)', padding: '4px 0 10px' }}>
        <PreviaTema grande aparencia={t} prefs={p.prefs} titulo={t.nome || 'Seu tema'} />
        <span className="suave" style={{ fontSize: 12 }}>Pré-visualização: nada muda no app até você salvar e usar o tema.</span>
      </div>
      <div className="formgrid">
        <Campo rotulo="Nome do tema"><input type="text" value={t.nome} onChange={(e) => setT({ ...t, nome: e.target.value })} /></Campo>
        <Campo rotulo="Frase de boas-vindas no Início (opcional)"><input type="text" value={t.saudacao} onChange={(e) => setT({ ...t, saudacao: e.target.value })} /></Campo>
      </div>
      <div className="linha" style={{ marginTop: 10 }}>
        <label className="linha"><input type="checkbox" checked={comData} onChange={(e) => setT({ ...t, regra: e.target.checked ? regra : { tipo: 'nenhuma' } })} /> Acontece todo ano numa data (entra sozinho)</label>
      </div>
      {comData && (
        <div className="formgrid">
          <Campo rotulo="Dia"><input type="number" min={1} max={31} value={regra.dia} onChange={(e) => setT({ ...t, regra: { ...regra, dia: Math.min(31, Math.max(1, Math.round(Number(e.target.value) || 1))) } })} /></Campo>
          <Campo rotulo="Mês">
            <select value={regra.mes} onChange={(e) => setT({ ...t, regra: { ...regra, mes: Number(e.target.value) } })}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Campo>
        </div>
      )}
      {pronto && t.regra.tipo !== 'fixa' && t.regra.tipo !== 'nenhuma' && <p className="suave" style={{ fontSize: 13 }}>A data deste tema muda a cada ano (ex.: Páscoa) e segue a regra original.</p>}

      <h3 style={{ margin: '14px 0 6px' }}>Cores</h3>
      <div className="linha" style={{ gap: 18 }}>
        <label>Botões e destaques <input type="color" value={t.cores.principal} onChange={(e) => setT({ ...t, cores: { ...t.cores, principal: e.target.value } })} /></label>
        <label>Detalhes suaves <input type="color" value={t.cores.apoio} onChange={(e) => setT({ ...t, cores: { ...t.cores, apoio: e.target.value } })} /></label>
        <label>Menu lateral <input type="color" value={t.cores.menu} onChange={(e) => setT({ ...t, cores: { ...t.cores, menu: e.target.value } })} /></label>
      </div>

      <h3 style={{ margin: '14px 0 6px' }}>Fundo da tela</h3>
      <SeletorImagem rotulo="imagem de fundo" imagem={t.imagem} aoMudar={(imagem) => setT({ ...t, imagem })} aoErro={setErro} />
      {t.imagem ? (
        <div style={{ marginTop: 8 }}>
          <ModoDaImagem modo={t.modoImagem} aoModo={(modoImagem) => setT({ ...t, modoImagem })} tamanho={t.tamanho} aoTamanho={(tamanho) => setT({ ...t, tamanho })} />
          <Campo rotulo={`Suavidade da imagem: ${t.veu}%`}>
            <input type="range" min={40} max={95} step={5} value={t.veu} onChange={(e) => setT({ ...t, veu: Number(e.target.value) })} />
            <span className="suave" style={{ fontSize: 12, fontWeight: 400 }}>Mais alto deixa a imagem mais clara e o texto mais fácil de ler.</span>
          </Campo>
        </div>
      ) : (
        <div className="linha" style={{ marginTop: 8, alignItems: 'flex-end' }}>
          <Campo rotulo="Ou um desenho repetido">
            <select value={t.motivo} onChange={(e) => setT({ ...t, motivo: e.target.value as Motivo })}>
              {Object.entries(MOTIVOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
          <label>Cor do desenho <input type="color" value={t.corMotivo} onChange={(e) => setT({ ...t, corMotivo: e.target.value })} /></label>
        </div>
      )}

      <h3 style={{ margin: '14px 0 6px' }}>Fundo do menu lateral</h3>
      <div className="linha">
        {([['nenhuma', 'Só a cor'], ['mesma', 'Mesmo fundo da tela'], ['propria', 'Outra imagem']] as [ImagemDoMenu, string][]).map(([v, n]) => (
          <button key={v} className="pilula" aria-pressed={t.menuImagem === v} onClick={() => setT({ ...t, menuImagem: v })}>{n}</button>
        ))}
      </div>
      {t.menuImagem === 'mesma' && !temFundo && <p className="suave" style={{ fontSize: 13 }}>Este tema ainda não tem imagem nem desenho de fundo para repetir no menu.</p>}
      {t.menuImagem === 'propria' && (
        <div style={{ marginTop: 8 }}>
          <SeletorImagem rotulo="imagem do menu" imagem={t.menuImagemPropria} aoMudar={(menuImagemPropria) => setT({ ...t, menuImagemPropria })} aoErro={setErro} />
        </div>
      )}
      {t.menuImagem !== 'nenhuma' && (
        <div style={{ marginTop: 8 }}>
          {(t.menuImagem === 'propria' || t.imagem) && (
            <ModoDaImagem modo={t.menuModo} aoModo={(menuModo) => setT({ ...t, menuModo })} tamanho={t.tamanho} aoTamanho={(tamanho) => setT({ ...t, tamanho })} />
          )}
          <Campo rotulo={`Suavidade no menu: ${t.menuVeu}%`}>
            <input type="range" min={30} max={95} step={5} value={t.menuVeu} onChange={(e) => setT({ ...t, menuVeu: Number(e.target.value) })} />
            <span className="suave" style={{ fontSize: 12, fontWeight: 400 }}>Mais alto deixa a cor do menu mais forte e as letras mais fáceis de ler.</span>
          </Campo>
        </div>
      )}

      {erro && <p className="aviso" role="alert">{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={salvar}>Salvar tema</button>
        <button className="btn" onClick={p.aoCancelar}>Voltar</button>
        {p.inicial.id && !pronto && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void p.aoSalvar({ ...t, ativo: false })}>Arquivar tema</button>}
        {pronto && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setT({ ...daBase(TEMAS_PRONTOS.find((b) => b.id === p.inicial.id)!), id: p.inicial.id })}>Voltar ao original (no formulário)</button>}
      </div>
    </section>
  );
}

export function TemasFestivos({ prefs, aoMudar, tema }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void; tema: TemaResolvido | null }) {
  const [meus, setMeus] = useState<TemaPersonalizado[]>([]);
  const [editando, setEditando] = useState<TemaPersonalizado | null>(null);
  const [vendo, setVendo] = useState<(ComNome & { id: string }) | null>(null);
  const hoje = hojeLocal();
  const modo = prefs.temaFestivo ?? 'automatico';
  const antes = prefs.temaDiasAntes ?? DIAS_ANTES;
  const depois = prefs.temaDiasDepois ?? DIAS_DEPOIS;

  const recarregar = async () => setMeus((await listarTemasPersonalizados()).filter((t) => t.ativo));
  useEffect(() => {
    void recarregar();
  }, []);

  if (editando) {
    return <Formulario inicial={editando} prefs={prefs} aoCancelar={() => setEditando(null)} aoSalvar={async (t) => { await salvarTema(t); setEditando(null); await recarregar(); }} />;
  }

  const escolher = (id: string) => aoMudar({ ...prefs, temaFestivo: id });
  const numero = (k: 'temaDiasAntes' | 'temaDiasDepois', v: string) => aoMudar({ ...prefs, [k]: Math.min(30, Math.max(0, Math.round(Number(v) || 0))) });
  const ajuste = (id: string) => meus.find((m) => m.id === id);
  const proprios = meus.filter((m) => !ehPronto(m.id));
  const restaurar = async (m: TemaPersonalizado) => { await salvarTema({ ...m, ativo: false }); await recarregar(); };

  return (
    <>
      <p className="suave" style={{ marginTop: 0 }}>Deixe o app com o clima de cada festividade: cores, imagens de fundo (na tela e no menu) e uma frase de boas-vindas no Início. Todos os temas podem ser ajustados, com pré-visualização antes de usar. 🌸</p>
      <section className="cartao" style={{ marginTop: 0 }}>
        <h2>Como usar</h2>
        <div className="linha">
          <button className="pilula" aria-pressed={modo === 'automatico'} onClick={() => escolher('automatico')}>Automático</button>
          <button className="pilula" aria-pressed={modo === 'desligado'} onClick={() => escolher('desligado')}>Sem tema (visual padrão)</button>
          {modo !== 'automatico' && modo !== 'desligado' && <button className="pilula" aria-pressed>Escolhido por mim</button>}
        </div>
        <p style={{ margin: '10px 0 0' }}>
          {tema
            ? <>Agora: <strong>{tema.nome}</strong>{tema.fim ? `, até ${dataParaTexto(tema.fim)}, e depois volta ao padrão sozinho.` : ' (fica até você mudar).'}</>
            : <>Agora: visual padrão. {modo === 'automatico' ? 'O tema entra sozinho perto de cada data.' : ''}</>}
        </p>
        {modo === 'automatico' && (
          <div className="formgrid" style={{ maxWidth: 440 }}>
            <Campo rotulo="Começa quantos dias antes da data"><input type="number" min={0} max={30} value={antes} onChange={(e) => numero('temaDiasAntes', e.target.value)} /></Campo>
            <Campo rotulo="Fica quantos dias depois"><input type="number" min={0} max={30} value={depois} onChange={(e) => numero('temaDiasDepois', e.target.value)} /></Campo>
          </div>
        )}
        <p className="suave" style={{ margin: '8px 0 0', fontSize: 13 }}>Enquanto um tema está valendo, as cores dele ficam no lugar das suas cores. Ao escolher um tema com “Usar agora”, ele fica até você voltar ao Automático ou ao padrão.</p>
      </section>

      {vendo && (
        <section className="cartao" aria-live="polite">
          <h2>Pré-visualização: {vendo.nome}</h2>
          <PreviaTema grande aparencia={vendo} prefs={prefs} titulo={vendo.nome} />
          <div className="linha" style={{ marginTop: 10 }}>
            <button className="btn primario" onClick={() => { escolher(vendo.id); setVendo(null); }}>Usar este tema</button>
            <button className="btn" onClick={() => setVendo(null)}>Fechar</button>
          </div>
          <p className="suave" style={{ fontSize: 12, margin: '8px 0 0' }}>Nada muda no app até você escolher “Usar este tema”.</p>
        </section>
      )}

      <h2 style={{ margin: '18px 0 8px' }}>Temas prontos</h2>
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {TEMAS_PRONTOS.map((b) => {
          const m = ajuste(b.id);
          const t = m ?? daBase(b);
          return (
            <CartaoTema
              key={b.id} t={t} prefs={prefs} ajustado={!!m} ativo={tema?.id === b.id} hoje={hoje} depois={depois}
              aoUsar={() => escolher(b.id)} aoVer={() => setVendo(t)} aoEditar={() => setEditando(t)}
              aoRestaurar={m ? () => void restaurar(m) : undefined}
            />
          );
        })}
      </div>

      <div className="linha" style={{ margin: '18px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Meus temas</h2>
        <button className="btn primario" style={{ marginLeft: 'auto' }} onClick={() => setEditando(novo())}>Criar tema</button>
      </div>
      {proprios.length === 0 && <p className="suave" style={{ margin: 0 }}>Você ainda não criou nenhum. Dá para usar suas próprias imagens e cores, para uma data do atelier, por exemplo.</p>}
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {proprios.map((t) => (
          <CartaoTema key={t.id} t={t} prefs={prefs} ativo={tema?.id === t.id} hoje={hoje} depois={depois} aoUsar={() => escolher(t.id)} aoVer={() => setVendo(t)} aoEditar={() => setEditando(t)} />
        ))}
      </div>
    </>
  );
}
