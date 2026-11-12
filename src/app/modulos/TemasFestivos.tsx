import { useEffect, useState, type ChangeEvent } from 'react';
import { listarTemasPersonalizados, salvarTema } from '../../dados/temas.ts';
import { reduzirImagem } from '../../dados/imagem.ts';
import type { Preferencias } from '../tema/tema.ts';
import {
  DIAS_ANTES, DIAS_DEPOIS, MOTIVOS, TEMAS_PRONTOS, VEU_PADRAO, clarear, proximaDataDoTema, svgDoMotivo,
  type Motivo, type TemaBase, type TemaPersonalizado, type TemaResolvido,
} from '../../dominio/temas.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import { Campo } from './FinanceiroCampos.tsx';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function novo(): TemaPersonalizado {
  return {
    id: '', nome: '', regra: { tipo: 'fixa', mes: 1, dia: 1 }, cores: { principal: '#8A4F9E', principalEscuro: clarear('#8A4F9E'), apoio: '#F1CDD9', menu: '#4A2E5F' },
    motivo: 'estrela', corMotivo: '#C398C8', saudacao: '', imagem: null, veu: VEU_PADRAO, ativo: true, atualizadoEm: '',
  };
}

function CartaoTema(p: { t: TemaBase; imagem?: Blob | null; ativo: boolean; hoje: string; depois: number; aoUsar: () => void; aoEditar?: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!p.imagem) return setUrl('');
    const u = URL.createObjectURL(p.imagem);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [p.imagem]);
  const data = proximaDataDoTema(p.t.regra, p.hoje, p.depois);
  const fundo = url ? `url("${url}")` : svgDoMotivo(p.t.motivo, p.t.corMotivo) ? `url("${svgDoMotivo(p.t.motivo, p.t.corMotivo)}")` : 'none';
  return (
    <div className="tema-cartao" aria-current={p.ativo}>
      <div className="amostra" style={{ backgroundImage: fundo, backgroundSize: url ? 'cover' : undefined }}>
        <i style={{ background: p.t.cores.principal }} /><i style={{ background: p.t.cores.apoio }} /><i style={{ background: p.t.cores.menu }} />
      </div>
      <div className="corpo">
        <strong>{p.t.nome}</strong>
        <span className="suave" style={{ fontSize: 13 }}>{data ? `${dataParaTexto(data)}` : 'sem data (uso manual)'}</span>
        <div className="linha" style={{ marginTop: 'auto' }}>
          <button className="btn" style={{ minHeight: 36 }} onClick={p.aoUsar} disabled={p.ativo}>{p.ativo ? 'Em uso' : 'Usar agora'}</button>
          {p.aoEditar && <button className="btn" style={{ minHeight: 36 }} onClick={p.aoEditar}>Editar</button>}
        </div>
      </div>
    </div>
  );
}

