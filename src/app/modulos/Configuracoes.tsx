import { useState } from 'react';
import type { Preferencias } from '../tema/tema.ts';
import type { TemaResolvido } from '../../dominio/temas.ts';
import { Aparencia } from './Aparencia.tsx';
import { TesteCaneta } from './TesteCaneta.tsx';
import { TesteFonte } from './TesteFonte.tsx';
import { TemasFestivos } from './TemasFestivos.tsx';

type Aba = 'aparencia' | 'temas' | 'caneta' | 'fonte';
const ABAS: [Aba, string][] = [['aparencia', 'Aparência e marca'], ['temas', 'Temas festivos'], ['caneta', 'Teste da caneta'], ['fonte', 'Teste de fontes']];

export function Configuracoes({ prefs, aoMudar, tema }: { prefs: Preferencias; aoMudar: (p: Preferencias) => void; tema: TemaResolvido | null }) {
  const [aba, setAba] = useState<Aba>('aparencia');
  return (
    <>
      <h1>Configurações</h1>
      <div className="linha" style={{ margin: '8px 0 16px' }}>
        {ABAS.map(([id, nome]) => <button key={id} className="pilula" aria-pressed={aba === id} onClick={() => setAba(id)}>{nome}</button>)}
      </div>
      {aba === 'aparencia' && <Aparencia prefs={prefs} aoMudar={aoMudar} />}
      {aba === 'temas' && <TemasFestivos prefs={prefs} aoMudar={aoMudar} tema={tema} />}
      {aba === 'caneta' && <TesteCaneta />}
      {aba === 'fonte' && <TesteFonte />}
    </>
  );
}
