// Regras do backup automático na nuvem: quando fazer, como nomear e quantas cópias guardar.

export const FREQUENCIAS = [
  { dias: 1, nome: 'Todo dia' },
  { dias: 3, nome: 'A cada 3 dias' },
  { dias: 7, nome: 'Toda semana' },
  { dias: 14, nome: 'A cada 2 semanas' },
] as const;
export const FREQUENCIA_PADRAO = 7;
export const COPIAS_GUARDADAS = 10;
export const TAMANHO_MAXIMO = 45 * 1024 * 1024; // o Supabase aceita até 50 MB por arquivo; sobra uma folga

const dois = (n: number) => String(n).padStart(2, '0');

/** "backup-2026-11-16-1830.json" (hora local). */
export function nomeDoBackup(d: Date): string {
  return `backup-${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}.json`;
}

/** Data (hora local) que o nome carrega, ou null se não for um backup do app. */
export function dataDoNome(nome: string): Date | null {
  const m = /^backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.json$/.exec(nome);
  if (!m) return null;
  const [a, me, di, h, mi] = m.slice(1).map(Number);
  const d = new Date(a, me - 1, di, h, mi);
  return d.getMonth() === me - 1 ? d : null;
}

/** Já passou tempo suficiente desde o último backup? (`ultimo` em ms, ou null se nunca fez) */
export function precisaFazerBackup(o: { ultimo: number | null; agora: number; dias: number }): boolean {
  if (o.ultimo === null || !Number.isFinite(o.ultimo)) return true;
  return o.agora - o.ultimo >= o.dias * 24 * 3600 * 1000 - 60_000;
}

/** Nomes que passam do limite de cópias guardadas (as mais antigas). Arquivos que não são backups do app nunca entram. */
export function copiasParaApagar(nomes: string[], manter: number): string[] {
  const validos = nomes
    .map((n) => ({ n, d: dataDoNome(n) }))
    .filter((x): x is { n: string; d: Date } => x.d !== null)
    .sort((a, b) => b.d.getTime() - a.d.getTime());
  return validos.slice(Math.max(1, manter)).map((x) => x.n);
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
