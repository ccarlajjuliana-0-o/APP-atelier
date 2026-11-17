import { useState, type ReactNode } from 'react';
import type { Pedido } from '../../dados/db.ts';
import { darEntradaPeca, registrarDevolucao, type ResultadoPeca } from '../../dados/devolucoes.ts';
import { hojeLocal } from '../../dados/pedidos.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import {
  MEIOS, MOTIVOS, PRAZO_DEVOLUCAO_DIAS, SITUACAO_PECA, SOLUCOES, dentroDoPrazo, textoPrazo, trocaPermitida,
  type Devolucao, type MeioDevolucao, type MotivoDevolucao, type SolucaoDevolucao,
} from '../../dominio/devolucoes.ts';
import { lerNumero } from '../../dominio/materiais.ts';
import { dataParaTexto, pagoCentavos } from '../../dominio/pedidos.ts';

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

const reais = (c: number) => (c / 100).toFixed(2).replace('.', ',');

export function DevolucaoDoPedido(p: { pedido: Pedido; aoMudar: (msg: string, reabrir?: Pedido | null) => Promise<void> }) {
  const ped = p.pedido;
  const entregue = ped.status === 'entregue' && !!ped.entregueEm;
  const devolucoes = ped.devolucoes ?? [];
  const [abrindo, setAbrindo] = useState(false);
  const [data, setData] = useState(hojeLocal());
  const [motivoTipo, setMotivoTipo] = useState<MotivoDevolucao>('defeito_fabricacao');
  const [motivo, setMotivo] = useState('');
  const [meio, setMeio] = useState<MeioDevolucao>('correios');
  const [meioDetalhe, setMeioDetalhe] = useState('');
  const [solucao, setSolucao] = useState<SolucaoDevolucao>('reembolso');
  const [marcados, setMarcados] = useState<number[]>([]);
  const [reembolso, setReembolso] = useState('');
  const [foraOk, setForaOk] = useState(false);
  const [erro, setErro] = useState('');
  // entrada de peça
  const [alvo, setAlvo] = useState<{ dev: string; pos: number } | null>(null);
  const [dataEntrada, setDataEntrada] = useState(hojeLocal());
  const [resultado, setResultado] = useState<ResultadoPeca>('ok');
  const [notaEntrada, setNotaEntrada] = useState('');
  const [perda, setPerda] = useState('');

  if (!entregue && devolucoes.length === 0) return null;

  const pago = pagoCentavos(ped.pagamentos);
  const disponiveis = ped.itens.map((i, k) => ({ i, k })).filter((x) => !x.i.cancelado && !x.i.devolvido);
  const valorMarcados = marcados.reduce((t, k) => t + Math.round((ped.itens[k]?.quantidade ?? 0) * (ped.itens[k]?.precoUnitCentavos ?? 0)), 0);
  const sugestao = Math.min(pago, valorMarcados);
  const prazoOk = entregue ? dentroDoPrazo(ped.entregueEm!, data) : true;
  const troca = trocaPermitida(motivoTipo);
  const solucaoEfetiva: SolucaoDevolucao = solucao === 'novo_pedido' && !troca ? 'reembolso' : solucao;

  function abrir() {
    setAbrindo(true);
    setData(hojeLocal());
    setMarcados(disponiveis.length === 1 ? [disponiveis[0].k] : []);
    setReembolso('');
    setErro('');
    setForaOk(false);
  }

  async function registrar() {
    setErro('');
    const valor = solucaoEfetiva === 'reembolso' ? Math.round((reembolso.trim() ? lerNumero(reembolso) : sugestao / 100) * 100) : 0;
    if (Number.isNaN(valor)) return setErro('Confira o valor do reembolso.');
    try {
      const r = await registrarDevolucao(ped.id, {
        solicitadaEm: data, motivoTipo, motivo, meio, meioDetalhe, solucao: solucaoEfetiva, indices: marcados, reembolsoCentavos: valor, aceitaForaDoPrazo: foraOk,
      });
      await p.aoMudar(
        r.novo
          ? `Devolução registrada. Criei o pedido #${r.novo.numero} (troca sem custo), já confirmado e com o material reservado.`
          : `Devolução registrada. Reembolso de ${centavosParaTexto(valor)} lançado no pedido #${ped.numero}.`,
        r.pedido,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar a devolução.');
    }
  }

  async function darEntrada() {
    if (!alvo) return;
    setErro('');
    const v = resultado === 'perda' && perda.trim() ? Math.round(lerNumero(perda) * 100) : 0;
    if (Number.isNaN(v) || v < 0) return setErro('Confira o valor da perda.');
    try {
      const novo = await darEntradaPeca(ped.id, alvo.dev, alvo.pos, { data: dataEntrada, resultado, nota: notaEntrada, perdaCentavos: v });
      setAlvo(null);
      const texto = resultado === 'ok' ? 'A peça voltou ao estoque.' : resultado === 'conserto' ? 'A peça ficou em conserto.' : `A peça foi registrada como perda${v > 0 ? ` (${centavosParaTexto(v)} lançados como despesa)` : ''}.`;
      await p.aoMudar(texto, novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar a entrada.');
    }
  }

  function painelEntrada(dev: Devolucao, pos: number, emConserto: boolean) {
    return (
      <div className="cartao" style={{ background: 'var(--neutro)', marginTop: 6 }}>
        <strong>{emConserto ? 'Resultado do conserto' : 'Dar entrada na peça que voltou'}</strong>
        {!emConserto && (
          <div className="formgrid" style={{ marginTop: 6 }}>
            <Campo rotulo="Data em que a peça voltou"><input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} /></Campo>
          </div>
        )}
        <p className="suave" style={{ margin: '8px 0 2px' }}>Como a peça está?</p>
        {!emConserto && (
          <label className="linha"><input type="radio" name={`res-${dev.id}-${pos}`} checked={resultado === 'ok'} onChange={() => setResultado('ok')} /> Em bom estado: volta ao estoque</label>
        )}
        {emConserto && (
          <label className="linha"><input type="radio" name={`res-${dev.id}-${pos}`} checked={resultado === 'ok'} onChange={() => setResultado('ok')} /> Conserto feito: volta ao estoque</label>
        )}
        {!emConserto && (
          <label className="linha"><input type="radio" name={`res-${dev.id}-${pos}`} checked={resultado === 'conserto'} onChange={() => setResultado('conserto')} /> Com defeito, mas tem conserto</label>
        )}
        <label className="linha"><input type="radio" name={`res-${dev.id}-${pos}`} checked={resultado === 'perda'} onChange={() => setResultado('perda')} /> {emConserto ? 'Não deu para consertar: perda' : 'Sem conserto: perda (desperdício)'}</label>
        {resultado === 'perda' && (
          <div className="formgrid" style={{ marginTop: 6 }}>
            <Campo rotulo="Valor da perda (R$, material gasto)"><input type="text" inputMode="decimal" value={perda} onChange={(e) => setPerda(e.target.value)} placeholder="0,00" /></Campo>
          </div>
        )}
        <div className="formgrid" style={{ marginTop: 6 }}>
          <Campo rotulo="Observação (estado em que chegou, o que foi feito)"><input type="text" value={notaEntrada} onChange={(e) => setNotaEntrada(e.target.value)} /></Campo>
        </div>
        {resultado === 'ok' && <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>Se a peça é do Catálogo, ela soma em “prontos”. Peça personalizada fica só registrada aqui.</p>}
        {resultado === 'perda' && <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>A perda entra no Financeiro como despesa avulsa de desperdício.</p>}
        <div className="linha" style={{ marginTop: 8 }}>
          <button className="btn primario" onClick={() => void darEntrada()}>Registrar</button>
          <button className="btn" onClick={() => setAlvo(null)}>Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cartao" style={{ background: 'var(--neutro)', marginTop: 12 }}>
      <strong>Devolução</strong>
      {entregue && !abrindo && (
        <p className="suave" style={{ marginTop: 4 }}>
          Entregue em {dataParaTexto(ped.entregueEm)}. Devolução vale até {PRAZO_DEVOLUCAO_DIAS} dias depois da entrega.{' '}
          {disponiveis.length > 0 && <button className="btn" onClick={abrir}>Registrar devolução</button>}
        </p>
      )}

      {abrindo && entregue && (
        <div style={{ marginTop: 6 }}>
          <div className="formgrid">
            <Campo rotulo="Data do pedido de devolução"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo rotulo="Motivo">
              <select value={motivoTipo} onChange={(e) => setMotivoTipo(e.target.value as MotivoDevolucao)}>
                {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Como foi feita a devolução">
              <select value={meio} onChange={(e) => setMeio(e.target.value as MeioDevolucao)}>
                {Object.entries(MEIOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          </div>
          <p className={prazoOk ? 'suave' : 'aviso'} style={{ marginTop: 6 }}>{textoPrazo(ped.entregueEm!, data)}</p>
          {!prazoOk && (
            <label className="linha"><input type="checkbox" checked={foraOk} onChange={(e) => setForaOk(e.target.checked)} /> Aceitar mesmo fora do prazo</label>
          )}
          <div className="formgrid" style={{ marginTop: 6 }}>
            <Campo rotulo="Conte o que aconteceu (motivo)"><input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
            <Campo rotulo={meio === 'correios' ? 'Código de rastreio' : 'Detalhes da devolução'}><input type="text" value={meioDetalhe} onChange={(e) => setMeioDetalhe(e.target.value)} /></Campo>
          </div>

          <p className="suave" style={{ margin: '10px 0 2px' }}>Quais itens voltam?</p>
          {disponiveis.map(({ i, k }) => (
            <label key={k} className="linha" style={{ gap: 6 }}>
              <input type="checkbox" checked={marcados.includes(k)} onChange={(e) => setMarcados(e.target.checked ? [...marcados, k] : marcados.filter((x) => x !== k))} />
              {i.quantidade}× {i.descricao} — {centavosParaTexto(Math.round(i.quantidade * i.precoUnitCentavos))}
            </label>
          ))}

          <p className="suave" style={{ margin: '10px 0 2px' }}>O que a cliente prefere?</p>
          <label className="linha" style={{ opacity: troca ? 1 : 0.55 }}>
            <input type="radio" name="sol-dev" disabled={!troca} checked={solucaoEfetiva === 'novo_pedido'} onChange={() => setSolucao('novo_pedido')} /> {SOLUCOES.novo_pedido}
          </label>
          {!troca && <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))', margin: '0 0 4px 24px' }}>A troca vale só para defeito de fabricação ou avaria no transporte.</p>}
          <label className="linha">
            <input type="radio" name="sol-dev" checked={solucaoEfetiva === 'reembolso'} onChange={() => setSolucao('reembolso')} /> {marcados.length > 0 && marcados.length < disponiveis.length ? 'Reembolso parcial (só dos itens marcados)' : 'Reembolso integral'}
          </label>
          {solucaoEfetiva === 'reembolso' && (
            <div className="formgrid" style={{ marginTop: 6 }}>
              <Campo rotulo={`Valor a reembolsar (R$) — já pago: ${centavosParaTexto(pago)}`}>
                <input type="text" inputMode="decimal" value={reembolso} placeholder={reais(sugestao)} onChange={(e) => setReembolso(e.target.value)} />
              </Campo>
            </div>
          )}
          {solucaoEfetiva === 'novo_pedido' && (
            <p className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>Vou criar um pedido novo igual, sem cobrança, já confirmado e com o material reservado. O valor pago continua no pedido original.</p>
          )}
          {erro && <p className="aviso" style={{ marginTop: 8 }}>{erro}</p>}
          <div className="linha" style={{ marginTop: 8 }}>
            <button className="btn primario" onClick={() => void registrar()}>Registrar devolução</button>
            <button className="btn" onClick={() => setAbrindo(false)}>Voltar</button>
          </div>
        </div>
      )}

      {devolucoes.map((d) => (
        <div key={d.id} className="cartao" style={{ marginTop: 10 }}>
          <div><strong>Devolução de {dataParaTexto(d.solicitadaEm)}</strong> <span className="etiqueta">{MOTIVOS[d.motivoTipo]}</span> {!d.dentroDoPrazo && <span className="etiqueta">fora do prazo</span>}</div>
          <div className="suave">
            {MEIOS[d.meio]}{d.meioDetalhe ? ` (${d.meioDetalhe})` : ''} · {d.solucao === 'reembolso' ? `reembolso de ${centavosParaTexto(d.reembolsoCentavos)}` : `novo pedido #${d.novoPedidoNumero ?? ''} sem custo`}
            {d.motivo ? ` · “${d.motivo}”` : ''}
          </div>
          {d.pecas.map((pc, pos) => (
            <div key={pos} style={{ marginTop: 6 }}>
              <div className="linha" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span>{pc.quantidade}× {pc.descricao}</span>
                <span className="etiqueta">{SITUACAO_PECA[pc.situacao]}</span>
                {pc.recebidaEm && <span className="suave">voltou em {dataParaTexto(pc.recebidaEm)}</span>}
                {pc.perdaCentavos > 0 && <span className="suave">perda de {centavosParaTexto(pc.perdaCentavos)}</span>}
                {(pc.situacao === 'a_caminho' || pc.situacao === 'em_conserto') && !(alvo?.dev === d.id && alvo.pos === pos) && (
                  <button className="btn" onClick={() => { setAlvo({ dev: d.id, pos }); setResultado('ok'); setNotaEntrada(''); setPerda(''); setDataEntrada(hojeLocal()); setErro(''); }}>
                    {pc.situacao === 'a_caminho' ? 'Peça chegou…' : 'Resultado do conserto…'}
                  </button>
                )}
              </div>
              {pc.nota && <div className="suave" style={{ fontSize: 'calc(13px * var(--escala, 1))' }}>{pc.nota}</div>}
              {alvo?.dev === d.id && alvo.pos === pos && painelEntrada(d, pos, pc.situacao === 'em_conserto')}
            </div>
          ))}
        </div>
      ))}
      {!abrindo && erro && <p className="aviso" style={{ marginTop: 8 }}>{erro}</p>}
    </div>
  );
}
