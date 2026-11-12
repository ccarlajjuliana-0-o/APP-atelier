import { useEffect, useRef, useState } from 'react';
import { listarEquipamentos, registrarManutencao, salvarEquipamento } from '../../dados/equipamentos.ts';
import { carregarAjustes } from '../../dados/financeiro.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import { novoId } from '../../dados/db.ts';
import {
  TAREFAS_SUGERIDAS, TIPOS_EQUIPAMENTO, diasEntre, maquinaDoEquipamento, pendencias, proximaDaTarefa, situacaoDaTarefa, textoDoPrazo,
  type Equipamento, type Tarefa, type TipoEquipamento,
} from '../../dominio/equipamentos.ts';
import { custoHoraMaquinaCentavos } from '../../dominio/financeiro.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';
import { CampoFotos, Miniatura } from '../componentes/Fotos.tsx';
import { Campo, CampoNumero } from './FinanceiroCampos.tsx';

function novo(): Equipamento {
  return {
    id: '', nome: '', tipo: 'encadernacao', modelo: '', dataCompra: null, valorCentavos: 0, vidaUtilHoras: 0, potenciaW: 0, usarNoCusto: false,
    tarefas: [], historico: [], fotos: [], observacoes: '', ativo: true, atualizadoEm: '',
  };
}

