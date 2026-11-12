import { useEffect, useState, type ReactNode } from 'react';
import { carregarPainel, type Painel } from '../../dados/painel.ts';
import { centavosParaTexto } from '../../dominio/dinheiro.ts';
import { textoDoPrazo } from '../../dominio/equipamentos.ts';
import { STATUS, dataParaTexto } from '../../dominio/pedidos.ts';
import { etapasDoPedido, textoDoPrazoPedido, textoUltimaPublicacao, type PedidoComPrazo } from '../../dominio/painel.ts';
import type { Tela } from '../telas.ts';
import type { TemaResolvido } from '../../dominio/temas.ts';

const MAX = 6;

function Cartao(p: { titulo: string; destino: Tela; botao: string; ir: (t: Tela) => void; children: ReactNode }) {
  return (
    <section className="cartao" style={{ marginTop: 0 }}>
      <h2>{p.titulo}</h2>
      {p.children}
      <div className="rodape"><button className="btn" onClick={() => p.ir(p.destino)}>{p.botao}</button></div>
    </section>
  );
}

function Trilha({ status }: { status: PedidoComPrazo['status'] }) {
  const etapas = etapasDoPedido(status);
  return (
    <div aria-label={`Etapa: ${STATUS[status]}`}>
      <div className="trilha">{etapas.map((e) => <span key={e.nome} className={`passo${e.feita ? ' feita' : ''}${e.atual ? ' atual' : ''}`} />)}</div>
      <div className="rotulos-trilha">{etapas.map((e) => <span key={e.nome} className={e.atual ? 'atual' : ''}>{e.nome}</span>)}</div>
    </div>
  );
}

function Prazo({ p }: { p: PedidoComPrazo }) {
  if (p.atrasado && p.dias !== null) return <span className="selo">{textoDoPrazoPedido(p.dias)}</span>;
  if (p.dias === null) return <span className="suave">sem prazo</span>;
  return <span className="suave">prazo {dataParaTexto(p.dataPrometida)} · {textoDoPrazoPedido(p.dias)}</span>;
}

const mais = (total: number) => (total > MAX ? <p className="suave" style={{ margin: '6px 0 0' }}>e mais {total - MAX}</p> : null);

