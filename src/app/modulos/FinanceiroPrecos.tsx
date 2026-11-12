import { useEffect, useState } from 'react';
import type { Produto } from '../../dados/db.ts';
import { listarProdutos } from '../../dados/produtos.ts';
import { carregarAjustes, materiaisPorProduto, salvarAjustes } from '../../dados/financeiro.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { custoHoraMaquinaCentavos, precificar, type Ajustes as AjustesTipo, type Canal, type Maquina } from '../../dominio/financeiro.ts';
import { LINHAS } from '../../dominio/produtos.ts';
import { novoId } from '../../dados/db.ts';
import { listarEquipamentos } from '../../dados/equipamentos.ts';
import { comMaquinasDosEquipamentos, maquinasDosEquipamentos } from '../../dominio/equipamentos.ts';
import { Campo, CampoNumero } from './FinanceiroCampos.tsx';

export function Precos({ irParaAjustes }: { irParaAjustes: () => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [custos, setCustos] = useState<Record<string, { materiais: number; semCusto: number }>>({});
  const [ajustes, setAjustes] = useState<AjustesTipo | null>(null);

  useEffect(() => {
    void (async () => {
      setProdutos((await listarProdutos()).filter((p) => p.ativo));
      setCustos(await materiaisPorProduto());
      setAjustes(comMaquinasDosEquipamentos(await carregarAjustes(), await listarEquipamentos()));
    })();
  }, []);

  if (!ajustes) return null;
  const faltaMult = ajustes.multiplicadorEncadernacao === null || ajustes.multiplicador3d === null;

  return (
    <>
      <div className="cartao">
        <h2>Preço sugerido</h2>
        <p className="suave" style={{ marginTop: 0 }}>
          Custo = materiais + desgaste e energia da máquina (peças 3D) + desperdício. Preço sugerido = custo × multiplicador ÷ (1 − taxa do canal). O seu tempo de trabalho não entra no custo: ele é o lucro, e a coluna “por hora” mostra quanto sobra por hora trabalhada no preço atual.
        </p>
        {faltaMult && (
          <p className="aviso">
            Defina o multiplicador de cada linha (e as taxas dos canais) para ver os preços sugeridos. <button className="btn" onClick={irParaAjustes}>Ir para Ajustes</button>
          </p>
        )}
      </div>
      {produtos.length === 0 ? (
        <div className="cartao suave">Cadastre produtos em Produtos para ver os preços aqui.</div>
      ) : (
        <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th><th>Custo</th><th>Preço atual</th><th>Lucro</th><th>Por hora</th>
                {ajustes.canais.map((c) => <th key={c.id}>Sugerido · {c.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const c = custos[p.id] ?? { materiais: 0, semCusto: 0 };
                const r = precificar({
                  linha: p.linha, materiaisCentavos: c.materiais, tempoImpressaoMin: p.perfil3d?.tempoImpressaoMin ?? 0,
                  tempoTrabalhoMin: p.tempoTrabalhoMin, precoAtualCentavos: p.precoCentavos,
                }, ajustes);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nome}</strong>
                      <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>{LINHAS[p.linha]}</div>
                      {c.semCusto > 0 && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>faltam custos de {c.semCusto} material(is)</div>}
                    </td>
                    <td className="din">
                      {centavosParaTexto(r.custo)}
                      {r.maquina > 0 && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>máquina {centavosParaTexto(r.maquina)}</div>}
                    </td>
                    <td className="din">{p.precoCentavos !== null ? centavosParaTexto(p.precoCentavos) : '—'}</td>
                    <td className="din">
                      {r.lucroAtual !== null ? centavosParaTexto(r.lucroAtual) : '—'}
                      {r.margemAtualPct !== null && <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))' }}>{r.margemAtualPct.toFixed(0)}% do preço</div>}
                    </td>
                    <td className="din">{r.horaAtual !== null ? centavosParaTexto(r.horaAtual) : p.tempoTrabalhoMin > 0 ? '—' : <span className="suave">sem tempo</span>}</td>
                    {r.sugeridoPorCanal.map((v, k) => <td key={k} className="din">{v !== null ? centavosParaTexto(v) : '—'}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>
        “Lucro” é o preço atual menos o custo, sem taxa de canal. Preencha o tempo de trabalho no produto para ver o ganho por hora.
      </p>
    </>
  );
}

export function Ajustes() {
  const [a, setA] = useState<AjustesTipo | null>(null);
  const [doEquipamento, setDoEquipamento] = useState<Maquina[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void carregarAjustes().then(setA);
    void listarEquipamentos().then((l) => setDoEquipamento(maquinasDosEquipamentos(l)));
  }, []);
  if (!a) return null;

  const mudar = (parte: Partial<AjustesTipo>) => {
    setMsg('');
    setA({ ...a, ...parte });
  };
  const mudarMaquina = (id: string, parte: Partial<Maquina>) => mudar({ maquinas: a.maquinas.map((m) => (m.id === id ? { ...m, ...parte } : m)) });
  const mudarCanal = (id: string, parte: Partial<Canal>) => mudar({ canais: a.canais.map((c) => (c.id === id ? { ...c, ...parte } : c)) });

  async function salvar() {
    if (!a) return;
    await salvarAjustes(a);
    setMsg('Ajustes salvos.');
  }

  return (
    <>
      <div className="cartao">
        <h2>Multiplicador e desperdício</h2>
        <p className="suave" style={{ marginTop: 0 }}>
          O multiplicador é quantas vezes o custo você quer cobrar. Fica em branco até você decidir. O desperdício cobre sobras de corte e falhas.
        </p>
        <div className="formgrid">
          <CampoNumero rotulo="Multiplicador · encadernação" valor={a.multiplicadorEncadernacao} aoMudar={(n) => mudar({ multiplicadorEncadernacao: n })} dica="ex.: 3,5" />
          <CampoNumero rotulo="Multiplicador · impressão 3D" valor={a.multiplicador3d} aoMudar={(n) => mudar({ multiplicador3d: n })} dica="ex.: 3" />
          <CampoNumero rotulo="Desperdício · encadernação (sobre os materiais)" sufixo="%" valor={a.desperdicioEncadernacaoPct} aoMudar={(n) => mudar({ desperdicioEncadernacaoPct: n ?? 0 })} />
          <CampoNumero rotulo="Falhas · impressão 3D (sobre o custo)" sufixo="%" valor={a.desperdicio3dPct} aoMudar={(n) => mudar({ desperdicio3dPct: n ?? 0 })} />
        </div>
      </div>

      <div className="cartao">
        <h2>Canais de venda e taxas</h2>
        <p className="suave" style={{ marginTop: 0 }}>Quanto cada canal fica da venda. Confira nas regras atuais de cada plataforma e preencha; começam em 0%.</p>
        {a.canais.map((c) => (
          <div key={c.id} className="formgrid" style={{ marginBottom: 8 }}>
            <Campo rotulo="Canal"><input type="text" value={c.nome} onChange={(e) => mudarCanal(c.id, { nome: e.target.value })} /></Campo>
            <CampoNumero rotulo="Taxa" sufixo="%" valor={c.taxaPct} aoMudar={(n) => mudarCanal(c.id, { taxaPct: n ?? 0 })} />
            <div className="linha" style={{ alignItems: 'flex-end' }}>
              <button className="btn" onClick={() => mudar({ canais: a.canais.filter((x) => x.id !== c.id) })}>Remover</button>
            </div>
          </div>
        ))}
        <div className="linha"><button className="btn" onClick={() => mudar({ canais: [...a.canais, { id: novoId(), nome: '', taxaPct: 0 }] })}>+ Canal</button></div>
        <div className="formgrid" style={{ marginTop: 12 }}>
          <CampoNumero rotulo="Taxa média de venda (ponto de equilíbrio)" sufixo="%" valor={a.taxaMediaPct} aoMudar={(n) => mudar({ taxaMediaPct: n ?? 0 })} />
        </div>
      </div>

      <div className="cartao">
        <h2>Máquinas</h2>
        <p className="suave" style={{ marginTop: 0 }}>
          O custo por hora é o valor da máquina dividido pela vida útil em horas, mais a energia. Ele entra no custo das peças 3D pelo tempo de impressão de cada produto.
        </p>
        <div className="formgrid" style={{ marginBottom: 8 }}>
          <CampoNumero rotulo="Tarifa de energia" sufixo="R$ por kWh" valor={a.kwhCentavos ? a.kwhCentavos / 100 : null} aoMudar={(n) => mudar({ kwhCentavos: Math.round((n ?? 0) * 100) })} dica="da sua conta de luz" />
        </div>
        {doEquipamento.length > 0 && (
          <>
            <p className="suave" style={{ marginBottom: 4 }}>Vindas de Equipamentos (edite lá). Escolha qual vale para as peças 3D:</p>
            {doEquipamento.map((m) => (
              <div key={m.id} className="linha" style={{ marginBottom: 6 }}>
                <label className="linha">
                  <input type="radio" name="maquina3d" checked={a.maquina3dId === m.id} onChange={() => mudar({ maquina3dId: m.id })} /> <strong>{m.nome}</strong>
                </label>
                <span className="suave">custo por hora: {centavosParaTexto(Math.round(custoHoraMaquinaCentavos(m, a.kwhCentavos)))}</span>
              </div>
            ))}
          </>
        )}
        {a.maquinas.map((m) => (
          <div key={m.id} className="cartao" style={{ marginTop: 8, padding: 12 }}>
            <div className="formgrid">
              <Campo rotulo="Nome"><input type="text" value={m.nome} onChange={(e) => mudarMaquina(m.id, { nome: e.target.value })} /></Campo>
              <CampoNumero rotulo="Valor pago" sufixo="R$" valor={m.valorCentavos ? m.valorCentavos / 100 : null} aoMudar={(n) => mudarMaquina(m.id, { valorCentavos: Math.round((n ?? 0) * 100) })} />
              <CampoNumero rotulo="Vida útil estimada" sufixo="horas" valor={m.vidaUtilHoras || null} aoMudar={(n) => mudarMaquina(m.id, { vidaUtilHoras: n ?? 0 })} />
              <CampoNumero rotulo="Consumo médio" sufixo="watts" valor={m.potenciaW || null} aoMudar={(n) => mudarMaquina(m.id, { potenciaW: n ?? 0 })} />
            </div>
            <div className="linha" style={{ marginTop: 8 }}>
              <span className="suave">Custo por hora: {centavosParaTexto(Math.round(custoHoraMaquinaCentavos(m, a.kwhCentavos)))}</span>
              <label className="linha" style={{ marginLeft: 'auto' }}>
                <input type="radio" name="maquina3d" checked={a.maquina3dId === m.id} onChange={() => mudar({ maquina3dId: m.id })} /> Usar nas peças 3D
              </label>
              <button className="btn" onClick={() => mudar({ maquinas: a.maquinas.filter((x) => x.id !== m.id), maquina3dId: a.maquina3dId === m.id ? null : a.maquina3dId })}>Remover</button>
            </div>
          </div>
        ))}
        <div className="linha" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => mudar({ maquinas: [...a.maquinas, { id: novoId(), nome: '', valorCentavos: 0, vidaUtilHoras: 0, potenciaW: 0 }] })}>+ Máquina</button>
        </div>
      </div>

      <div className="linha" style={{ marginTop: 16 }}>
        <button className="btn primario" onClick={() => void salvar()}>Salvar ajustes</button>
        {msg && <span role="status" className="ok">{msg}</span>}
      </div>
    </>
  );
}
