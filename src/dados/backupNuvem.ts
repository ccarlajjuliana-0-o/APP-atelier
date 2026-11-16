import { nuvem } from './nuvem.ts';
import { exportarTudo, importarTudo } from './backup.ts';
import {
  COPIAS_GUARDADAS, FREQUENCIA_PADRAO, FREQUENCIAS, TAMANHO_MAXIMO, copiasParaApagar, dataDoNome, nomeDoBackup, precisaFazerBackup,
} from '../dominio/backupNuvem.ts';

// Backup automático: uma cópia completa (a mesma do "Exportar backup") guardada no Supabase, na pasta de cada pessoa.

const BUCKET = 'backups';

export interface CopiaNaNuvem { nome: string; data: Date; tamanho: number }

async function usuario(): Promise<string | null> {
  if (!nuvem) return null;
  const { data } = await nuvem.auth.getSession();
  return data.session?.user.id ?? null;
}

const chave = (uid: string, k: 'ultimo' | 'dias') => `cnu.backup.${uid}.${k}`;

export async function lerConfiguracao(): Promise<{ ultimo: number | null; dias: number }> {
  const uid = await usuario();
  if (!uid) return { ultimo: null, dias: FREQUENCIA_PADRAO };
  const u = Number(localStorage.getItem(chave(uid, 'ultimo')));
  const d = Number(localStorage.getItem(chave(uid, 'dias')));
  return { ultimo: u > 0 ? u : null, dias: FREQUENCIAS.some((f) => f.dias === d) ? d : FREQUENCIA_PADRAO };
}

export async function guardarFrequencia(dias: number): Promise<void> {
  const uid = await usuario();
  if (uid) localStorage.setItem(chave(uid, 'dias'), String(dias));
}

function textoDoErro(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/bucket not found/i.test(m)) return 'O espaço de backups ainda não foi criado. Rode o arquivo docs/backup-nuvem.sql no SQL Editor do Supabase.';
  if (/row-level security|not authorized|unauthorized/i.test(m)) return 'Sem permissão para gravar backups. Confira se o arquivo docs/backup-nuvem.sql foi executado no Supabase.';
  return m || 'Não consegui fazer o backup.';
}

/** Faz uma cópia agora e apaga as mais antigas além do limite. Devolve o nome do arquivo. */
export async function fazerBackupNaNuvem(): Promise<string> {
  const uid = await usuario();
  if (!nuvem || !uid) throw new Error('Entre com sua conta para fazer backup na nuvem.');
  try {
    const blob = await exportarTudo();
    if (blob.size > TAMANHO_MAXIMO) throw new Error('O backup ficou grande demais para a nuvem (mais de 45 MB). Reduza as fotos ou use "Exportar backup" para guardar o arquivo por conta própria.');
    const nome = nomeDoBackup(new Date());
    const { error } = await nuvem.storage.from(BUCKET).upload(`${uid}/${nome}`, blob, { contentType: 'application/json', upsert: true });
    if (error) throw error;
    localStorage.setItem(chave(uid, 'ultimo'), String(Date.now()));
    await limparAntigas(uid);
    return nome;
  } catch (e) {
    throw new Error(textoDoErro(e));
  }
}

async function limparAntigas(uid: string): Promise<void> {
  if (!nuvem) return;
  const { data } = await nuvem.storage.from(BUCKET).list(uid, { limit: 200 });
  const apagar = copiasParaApagar((data ?? []).map((a) => a.name), COPIAS_GUARDADAS);
  if (apagar.length) await nuvem.storage.from(BUCKET).remove(apagar.map((n) => `${uid}/${n}`));
}

export async function listarCopias(): Promise<CopiaNaNuvem[]> {
  const uid = await usuario();
  if (!nuvem || !uid) return [];
  const { data, error } = await nuvem.storage.from(BUCKET).list(uid, { limit: 200 });
  if (error) throw new Error(textoDoErro(error));
  return (data ?? [])
    .map((a) => ({ nome: a.name, data: dataDoNome(a.name), tamanho: Number((a.metadata as { size?: number } | null)?.size ?? 0) }))
    .filter((c): c is CopiaNaNuvem => c.data !== null)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
}

export async function baixarCopia(nome: string): Promise<Blob> {
  const uid = await usuario();
  if (!nuvem || !uid) throw new Error('Entre com sua conta.');
  const { data, error } = await nuvem.storage.from(BUCKET).download(`${uid}/${nome}`);
  if (error || !data) throw new Error(textoDoErro(error ?? 'Não consegui baixar essa cópia.'));
  return data;
}

/** Traz de volta o que está numa cópia. O que foi criado depois dela é mantido; o que estava nela volta ao estado guardado. */
export async function restaurarCopia(nome: string): Promise<void> {
  const blob = await baixarCopia(nome);
  await importarTudo(new File([blob], nome, { type: 'application/json' }), { prevalecer: true });
}

let rodando = false;

/** Confere se já está na hora de uma cópia e faz sozinho. Chamado ao abrir o app, ao voltar para ele e de hora em hora. */
async function conferir(): Promise<void> {
  if (rodando || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  const { ultimo, dias } = await lerConfiguracao();
  if (!precisaFazerBackup({ ultimo, agora: Date.now(), dias })) return;
  rodando = true;
  try {
    await fazerBackupNaNuvem();
  } catch {
    /* tenta de novo na próxima conferência; o aviso aparece na tela Backup */
  } finally {
    rodando = false;
  }
}

export function iniciarBackupAutomatico(): () => void {
  if (!nuvem) return () => {};
  const primeiro = window.setTimeout(() => void conferir(), 60_000); // depois da primeira sincronização
  const hora = window.setInterval(() => void conferir(), 60 * 60_000);
  const voltou = () => document.visibilityState === 'visible' && void conferir();
  document.addEventListener('visibilitychange', voltou);
  return () => {
    window.clearTimeout(primeiro);
    window.clearInterval(hora);
    document.removeEventListener('visibilitychange', voltou);
  };
}
