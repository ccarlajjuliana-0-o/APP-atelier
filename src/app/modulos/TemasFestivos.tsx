import { useEffect, useState, type ChangeEvent } from 'react';
import { listarTemasPersonalizados, salvarTema } from '../../dados/temas.ts';
import { medirImagem, prepararFundo } from '../../dados/imagem.ts';
import { AREA_REFERENCIA, LADO_MINIMO_ENVIO, LARGURA_RECOMENDADA_UNICA, avaliarQualidade, ladoEmPx, type Disposicao, type Medida } from '../../dominio/ladrilho.ts';
import type { Preferencias } from '../tema/tema.ts';
import {
  DIAS_ANTES, DIAS_DEPOIS, MOTIVOS, TEMAS_PRONTOS, clarear, completarTema, daBase, proximaDataDoTema,
  type AparenciaDoTema, type ImagemDoMenu, type Motivo, type TemaBase, type TemaPersonalizado, type TemaResolvido,
} from '../../dominio/temas.ts';
import { PreviaTema } from '../tema/PreviaTema.tsx';
import { variaveis } from '../tema/tema.ts';
import { SeletorCor } from '../componentes/SeletorCor.tsx';
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
        <span className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{data ? dataParaTexto(data) : 'sem data (uso manual)'}{p.ajustado ? ' · ajustado por você' : ''}</span>
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
      p.aoMudar(await prepararFundo(f, LADO_MINIMO_ENVIO));
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

/** Largura e altura da imagem enviada (para avaliar a qualidade). */
function useMedidas(imagem: Blob | null): { largura: number; altura: number } | null {
  const [m, setM] = useState<{ largura: number; altura: number } | null>(null);
  useEffect(() => {
    let ativo = true;
    if (!imagem) { setM(null); return; }
    medirImagem(imagem).then((r) => ativo && setM(r), () => ativo && setM(null));
    return () => { ativo = false; };
  }, [imagem]);
  return m;
}

const DISPOSICOES: [Disposicao, string][] = [['grade', 'Alinhada'], ['diagonal', 'Em diagonal'], ['aleatoria', 'Espalhada']];
const MEDIDAS: [Medida, string][] = [['tamanho', 'Por tamanho'], ['porLinha', 'Por imagens na linha']];

