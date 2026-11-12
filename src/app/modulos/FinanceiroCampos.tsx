import { useState, type ReactNode } from 'react';
import { lerNumero } from '../../dominio/materiais.ts';

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

/** Campo numérico que aceita vírgula. Devolve null quando está vazio ou inválido. */
export function CampoNumero(p: { rotulo: string; valor: number | null; aoMudar: (n: number | null) => void; dica?: string; sufixo?: string }) {
  const [texto, setTexto] = useState(p.valor === null || p.valor === undefined ? '' : String(p.valor).replace('.', ','));
  return (
    <Campo rotulo={p.sufixo ? `${p.rotulo} (${p.sufixo})` : p.rotulo}>
      <input
        type="text"
        inputMode="decimal"
        placeholder={p.dica}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const n = lerNumero(e.target.value);
          p.aoMudar(Number.isNaN(n) ? null : n);
        }}
      />
    </Campo>
  );
}

export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function hojeISO(): string {
  const d = new Date();
  return `${mesAtual()}-${String(d.getDate()).padStart(2, '0')}`;
}