function Formulario(p: { inicial: TemaPersonalizado; aoSalvar: (t: TemaPersonalizado) => Promise<void>; aoCancelar: () => void }) {
  const [t, setT] = useState(p.inicial);
  const [url, setUrl] = useState('');
  const [erro, setErro] = useState('');
  const comData = t.regra.tipo === 'fixa';
  const regra = t.regra.tipo === 'fixa' ? t.regra : { tipo: 'fixa' as const, mes: 1, dia: 1 };

  useEffect(() => {
    if (!t.imagem) return setUrl('');
    const u = URL.createObjectURL(t.imagem);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [t.imagem]);

  async function imagem(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setT({ ...t, imagem: await reduzirImagem(f, 1920) });
      setErro('');
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não consegui usar essa imagem.');
    }
  }
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
      <h2>{p.inicial.id ? 'Editar tema' : 'Novo tema'}</h2>
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
      <h3 style={{ margin: '14px 0 6px' }}>Cores</h3>
      <div className="linha" style={{ gap: 18 }}>
        <label>Botões e destaques <input type="color" value={t.cores.principal} onChange={(e) => setT({ ...t, cores: { ...t.cores, principal: e.target.value } })} /></label>
        <label>Detalhes suaves <input type="color" value={t.cores.apoio} onChange={(e) => setT({ ...t, cores: { ...t.cores, apoio: e.target.value } })} /></label>
        <label>Menu lateral <input type="color" value={t.cores.menu} onChange={(e) => setT({ ...t, cores: { ...t.cores, menu: e.target.value } })} /></label>
      </div>
      <h3 style={{ margin: '14px 0 6px' }}>Fundo</h3>
      <div className="linha" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="linha">
            <label className="btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {t.imagem ? 'Trocar imagem' : 'Enviar imagem de fundo'}
              <input type="file" accept="image/*" hidden onChange={(e) => void imagem(e)} />
            </label>
            {t.imagem && <button className="btn" onClick={() => setT({ ...t, imagem: null })}>Tirar imagem</button>}
          </div>
          {url && <img src={url} alt="Prévia do fundo" style={{ width: 180, height: 100, objectFit: 'cover', borderRadius: 12, marginTop: 8, display: 'block' }} />}
        </div>
        {t.imagem ? (
          <Campo rotulo={`Suavidade da imagem: ${t.veu}%`}>
            <input type="range" min={40} max={95} step={5} value={t.veu} onChange={(e) => setT({ ...t, veu: Number(e.target.value) })} />
            <span className="suave" style={{ fontSize: 12, fontWeight: 400 }}>Mais alto deixa a imagem mais clara e o texto mais fácil de ler.</span>
          </Campo>
        ) : (
          <>
            <Campo rotulo="Ou um desenho repetido">
              <select value={t.motivo} onChange={(e) => setT({ ...t, motivo: e.target.value as Motivo })}>
                {Object.entries(MOTIVOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </Campo>
            <label>Cor do desenho <input type="color" value={t.corMotivo} onChange={(e) => setT({ ...t, corMotivo: e.target.value })} /></label>
          </>
        )}
      </div>
      {erro && <p className="aviso" role="alert">{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={salvar}>Salvar tema</button>
        <button className="btn" onClick={p.aoCancelar}>Voltar</button>
        {p.inicial.id && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void p.aoSalvar({ ...t, ativo: false })}>Arquivar tema</button>}
      </div>
    </section>
  );
}

export function TemasFestivos({ prefs, aoMudar, tema }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void; tema: TemaResolvido | null }) {
  const [meus, setMeus] = useState<TemaPersonalizado[]>([]);
  const [editando, setEditando] = useState<TemaPersonalizado | null>(null);
  const hoje = hojeLocal();
  const modo = prefs.temaFestivo ?? 'automatico';
  const antes = prefs.temaDiasAntes ?? DIAS_ANTES;
  const depois = prefs.temaDiasDepois ?? DIAS_DEPOIS;

  const recarregar = async () => setMeus((await listarTemasPersonalizados()).filter((t) => t.ativo));
  useEffect(() => {
    void recarregar();
  }, []);

  if (editando) {
    return <Formulario inicial={editando} aoCancelar={() => setEditando(null)} aoSalvar={async (t) => { await salvarTema(t); setEditando(null); await recarregar(); }} />;
  }

  const escolher = (id: string) => aoMudar({ ...prefs, temaFestivo: id });
  const numero = (k: 'temaDiasAntes' | 'temaDiasDepois', v: string) => aoMudar({ ...prefs, [k]: Math.min(30, Math.max(0, Math.round(Number(v) || 0))) });

  return (
    <>
      <p className="suave" style={{ marginTop: 0 }}>Deixe o app com o clima de cada festividade: cores, desenhos de fundo e uma frase de boas-vindas no Início. 🌸</p>
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

      <h2 style={{ margin: '18px 0 8px' }}>Temas prontos</h2>
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {TEMAS_PRONTOS.map((t) => (
          <CartaoTema key={t.id} t={t} ativo={tema?.id === t.id} hoje={hoje} depois={depois} aoUsar={() => escolher(t.id)} />
        ))}
      </div>

      <div className="linha" style={{ margin: '18px 0 8px' }}>
        <h2 style={{ margin: 0 }}>Meus temas</h2>
        <button className="btn primario" style={{ marginLeft: 'auto' }} onClick={() => setEditando(novo())}>Criar tema</button>
      </div>
      {meus.length === 0 && <p className="suave" style={{ margin: 0 }}>Você ainda não criou nenhum. Dá para usar suas próprias imagens e cores, para uma data do atelier, por exemplo.</p>}
      <div className="grade" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {meus.map((t) => (
          <CartaoTema key={t.id} t={t} imagem={t.imagem} ativo={tema?.id === t.id} hoje={hoje} depois={depois} aoUsar={() => escolher(t.id)} aoEditar={() => setEditando(t)} />
        ))}
      </div>
    </>
  );
}
