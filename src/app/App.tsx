import { useState } from 'react';
import { AuthGate } from './AuthGate.tsx';
import { useTema } from './tema/useTema.ts';
import { Inicio } from './modulos/Inicio.tsx';
import { Aparencia } from './modulos/Aparencia.tsx';
import { TesteCaneta } from './modulos/TesteCaneta.tsx';
import { TesteFonte } from './modulos/TesteFonte.tsx';
import { Mostruario } from './modulos/Mostruario.tsx';
import { Backup } from './modulos/Backup.tsx';
import { sair, nuvem } from '../dados/nuvem.ts';

type Tela = 'inicio' | 'aparencia' | 'caneta' | 'fonte' | 'backup' | 'mostruario';

const ATIVAS: { id: Tela; nome: string }[] = [
  { id: 'inicio', nome: 'Início' },
  { id: 'caneta', nome: 'Teste da caneta' },
  { id: 'fonte', nome: 'Teste de fontes' },
  { id: 'mostruario', nome: 'Mostruário' },
  { id: 'backup', nome: 'Backup' },
  { id: 'aparencia', nome: 'Aparência e marca' },
];

const EM_BREVE = ['Materiais', 'Produtos', 'Pedidos', 'Clientes', 'Financeiro', 'Equipamentos', 'Divulgação', 'Assistente'];

export function App() {
  const [prefs, setPrefs] = useTema();
  const [tela, setTela] = useState<Tela>('inicio');

  return (
    <AuthGate>
      {(modoLocal) => (
        <div className="app">
          <nav className="menu" aria-label="Menu principal">
            <div className="marca">
              <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Logomarca Craft Notes Unique" />
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
            {tela === 'inicio' && <Inicio />}
            {tela === 'aparencia' && <Aparencia prefs={prefs} aoMudar={setPrefs} />}
            {tela === 'caneta' && <TesteCaneta />}
            {tela === 'fonte' && <TesteFonte />}
            {tela === 'mostruario' && <Mostruario />}
            {tela === 'backup' && <Backup />}
          </main>
        </div>
      )}
    </AuthGate>
  );
}