/** Opções de tamanho e de repetição de uma imagem de fundo (tela ou menu), com aviso de qualidade. */
function OpcoesDaImagem(p: { t: TemaPersonalizado; setT: (t: TemaPersonalizado) => void; alvo: 'tela' | 'menu'; imagem: Blob | null }) {
  const { t, setT } = p;
  const modo = p.alvo === 'tela' ? t.modoImagem : t.menuModo;
  const mudarModo = (m: 'unica' | 'repetida') => setT(p.alvo === 'tela' ? { ...t, modoImagem: m } : { ...t, menuModo: m });
  const med = useMedidas(p.imagem);
  const area = p.alvo === 'tela' ? Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 1400) - 296) : 200;
  const lado = ladoEmPx({ medida: t.medida, tamanho: t.tamanho, porLinha: t.porLinha, areaLargura: area });
  const q = med ? avaliarQualidade({ larguraImagem: med.largura, alturaImagem: med.altura, modo, unico: t.tamanhoUnico, lado: p.alvo === 'tela' ? lado : Math.min(lado, 200), areaLargura: p.alvo === 'tela' ? AREA_REFERENCIA.largura : 232, areaAltura: p.alvo === 'tela' ? AREA_REFERENCIA.altura : 700 }) : null;
  // Para a imagem não desfocar, o tamanho máximo acompanha a resolução dela.
  const maxTamanho = q ? Math.min(400, Math.max(60, Math.floor(q.maxLado / 20) * 20)) : 400;
  const minPorLinha = q ? Math.min(12, Math.max(1, Math.ceil(area / q.maxLado))) : 1;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="linha">
        <button className="pilula" aria-pressed={modo === 'unica'} onClick={() => mudarModo('unica')}>Uma imagem só</button>
        <button className="pilula" aria-pressed={modo === 'repetida'} onClick={() => mudarModo('repetida')}>Imagem repetida</button>
      </div>
      {modo === 'unica' ? (
        <Campo rotulo={`Tamanho da imagem: ${t.tamanhoUnico >= 100 ? 'cobrindo tudo' : `${t.tamanhoUnico}% da largura`}`}>
          <input type="range" min={20} max={100} step={5} value={t.tamanhoUnico} onChange={(e) => setT({ ...t, tamanhoUnico: Number(e.target.value) })} />
          <span className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', fontWeight: 400 }}>
            100% cobre toda a área. Menos que isso mostra a imagem menor, no alto e ao centro.{q && q.maxPorcentagem < 100 ? ` Para esta imagem, até ${q.maxPorcentagem}% sem perder nitidez.` : ''}
          </span>
        </Campo>
      ) : (
        <>
          <h4 style={{ margin: '10px 0 4px' }}>Como se repete</h4>
          <div className="linha">
            {DISPOSICOES.map(([v, n]) => <button key={v} className="pilula" aria-pressed={t.disposicao === v} onClick={() => setT({ ...t, disposicao: v })}>{n}</button>)}
          </div>
          <div className="linha" style={{ marginTop: 8 }}>
            {MEDIDAS.map(([v, n]) => <button key={v} className="pilula" aria-pressed={t.medida === v} onClick={() => setT({ ...t, medida: v })}>{n}</button>)}
          </div>
          {t.medida === 'tamanho' ? (
            <Campo rotulo={`Tamanho de cada imagem: ${Math.min(t.tamanho, maxTamanho)}px${q && maxTamanho < 400 ? ` (máximo para esta imagem: ${maxTamanho}px)` : ''}`}>
              <input type="range" min={60} max={maxTamanho} step={20} value={Math.min(t.tamanho, maxTamanho)} onChange={(e) => setT({ ...t, tamanho: Number(e.target.value) })} />
            </Campo>
          ) : (
            <Campo rotulo={`Imagens em cada linha: ${Math.max(t.porLinha, minPorLinha)}${minPorLinha > 1 ? ` (mínimo para esta imagem: ${minPorLinha})` : ''}`}>
              <input type="range" min={minPorLinha} max={12} step={1} value={Math.max(t.porLinha, minPorLinha)} onChange={(e) => setT({ ...t, porLinha: Number(e.target.value) })} />
            </Campo>
          )}
          <Campo rotulo={`${t.disposicao === 'aleatoria' ? 'Espaço extra entre as imagens' : 'Espaço entre as imagens'}: ${t.espaco}px`}>
            <input type="range" min={0} max={120} step={5} value={t.espaco} onChange={(e) => setT({ ...t, espaco: Number(e.target.value) })} />
          </Campo>
          {t.disposicao === 'aleatoria' && <span className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>Espalhada: as imagens ficam em posições variadas e levemente giradas, sempre do mesmo jeito.</span>}
        </>
      )}
      {med && q && (
        <p className={q.nivel === 'baixa' ? 'aviso' : 'suave'} role="status" style={{ fontSize: 'calc(13px * var(--escala, 1))', marginTop: 8 }}>
          {q.nivel === 'baixa'
            ? <>⚠️ Qualidade: esta imagem tem {med.largura}×{med.altura} px e seria esticada para ~{q.larguraMostrada} px, então pode ficar desfocada. {modo === 'unica' ? (q.maxPorcentagem < 100 ? `Reduza para até ${q.maxPorcentagem}% ou envie uma imagem com pelo menos ${LARGURA_RECOMENDADA_UNICA} px de largura.` : `Envie uma imagem com pelo menos ${LARGURA_RECOMENDADA_UNICA} px de largura.`) : `Diminua o tamanho (máximo recomendado ${q.maxLado} px) ou envie uma imagem maior.`}</>
            : q.nivel === 'boa'
              ? <>Qualidade boa: nítida na maioria das telas; em telas de alta resolução pode ficar um pouco suave.</>
              : <>Qualidade ótima: nítida até em telas de alta resolução.</>}
        </p>
      )}
    </div>
  );
}

