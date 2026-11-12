import { useEffect, useState } from 'react';
import { AuthGate } from './AuthGate.tsx';
import { useTema } from './tema/useTema.ts';
import { Inicio } from './modulos/Inicio.tsx';
import { Configuracoes } from './modulos/Configuracoes.tsx';
import { Materiais } from './modulos/Materiais.tsx';
import { Fornecedores } from './modulos/Fornecedores.tsx';
import { Produtos } from './modulos/Produtos.tsx';
import { Pedidos } from './modulos/Pedidos.tsx';
import { Clientes } from './modulos/Clientes.tsx';
import { Financeiro } from './modulos/Financeiro.tsx';
import { Equipamentos } from './modulos/Equipamentos.tsx';
import { Divulgacao } from './modulos/Divulgacao.tsx';
import { AssistenteFlutuante } from './modulos/Assistente.tsx';
import type { Tela } from './telas.ts';
import { Logo } from './componentes/Logo.tsx';
import { Mostruario } from './modulos/Mostruario.tsx';
import { Backup } from './modulos/Backup.tsx';
import { sair, nuvem } from '../dados/nuvem.ts';
import { iniciarSincronizacaoAutomatica } from '../dados/sync.ts';
import { Nuvem, EstadoNuvem } from './modulos/Nuvem.tsx';


const ATIVAS: { id: Tela; nome: string }[] = [
  { id: 'inicio', nome: 'Início' },
  { id: 'materiais', nome: 'Materiais' },
  { id: 'produtos', nome: 'Produtos' },
  { id: 'fornecedores', nome: 'Fornecedores' },
  { id: 'pedidos', nome: 'Pedidos' },
  { id: 'clientes', nome: 'Clientes' },
  { id: 'financeiro', nome: 'Financeiro' },
  { id: 'equipamentos', nome: 'Equipamentos' },
  { id: 'divulgacao', nome: 'Divulgação' },
  { id: 'mostruario', nome: 'Mostruário' },
  { id: 'backup', nome: 'Backup' },
  { id: 'nuvem', nome: 'Nuvem' },
  { id: 'configuracoes', nome: 'Configurações' },
];

const EM_BREVE: string[] = [];

/** Liga a sincronização automática enquanto o app está aberto e logado. */
function SincronizacaoAutomatica() {
  useEffect(() => iniciarSincronizacaoAutomatica(), []);
  return null;
}

export function App() {
  const [prefs, setPrefs, temaAtivo] = useTema();
  const [tela, setTela] = useState<Tela>('inicio');

  return (
    <AuthGate>
      {(modoLocal) => (
        <div className="app">
          {!modoLocal && <SincronizacaoAutomatica />}
          <nav className="menu" aria-label="Menu principal">
            <div className="marca">
              <Logo alt="Logomarca Craft Notes Unique" />
              <div>
                <strong>Craft Notes Unique</strong>
                <span>atelier criativo</span>
              </div>
            </div>
            {ATIVAS.map((t) => (
              <button key={t.id} className="item" aria-current={tela === t.id ? 'page' : undefined} onClick={() => setTela(t.id)}>
                {t.nome}
              </button>
            ))}
            {EM_BREVE.map((n) => (
              <button key={n} className="item" disabled>
                {n}
                <span className="em-breve">em breve</span>
              </button>
            ))}
            <div className="espaco" />
            <EstadoNuvem />
            {nuvem && (
              <button className="item" onClick={() => void sair()}>
                Sair
              </button>
            )}
          </nav>
          <main className="conteudo">
            {modoLocal && (
              <div className="aviso">Modo local: os dados ficam só neste aparelho. O login com GitHub e a nuvem entram quando o Supabase for configurado.</div>
            )}
            {tela === 'inicio' && <Inicio ir={setTela} tema={temaAtivo} />}
            {tela === 'configuracoes' && <Configuracoes prefs={prefs} aoMudar={setPrefs} tema={temaAtivo} />}
            {tela === 'materiais' && <Materiais />}
            {tela === 'produtos' && <Produtos />}
            {tela === 'fornecedores' && <Fornecedores />}
            {tela === 'pedidos' && <Pedidos />}
            {tela === 'clientes' && <Clientes />}
            {tela === 'financeiro' && <Financeiro />}
            {tela === 'equipamentos' && <Equipamentos />}
            {tela === 'divulgacao' && <Divulgacao />}
            {tela === 'mostruario' && <Mostruario />}
            {tela === 'backup' && <Backup />}
            {tela === 'nuvem' && <Nuvem />}
          </main>
          {nuvem && !modoLocal && <AssistenteFlutuante telaAtual={ATIVAS.find((t) => t.id === tela)?.nome ?? ''} />}
        </div>
      )}
    </AuthGate>
  );
}