export function Inicio({ ir, tema }: { ir: (t: Tela) => void; tema?: TemaResolvido | null }) {
  const [d, setD] = useState<Painel | null>(null);
  useEffect(() => {
    void carregarPainel().then(setD);
  }, []);

  const data = new Date(`${(d?.hoje ?? new Date().toISOString().slice(0, 10))}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!d) {
    return (
      <>
        <h1>Craft Notes Unique</h1>
        <p className="suave">atelier criativo</p>
      </>
    );
  }
  const { pedidos: ped, divulgacao: div, baixos, atencao } = d;
  const prontos = ped.paraEntregar.filter((p) => p.status === 'pronto').length;
  const abertos = ped.emAndamento.length + prontos;

  return (
    <>
      <h1>Craft Notes Unique</h1>
      <p className="suave">atelier criativo · {data}</p>
      <div className="faixa" />

      {tema && tema.saudacao && (
        <div className="saudacao">
          <strong>{tema.saudacao}</strong>
          <span style={{ fontSize: 13 }}>
            Tema {tema.nome}{tema.fim ? ` até ${dataParaTexto(tema.fim)}` : ' (escolhido por você)'} · <button className="btn" style={{ minHeight: 32, padding: '0 12px' }} onClick={() => ir('configuracoes')}>Mudar tema</button>
          </span>
        </div>
      )}

      <div className="resumo">
        <div className="bloco"><strong>{abertos}</strong><span>pedido(s) em aberto</span></div>
        <div className={`bloco${ped.atrasados > 0 ? ' alerta' : ''}`}><strong>{ped.atrasados}</strong><span>atrasado(s)</span></div>
        <div className="bloco"><strong>{centavosParaTexto(ped.aReceber.totalCentavos)}</strong><span>a receber</span></div>
        <div className={`bloco${baixos.length > 0 ? ' alerta' : ''}`}><strong>{baixos.length}</strong><span>material para repor</span></div>
        <div className={`bloco${div.aviso ? ' alerta' : ''}`}><strong>{div.ultima ? textoUltimaPublicacao(div.ultima.diasAtras) : '—'}</strong><span>última divulgação</span></div>
      </div>

      <div className="grade" style={{ marginTop: 16 }}>
        <Cartao titulo="Andamento da produção" destino="pedidos" botao="Abrir Pedidos" ir={ir}>
          {ped.emAndamento.length === 0 && <p className="suave" style={{ margin: 0 }}>Nenhum pedido em produção agora.</p>}
          <ul className="painel-lista">
            {ped.emAndamento.slice(0, MAX).map((p) => (
              <li key={p.numero}>
                <div className="topo"><strong>#{p.numero} · {p.cliente}</strong><Prazo p={p} /></div>
                <Trilha status={p.status} />
              </li>
            ))}
          </ul>
          {mais(ped.emAndamento.length)}
          {ped.orcamentos > 0 && <p className="suave" style={{ margin: '8px 0 0' }}>{ped.orcamentos} orçamento(s) aguardando confirmação.</p>}
        </Cartao>

        <Cartao titulo="Pagamentos pendentes" destino="pedidos" botao="Registrar pagamentos" ir={ir}>
          {ped.aReceber.pedidos.length === 0 ? (
            <p className="suave" style={{ margin: 0 }}>Tudo recebido por enquanto. 💜</p>
          ) : (
            <>
              <p className="grande">{centavosParaTexto(ped.aReceber.totalCentavos)}</p>
              <p className="suave" style={{ margin: '0 0 4px' }}>a receber em {ped.aReceber.pedidos.length} pedido(s)</p>
              <ul className="painel-lista">
                {ped.aReceber.pedidos.slice(0, MAX).map((p) => (
                  <li key={p.numero}>
                    <div className="topo">
                      <strong>#{p.numero} · {p.cliente}</strong>
                      <span>falta {centavosParaTexto(p.falta)}</span>
                    </div>
                    <span className="suave" style={{ fontSize: 13 }}>de {centavosParaTexto(p.totalCentavos)} · {STATUS[p.status].toLowerCase()}</span>
                  </li>
                ))}
              </ul>
              {mais(ped.aReceber.pedidos.length)}
            </>
          )}
        </Cartao>

        <Cartao titulo="Entregas pendentes" destino="pedidos" botao="Abrir Pedidos" ir={ir}>
          {ped.paraEntregar.length === 0 && <p className="suave" style={{ margin: 0 }}>Nenhuma entrega pedindo atenção. Prontos para entregar e prazos dos próximos 3 dias aparecem aqui.</p>}
          <ul className="painel-lista">
            {ped.paraEntregar.slice(0, MAX).map((p) => (
              <li key={p.numero}>
                <div className="topo">
                  <strong>#{p.numero} · {p.cliente}</strong>
                  <Prazo p={p} />
                </div>
                <span className="suave" style={{ fontSize: 13 }}>
                  {p.status === 'pronto' ? 'pronto para entregar' : STATUS[p.status].toLowerCase()}
                  {p.falta > 0 ? ` · falta receber ${centavosParaTexto(p.falta)}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {mais(ped.paraEntregar.length)}
        </Cartao>

        <Cartao titulo="Divulgação" destino="divulgacao" botao="Abrir Divulgação" ir={ir}>
          {div.ultima ? (
            <p style={{ margin: 0 }}>Última publicação: <strong>{dataParaTexto(div.ultima.data)}</strong> ({textoUltimaPublicacao(div.ultima.diasAtras)}){div.ultima.titulo ? ` · ${div.ultima.titulo}` : ''}.</p>
          ) : (
            <p style={{ margin: 0 }}>Nenhuma publicação registrada ainda.</p>
          )}
          {div.aviso && <p className="suave" style={{ margin: '8px 0 0' }}>{div.ultima ? 'Já faz um tempinho sem publicar. Que tal mostrar algo do atelier? 🌸' : 'Que tal planejar a primeira publicação? 🌸'}</p>}
          {div.proxima && <p className="suave" style={{ margin: '8px 0 0' }}>Próxima planejada: {dataParaTexto(div.proxima.data)}{div.proxima.titulo ? ` · ${div.proxima.titulo}` : ''}.</p>}
          {div.atrasadas > 0 && <p className="suave" style={{ margin: '8px 0 0' }}>{div.atrasadas} publicação(ões) planejada(s) ficaram para trás.</p>}
        </Cartao>

        <Cartao titulo="Estoque baixo" destino="materiais" botao="Abrir Materiais" ir={ir}>
          {baixos.length === 0 ? (
            <p className="suave" style={{ margin: 0 }}>Nenhum material abaixo do mínimo.</p>
          ) : (
            <>
              <p className="suave" style={{ margin: 0 }}>{baixos.length} material(is) abaixo do mínimo:</p>
              <ul className="painel-lista">
                {baixos.slice(0, MAX).map((m) => (
                  <li key={m.nome}><div className="topo"><strong>{m.nome}</strong><span className="suave">{m.disponivel} de {m.minimo} {m.unidade}</span></div></li>
                ))}
              </ul>
              {mais(baixos.length)}
            </>
          )}
        </Cartao>

        <Cartao titulo="Manutenção" destino="equipamentos" botao="Abrir Equipamentos" ir={ir}>
          {atencao.manutencoes.length === 0 ? (
            <p className="suave" style={{ margin: 0 }}>Manutenção em dia.</p>
          ) : (
            <ul className="painel-lista">
              {atencao.manutencoes.slice(0, MAX).map((m) => (
                <li key={`${m.equipamentoId}-${m.tarefaId}`}><div className="topo"><strong>{m.equipamento}</strong><span>{m.tarefa} · {textoDoPrazo(m.dias)}</span></div></li>
              ))}
            </ul>
          )}
          {mais(atencao.manutencoes.length)}
        </Cartao>
      </div>
    </>
  );
}