export function Equipamentos() {
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [kwh, setKwh] = useState(0);
  const [editando, setEditando] = useState<Equipamento | null>(null);
  const [arquivados, setArquivados] = useState(false);
  const [msg, setMsg] = useState('');
  const painelRef = useRef<HTMLDivElement | null>(null);
  const hoje = hojeLocal();

  async function recarregar() {
    setLista(await listarEquipamentos());
    setKwh((await carregarAjustes()).kwhCentavos);
  }
  useEffect(() => {
    void recarregar();
  }, []);
  useEffect(() => {
    if (editando) painelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editando?.id, editando === null]);

  const visiveis = lista.filter((e) => (arquivados ? !e.ativo : e.ativo));
  const todasPendencias = pendencias(lista, hoje);

  return (
    <>
      <h1>Equipamentos</h1>
      <p className="suave">
        Suas máquinas e ferramentas, com os cuidados de manutenção e quanto cada máquina custa por hora de uso. O app mostra o que está vencendo na tela Início.
      </p>
      <div className="faixa" />

      <div className="cartao">
        <div className="linha">
          <button className="btn primario" onClick={() => setEditando(novo())}>Novo equipamento</button>
          <label className="linha" style={{ marginLeft: 'auto' }}>
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} /> Ver arquivados
          </label>
        </div>
        {msg && <p role="status" className="ok">{msg}</p>}
        {todasPendencias.length > 0 && (
          <div className="aviso" style={{ marginTop: 10 }}>
            <strong>Manutenção pedindo atenção:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {todasPendencias.map((p) => <li key={`${p.equipamentoId}-${p.tarefaId}`}>{p.equipamento}: {p.tarefa} ({textoDoPrazo(p.dias)})</li>)}
            </ul>
          </div>
        )}
      </div>

      {editando && (
        <div ref={painelRef}>
          <Form
            key={`${editando.id || 'novo'}-${editando.atualizadoEm}`}
            inicial={editando}
            kwh={kwh}
            fechar={() => setEditando(null)}
            aoMudar={async (texto, reabrir) => {
              setMsg(texto);
              setEditando(reabrir ?? null);
              await recarregar();
            }}
          />
        </div>
      )}

      {lista.length === 0 ? (
        <div className="cartao suave">Nenhum equipamento ainda. Cadastre a impressora 3D, a prensa, a perfuradora de wire-o e as outras ferramentas que você usa.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead><tr><th>Equipamento</th><th>Manutenção</th><th>Custo por hora</th><th /></tr></thead>
            <tbody>
              {visiveis.map((e) => {
                const pend = pendencias([e], hoje);
                const maq = maquinaDoEquipamento(e);
                return (
                  <tr key={e.id}>
                    <td>
                      <div className="linha" style={{ flexWrap: 'nowrap' }}>
                        <Miniatura foto={e.fotos?.[0]} />
                        <div>
                          <strong>{e.nome}</strong>
                          <div className="suave" style={{ fontSize: 13 }}>{TIPOS_EQUIPAMENTO[e.tipo].split(' (')[0]}{e.modelo ? ` · ${e.modelo}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {e.tarefas.length === 0 ? <span className="suave">sem tarefas</span> : pend.length === 0 ? <span className="ok">em dia</span> : (
                        <>
                          <strong>{pend[0].tarefa}</strong>
                          <div style={{ fontSize: 12 }}>{textoDoPrazo(pend[0].dias)}{pend.length > 1 ? ` · +${pend.length - 1}` : ''}</div>
                        </>
                      )}
                    </td>
                    <td className="din">{maq ? centavosParaTexto(Math.round(custoHoraMaquinaCentavos(maq, kwh))) : <span className="suave">—</span>}</td>
                    <td><div className="linha" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={() => setEditando(e)}>Abrir</button></div></td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && <tr><td colSpan={4} className="suave">Nada nesta lista.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Form(p: { inicial: Equipamento; kwh: number; fechar: () => void; aoMudar: (m: string, reabrir?: Equipamento | null) => Promise<void> }) {
  const [e, setE] = useState<Equipamento>(p.inicial);
  const [erro, setErro] = useState('');
  const hoje = hojeLocal();
  // registrar manutenção
  const [tarefaSel, setTarefaSel] = useState('');
  const [descOutra, setDescOutra] = useState('');
  const [dataMan, setDataMan] = useState(hoje);
  const [custoMan, setCustoMan] = useState<number | null>(null);
  const [obsMan, setObsMan] = useState('');

  const maq = maquinaDoEquipamento(e);

  function mudarTarefa(id: string, parte: Partial<Tarefa>) {
    setE({ ...e, tarefas: e.tarefas.map((t) => (t.id === id ? { ...t, ...parte } : t)) });
  }
  function adicionarSugestoes() {
    const existentes = new Set(e.tarefas.map((t) => t.descricao.toLowerCase()));
    const novas = TAREFAS_SUGERIDAS[e.tipo].filter((s) => !existentes.has(s.descricao.toLowerCase())).map((s) => ({ id: novoId(), descricao: s.descricao, intervaloDias: s.intervaloDias, ultimaEm: null }));
    setE({ ...e, tarefas: [...e.tarefas, ...novas] });
  }

  async function salvar(ativo = e.ativo) {
    setErro('');
    const nome = e.nome.trim();
    if (!nome) return setErro('Dê um nome ao equipamento.');
    if (e.tarefas.some((t) => !t.descricao.trim() || !(t.intervaloDias > 0))) return setErro('Cada tarefa precisa de uma descrição e de um intervalo em dias.');
    const salvo = await salvarEquipamento({ ...e, nome, ativo, tarefas: e.tarefas.map((t) => ({ ...t, descricao: t.descricao.trim() })) });
    await p.aoMudar(ativo === e.ativo ? `“${nome}” salvo.` : ativo ? `“${nome}” voltou para a lista.` : `“${nome}” arquivado.`, null);
    return salvo;
  }

  async function registrar() {
    setErro('');
    if (!p.inicial.id) return setErro('Salve o equipamento antes de registrar manutenções.');
    const tarefa = e.tarefas.find((t) => t.id === tarefaSel);
    const descricao = tarefa ? tarefa.descricao : descOutra.trim();
    if (!descricao) return setErro('Escolha a tarefa ou descreva o que foi feito.');
    if (!dataMan) return setErro('Informe a data.');
    const novo = await registrarManutencao(p.inicial.id, tarefa?.id ?? null, descricao, dataMan, obsMan.trim(), Math.round((custoMan ?? 0) * 100));
    await p.aoMudar(`Manutenção registrada em “${novo.nome}”.${custoMan ? ' O custo entrou nas despesas avulsas.' : ''}`, novo);
  }

  return (
    <div className="cartao">
      <h2>{p.inicial.id ? 'Editar equipamento' : 'Novo equipamento'}</h2>
      <div className="formgrid">
        <Campo rotulo="Nome"><input type="text" value={e.nome} onChange={(x) => setE({ ...e, nome: x.target.value })} /></Campo>
        <Campo rotulo="Tipo">
          <select value={e.tipo} onChange={(x) => setE({ ...e, tipo: x.target.value as TipoEquipamento })}>
            {(Object.keys(TIPOS_EQUIPAMENTO) as TipoEquipamento[]).map((t) => <option key={t} value={t}>{TIPOS_EQUIPAMENTO[t]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Marca e modelo"><input type="text" value={e.modelo} onChange={(x) => setE({ ...e, modelo: x.target.value })} /></Campo>
        <Campo rotulo="Data da compra"><input type="date" value={e.dataCompra ?? ''} onChange={(x) => setE({ ...e, dataCompra: x.target.value || null })} /></Campo>
      </div>

      <h3 style={{ margin: '16px 0 4px' }}>Custo por hora</h3>
      <p className="suave" style={{ margin: 0, fontSize: 13 }}>
        Opcional. O desgaste por hora é o valor pago dividido pela vida útil estimada, mais a energia. Se marcar para usar no custo, a máquina aparece no Financeiro para as peças 3D.
      </p>
      <div className="formgrid">
        <CampoNumero rotulo="Valor pago" sufixo="R$" valor={e.valorCentavos ? e.valorCentavos / 100 : null} aoMudar={(n) => setE({ ...e, valorCentavos: Math.round((n ?? 0) * 100) })} />
        <CampoNumero rotulo="Vida útil estimada" sufixo="horas" valor={e.vidaUtilHoras || null} aoMudar={(n) => setE({ ...e, vidaUtilHoras: n ?? 0 })} />
        <CampoNumero rotulo="Consumo médio" sufixo="watts" valor={e.potenciaW || null} aoMudar={(n) => setE({ ...e, potenciaW: n ?? 0 })} />
      </div>
      <div className="linha" style={{ marginTop: 8 }}>
        <label className="linha">
          <input type="checkbox" checked={e.usarNoCusto} onChange={(x) => setE({ ...e, usarNoCusto: x.target.checked })} /> Usar no custo das peças 3D (Financeiro)
        </label>
        {maq && <span className="suave">Custo por hora: {centavosParaTexto(Math.round(custoHoraMaquinaCentavos(maq, p.kwh)))}{p.kwh === 0 ? ' (sem energia: preencha a tarifa em Financeiro › Ajustes)' : ''}</span>}
      </div>

      <h3 style={{ margin: '16px 0 4px' }}>Manutenção</h3>
      <p className="suave" style={{ margin: 0, fontSize: 13 }}>
        Tarefas que se repetem de tantos em tantos dias. O app avisa na tela Início quando faltarem 7 dias ou menos. As sugestões são só um ponto de partida: ajuste conforme o manual do equipamento.
      </p>
      {e.tarefas.map((t) => {
        const prox = proximaDaTarefa(t, e.dataCompra, hoje);
        const sit = situacaoDaTarefa(prox, hoje);
        return (
          <div key={t.id} className="cartao" style={{ marginTop: 8, padding: 12 }}>
            <div className="formgrid">
              <Campo rotulo="Tarefa"><input type="text" value={t.descricao} onChange={(x) => mudarTarefa(t.id, { descricao: x.target.value })} /></Campo>
              <CampoNumero rotulo="A cada" sufixo="dias" valor={t.intervaloDias || null} aoMudar={(n) => mudarTarefa(t.id, { intervaloDias: Math.round(n ?? 0) })} />
              <Campo rotulo="Última vez"><input type="date" value={t.ultimaEm ?? ''} onChange={(x) => mudarTarefa(t.id, { ultimaEm: x.target.value || null })} /></Campo>
            </div>
            <div className="linha" style={{ marginTop: 8 }}>
              <span className={sit === 'em_dia' ? 'suave' : undefined} style={sit === 'em_dia' ? undefined : { fontWeight: 700 }}>
                Próxima: {dataParaTexto(prox)} · {textoDoPrazo(diasEntre(hoje, prox))}
              </span>
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setE({ ...e, tarefas: e.tarefas.filter((x) => x.id !== t.id) })}>Remover tarefa</button>
            </div>
          </div>
        );
      })}
      <div className="linha" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => setE({ ...e, tarefas: [...e.tarefas, { id: novoId(), descricao: '', intervaloDias: 30, ultimaEm: null }] })}>+ Tarefa</button>
        <button className="btn" onClick={adicionarSugestoes}>+ Sugestões para {TIPOS_EQUIPAMENTO[e.tipo].split(' (')[0].toLowerCase()}</button>
      </div>

      {p.inicial.id && (
        <>
          <h3 style={{ margin: '16px 0 4px' }}>Registrar manutenção feita</h3>
          <p className="suave" style={{ margin: 0, fontSize: 13 }}>Salve as alterações acima antes. Se houver custo (peça, lâmina, óleo), ele também entra nas despesas avulsas do Financeiro.</p>
          <div className="formgrid">
            <Campo rotulo="Tarefa">
              <select value={tarefaSel} onChange={(x) => setTarefaSel(x.target.value)}>
                <option value="">Outra (descrever)</option>
                {p.inicial.tarefas.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
              </select>
            </Campo>
            {!tarefaSel && <Campo rotulo="O que foi feito"><input type="text" value={descOutra} onChange={(x) => setDescOutra(x.target.value)} /></Campo>}
            <Campo rotulo="Data"><input type="date" value={dataMan} onChange={(x) => setDataMan(x.target.value)} /></Campo>
            <CampoNumero rotulo="Custo" sufixo="R$, se houve" valor={custoMan} aoMudar={setCustoMan} />
            <Campo rotulo="Observação"><input type="text" value={obsMan} onChange={(x) => setObsMan(x.target.value)} /></Campo>
          </div>
          <div className="linha" style={{ marginTop: 10 }}><button className="btn" onClick={() => void registrar()}>Registrar manutenção</button></div>
          {p.inicial.historico.length > 0 && (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              {p.inicial.historico.slice(0, 10).map((h, k) => (
                <li key={k}>{dataParaTexto(h.data)} · {h.descricao}{h.custoCentavos > 0 ? ` · ${centavosParaTexto(h.custoCentavos)}` : ''}{h.observacao ? ` · ${h.observacao}` : ''}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <CampoFotos fotos={e.fotos ?? []} max={3} rotulo="Fotos (até 3)" aoMudar={(f) => setE({ ...e, fotos: f })} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Campo rotulo="Observações (onde está o manual, peças de reposição, fornecedor…)">
          <input type="text" value={e.observacoes} onChange={(x) => setE({ ...e, observacoes: x.target.value })} />
        </Campo>
      </div>

      {erro && <p className="aviso" style={{ marginTop: 10 }}>{erro}</p>}
      <div className="linha" style={{ marginTop: 14 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar</button>
        <button className="btn" onClick={p.fechar}>Fechar</button>
        {p.inicial.id && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => void salvar(!e.ativo)}>{e.ativo ? 'Arquivar' : 'Desarquivar'}</button>}
      </div>
    </div>
  );
}
