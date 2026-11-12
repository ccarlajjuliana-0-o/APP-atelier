import { useSyncExternalStore } from 'react';
import { nuvem } from '../../dados/nuvem.ts';
import { assinar, lerEstado, refazerSincronizacao, sincronizar } from '../../dados/sync.ts';

const TEXTO = {
  parado: 'Ainda não sincronizou nesta sessão.',
  sincronizando: 'Sincronizando…',
  ok: 'Tudo sincronizado.',
  erro: 'Não foi possível sincronizar.',
  offline: 'Sem internet.',
} as const;

export function useEstadoNuvem() {
  return useSyncExternalStore(assinar, lerEstado);
}

/** Linha pequena para o rodapé do menu. */
export function EstadoNuvem() {
  const e = useEstadoNuvem();
  if (!nuvem) return null;
  const hora = e.ultima ? new Date(e.ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const texto = e.situacao === 'ok' ? `Nuvem: em dia às ${hora}` : e.situacao === 'sincronizando' ? 'Nuvem: sincronizando…' : e.situacao === 'erro' ? 'Nuvem: erro (veja em Nuvem)' : e.situacao === 'offline' ? 'Nuvem: sem internet' : 'Nuvem';
  return <div className="suave" style={{ fontSize: 'calc(12px * var(--escala, 1))', padding: '0 14px 8px' }}>{texto}</div>;
}

export function Nuvem() {
  const e = useEstadoNuvem();

  if (!nuvem) {
    return (
      <>
        <h1>Nuvem</h1>
        <div className="aviso">Modo local: o Supabase ainda não está ligado neste app, então não há o que sincronizar. O backup manual continua disponível em Backup.</div>
      </>
    );
  }

  return (
    <>
      <h1>Nuvem</h1>
      <p className="suave">Seus dados ficam no aparelho e uma cópia vai para o Supabase. Entre com a mesma conta GitHub em outro aparelho (como o tablet) e tudo aparece lá.</p>
      <div className="faixa" />
      <div className="cartao">
        <h2>Situação</h2>
        <p style={{ margin: '0 0 6px' }}><strong>{TEXTO[e.situacao]}</strong></p>
        {e.ultima && <p className="suave" style={{ margin: 0 }}>Última vez: {new Date(e.ultima).toLocaleString('pt-BR')} · enviados {e.enviados} · recebidos {e.recebidos}</p>}
        {e.mensagem && <p className="aviso" style={{ marginTop: 10 }}>{e.mensagem}</p>}
        <div className="linha" style={{ marginTop: 14 }}>
          <button className="btn primario" disabled={e.situacao === 'sincronizando'} onClick={() => void sincronizar()}>Sincronizar agora</button>
        </div>
      </div>
      <div className="cartao">
        <h2>Como funciona</h2>
        <ul style={{ lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>O app sincroniza sozinho ao abrir, uns 15 segundos depois de cada alteração, a cada 3 minutos e quando a internet volta.</li>
          <li>Sem internet, tudo continua funcionando e sobe depois.</li>
          <li>Se o mesmo registro for alterado em dois aparelhos, vale a alteração mais recente. As movimentações de estoque (compras, reservas, baixas) nunca se perdem: as dos dois aparelhos são somadas.</li>
          <li>Entram na nuvem: materiais e estoque, produtos, fornecedores, clientes, pedidos, despesas e ajustes do financeiro, com as fotos. O mostruário já vem da nuvem pelo Estúdio de Miolos.</li>
          <li>No aparelho novo, entre e espere o primeiro “Tudo sincronizado” antes de usar “Carregar lista inicial” em Materiais.</li>
        </ul>
      </div>
      <div className="cartao">
        <h2>Se algo parecer fora do lugar</h2>
        <p className="suave" style={{ marginTop: 0 }}>Refaz a conferência completa: envia tudo o que está aqui e confere tudo o que está na nuvem. Não apaga nada.</p>
        <button className="btn" disabled={e.situacao === 'sincronizando'} onClick={() => void refazerSincronizacao()}>Refazer sincronização completa</button>
      </div>
    </>
  );
}
