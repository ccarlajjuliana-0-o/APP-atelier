import { useEffect, useState } from 'react';
import { nuvem } from '../../dados/nuvem.ts';
import { carregarAtencao, type Atencao } from '../../dados/atencao.ts';
import { textoDoPrazo } from '../../dominio/equipamentos.ts';
import { dataParaTexto } from '../../dominio/pedidos.ts';

const ITENS: { texto: string; feito: boolean }[] = [
  { texto: 'App abre no tablet e na web, com o nome e a logomarca', feito: true },
  { texto: 'Login com GitHub e conta na nuvem', feito: !!nuvem },
  { texto: 'Banco local no aparelho (funciona sem internet)', feito: true },
  { texto: 'Tema claro e escuro e cores da marca', feito: true },
  { texto: 'Backup manual (exportar e importar arquivo)', feito: true },
  { texto: 'Teste de escrita com a caneta', feito: true },
  { texto: 'Teste de envio de fonte TTF e OTF', feito: true },
  { texto: 'Sincronização com a nuvem (vários aparelhos)', feito: !!nuvem },
  { texto: 'Cópia automática dos dados na nuvem', feito: !!nuvem },
  { texto: 'Backup automático no Google Drive', feito: false },
];

function Atencoes() {
  const [a, setA] = useState<Atencao | null>(null);
  useEffect(() => {
    void carregarAtencao().then(setA);
  }, []);
  if (!a) return null;
  const nada = a.manutencoes.length === 0 && a.pedidos.length === 0 && a.materiaisParaRepor.length === 0;
  return (
    <div className="cartao">
      <h2>Pedindo atenção</h2>
      {nada && <p className="suave" style={{ margin: 0 }}>Nada pedindo atenção agora: sem entregas perto do prazo, sem manutenção vencendo e sem material abaixo do mínimo.</p>}
      {a.pedidos.length > 0 && (
        <>
          <h3 style={{ margin: '8px 0 4px' }}>Entregas</h3>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {a.pedidos.map((p) => (
              <li key={p.numero}>
                Pedido #{p.numero} · {p.cliente} · {dataParaTexto(p.dataPrometida)}{' '}
                <strong>{p.dias < 0 ? `(atrasado há ${-p.dias} dia(s))` : p.dias === 0 ? '(é hoje)' : `(em ${p.dias} dia(s))`}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
      {a.manutencoes.length > 0 && (
        <>
          <h3 style={{ margin: '12px 0 4px' }}>Manutenção</h3>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            {a.manutencoes.map((m) => <li key={`${m.equipamentoId}-${m.tarefaId}`}>{m.equipamento}: {m.tarefa} <strong>({textoDoPrazo(m.dias)})</strong></li>)}
          </ul>
        </>
      )}
      {a.materiaisParaRepor.length > 0 && (
        <>
          <h3 style={{ margin: '12px 0 4px' }}>Material para repor ({a.materiaisParaRepor.length})</h3>
          <p className="suave" style={{ margin: 0 }}>
            {a.materiaisParaRepor.slice(0, 8).join(', ')}{a.materiaisParaRepor.length > 8 ? ` e mais ${a.materiaisParaRepor.length - 8}` : ''}. Veja o filtro “Repor” em Materiais.
          </p>
        </>
      )}
    </div>
  );
}

export function Inicio() {
  return (
    <>
      <h1>Craft Notes Unique</h1>
      <p className="suave">atelier criativo</p>
      <Atencoes />
      <div className="cartao">
        <h2>Entregas da etapa 0</h2>
        <ul className="checklist">
          {ITENS.map((i) => (
            <li key={i.texto}>
              <span className={i.feito ? 'ok' : 'pendente'} aria-hidden="true">{i.feito ? '✓' : '○'}</span>
              <span>{i.texto}</span>
              <span className="suave" style={{ marginLeft: 'auto' }}>{i.feito ? 'pronto' : 'a fazer'}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