function Formulario(p: { inicial: TemaPersonalizado; prefs: Preferencias; aoSalvar: (t: TemaPersonalizado) => Promise<void>; aoCancelar: () => void }) {
  const [t, setT] = useState(p.inicial);
  const [erro, setErro] = useState('');
  const pronto = ehPronto(p.inicial.id);
  const comData = t.regra.tipo === 'fixa';
  const regra = t.regra.tipo === 'fixa' ? t.regra : { tipo: 'fixa' as const, mes: 1, dia: 1 };
  const padraoClaro = variaveis({ ...p.prefs, modo: 'claro', fundoLivre: undefined, textoLivre: undefined }, false)['--fundo'];
  const padraoEscuro = variaveis({ ...p.prefs, modo: 'escuro', fundoLivre: undefined, textoLivre: undefined }, true)['--fundo'];
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
        <span className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>Pré-visualização: nada muda no app até você salvar e usar o tema.</span>
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
      {pronto && t.regra.tipo !== 'fixa' && t.regra.tipo !== 'nenhuma' && <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>A data deste tema muda a cada ano (ex.: Páscoa) e segue a regra original.</p>}

      <h3 style={{ margin: '14px 0 6px' }}>Cores</h3>
      <div className="linha" style={{ gap: 18 }}>
        <div className="item"><SeletorCor rotulo="Botões e destaques" valor={t.cores.principal} aoMudar={(c) => setT({ ...t, cores: { ...t.cores, principal: c, principalEscuro: clarear(c) } })} />Botões e destaques</div>
        <div className="item"><SeletorCor rotulo="Detalhes suaves" valor={t.cores.apoio} aoMudar={(c) => setT({ ...t, cores: { ...t.cores, apoio: c } })} />Detalhes suaves</div>
        <div className="item"><SeletorCor rotulo="Menu lateral" valor={t.cores.menu} aoMudar={(c) => setT({ ...t, cores: { ...t.cores, menu: c } })} />Menu lateral</div>
        <div className="item">
          <SeletorCor rotulo="Plano de fundo (modo claro)" valor={t.cores.fundo ?? padraoClaro} aoMudar={(c) => setT({ ...t, cores: { ...t.cores, fundo: c } })} />
          <SeletorCor rotulo="Plano de fundo (modo escuro)" valor={t.cores.fundoEscuro ?? padraoEscuro} aoMudar={(c) => setT({ ...t, cores: { ...t.cores, fundoEscuro: c } })} />
          Plano de fundo (claro · escuro)
          {(t.cores.fundo || t.cores.fundoEscuro) && <button className="btn pequeno" onClick={() => setT({ ...t, cores: { ...t.cores, fundo: undefined, fundoEscuro: undefined } })}>Padrão</button>}
        </div>
      </div>

      <h3 style={{ margin: '14px 0 6px' }}>Fundo da tela</h3>
      <SeletorImagem rotulo="imagem de fundo" imagem={t.imagem} aoMudar={(imagem) => setT({ ...t, imagem })} aoErro={setErro} />
      {t.imagem ? (
        <div>
          <OpcoesDaImagem t={t} setT={setT} alvo="tela" imagem={t.imagem} />
          <Campo rotulo={`Suavidade da imagem: ${t.veu}%`}>
            <input type="range" min={40} max={95} step={5} value={t.veu} onChange={(e) => setT({ ...t, veu: Number(e.target.value) })} />
            <span className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', fontWeight: 400 }}>Mais alto deixa a imagem mais clara e o texto mais fácil de ler.</span>
          </Campo>
        </div>
      ) : (
        <div className="linha" style={{ marginTop: 8, alignItems: 'flex-end' }}>
          <Campo rotulo="Ou um desenho repetido">
            <select value={t.motivo} onChange={(e) => setT({ ...t, motivo: e.target.value as Motivo })}>
              {Object.entries(MOTIVOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
          <div className="item"><SeletorCor rotulo="Cor do desenho" valor={t.corMotivo} aoMudar={(c) => setT({ ...t, corMotivo: c })} />Cor do desenho</div>
        </div>
      )}
      {!t.imagem && t.motivo !== 'nenhum' && (
        <Campo rotulo={`Tamanho do desenho: ${t.tamanho}px`}>
          <input type="range" min={60} max={400} step={20} value={t.tamanho} onChange={(e) => setT({ ...t, tamanho: Number(e.target.value) })} />
        </Campo>
      )}

      <h3 style={{ margin: '14px 0 6px' }}>Fundo do menu lateral</h3>
      <div className="linha">
        {([['nenhuma', 'Só a cor'], ['mesma', 'Mesmo fundo da tela'], ['propria', 'Outra imagem']] as [ImagemDoMenu, string][]).map(([v, n]) => (
          <button key={v} className="pilula" aria-pressed={t.menuImagem === v} onClick={() => setT({ ...t, menuImagem: v })}>{n}</button>
        ))}
      </div>
      {t.menuImagem === 'mesma' && !temFundo && <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>Este tema ainda não tem imagem nem desenho de fundo para repetir no menu.</p>}
      {t.menuImagem === 'propria' && (
        <div style={{ marginTop: 8 }}>
          <SeletorImagem rotulo="imagem do menu" imagem={t.menuImagemPropria} aoMudar={(menuImagemPropria) => setT({ ...t, menuImagemPropria })} aoErro={setErro} />
        </div>
      )}
      {t.menuImagem === 'propria' && !t.menuImagemPropria && <p className="suave" style={{ fontSize: 13 }}>Envie uma imagem para ver o fundo do menu.</p>}
      {t.menuImagem === 'mesma' && !t.imagem && temFundo && <p className="suave" style={{ fontSize: 13 }}>Sem imagem, o menu repete o mesmo desenho da tela, no mesmo tamanho.</p>}
      {(t.menuImagem === 'propria' ? !!t.menuImagemPropria : t.menuImagem === 'mesma' && !!t.imagem) && (
        <div>
          <OpcoesDaImagem t={t} setT={setT} alvo="menu" imagem={t.menuImagem === 'propria' ? t.menuImagemPropria : t.imagem} />
          <Campo rotulo={`Suavidade no menu: ${t.menuVeu}%`}>
            <input type="range" min={30} max={95} step={5} value={t.menuVeu} onChange={(e) => setT({ ...t, menuVeu: Number(e.target.value) })} />
            <span className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', fontWeight: 400 }}>Mais alto deixa a cor do menu mais forte e as letras mais fáceis de ler.</span>
          </Campo>
          <p className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', margin: '4px 0 0' }}>O espaçamento e a forma de repetir são os mesmos da tela.</p>
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
        <p className="suave" style={{ margin: '8px 0 0', fontSize: 'calc(13px * var(--escala, 1))' }}>Enquanto um tema está valendo, as cores dele ficam no lugar das suas cores. Ao escolher um tema com “Usar agora”, ele fica até você voltar ao Automático ou ao padrão.</p>
      </section>

      {vendo && (
        <section className="cartao" aria-live="polite">
          <h2>Pré-visualização: {vendo.nome}</h2>
          <PreviaTema grande aparencia={vendo} prefs={prefs} titulo={vendo.nome} />
          <div className="linha" style={{ marginTop: 10 }}>
            <button className="btn primario" onClick={() => { escolher(vendo.id); setVendo(null); }}>Usar este tema</button>
            <button className="btn" onClick={() => setVendo(null)}>Fechar</button>
          </div>
          <p className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', margin: '8px 0 0' }}>Nada muda no app até você escolher “Usar este tema”.</p>
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
