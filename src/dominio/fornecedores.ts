export interface CompraRegistro {
  fornecedor?: string;
  valorTotalCentavos?: number;
  criadoEm: string;
}

export interface ResumoFornecedor {
  compras: number;
  totalCentavos: number;
  ultima: string | null; // data ISO da última compra
}

const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');

/** Resume as compras feitas a um fornecedor (o nome é comparado sem diferenciar maiúsculas). */
export function resumirFornecedor(compras: CompraRegistro[], nome: string): ResumoFornecedor {
  const alvo = norm(nome);
  let n = 0;
  let total = 0;
  let ultima: string | null = null;
  for (const c of compras) {
    if (!c.fornecedor || norm(c.fornecedor) !== alvo) continue;
    n += 1;
    total += c.valorTotalCentavos ?? 0;
    if (!ultima || c.criadoEm > ultima) ultima = c.criadoEm;
  }
  return { compras: n, totalCentavos: total, ultima };
}
