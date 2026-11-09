import { nuvem } from '../../dados/nuvem.ts';

const ITENS: { texto: string; feito: boolean }[] = [
  { texto: 'App abre no tablet e na web, com o nome e a logomarca', feito: true },
  { texto: 'Login com GitHub e conta na nuvem', feito: !!nuvem },
  { texto: 'Banco local no aparelho (funciona sem internet)', feito: true },
  { texto: 'Tema claro e escuro e cores da marca', feito: true },
  { texto: 'Backup manual (exportar e importar arquivo)', feito: true },
  { texto: 'Teste de escrita com a caneta', feito: true },
  { texto: 'Teste de envio de fonte TTF e OTF', feito: true },
  { texto: 'Sincronização com a nuvem', feito: false },
  { texto: 'Backup automático', feito: false },
];

export function Inicio() {
  return (
    <>
      <h1>Craft Notes Unique</h1>
      <p className="suave">atelier criativo · Etapa 0: fundação</p>
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
