import { db } from './db.ts';
import { nuvem } from './nuvem.ts';
import {
  TABELAS_SINCRONIZADAS, dataDoRegistro, desserializar, emLotes, nuvemSubstitui, precisaEnviar, serializar,
} from '../dominio/sync.ts';

export type Situacao = 'parado' | 'sincronizando' | 'ok' | 'erro' | 'offline';

export interface EstadoSync {
  situacao: Situacao;
  ultima: string | null; // ISO da última sincronização concluída
  mensagem: string;
  enviados: number;
  recebidos: number;
}

let estado: EstadoSync = { situacao: 'parado', ultima: null, mensagem: '', enviados: 0, recebidos: 0 };
const ouvintes = new Set<() => void>();

function definir(parte: Partial<EstadoSync>) {
  estado = { ...estado, ...parte };
  ouvintes.forEach((f) => f());
}
export const lerEstado = (): EstadoSync => estado;
export function assinar(f: () => void): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

function blobParaTexto(b: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(r.error);
    r.readAsDataURL(b);
  });
}
async function textoParaBlob(t: string): Promise<Blob> {
  return (await fetch(t)).blob();
}

/** Quanto esperar depois de uma alteração antes de sincronizar (junta várias alterações seguidas). */
const ESPERA_APOS_ALTERACAO_MS = 15_000;
const TAMANHO_PAGINA = 40;
const TAMANHO_LOTE = 25;

let emAndamento: Promise<void> | null = null;

/** Sincroniza agora. Chamadas simultâneas aproveitam a que já está rodando. */
export function sincronizar(): Promise<void> {
  if (!emAndamento) emAndamento = executar().finally(() => { emAndamento = null; });
  return emAndamento;
}

function textoDoErro(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/registros/i.test(m) && /(does not exist|not find|schema cache)/i.test(m)) {
    return 'A tabela da nuvem ainda não foi criada. Rode o arquivo docs/sincronizacao.sql no SQL Editor do Supabase.';
  }
  return m;
}

async function executar(): Promise<void> {
  if (!nuvem) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    definir({ situacao: 'offline', mensagem: 'Sem internet. Os dados ficam no aparelho e sobem quando a conexão voltar.' });
    return;
  }
  const { data } = await nuvem.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;

  definir({ situacao: 'sincronizando', mensagem: '' });
  const inicio = Date.now();
  try {
    const chaveCursor = `cnu.sync.${uid}.cursor`;
    const chaveEnvio = `cnu.sync.${uid}.envio`;
    const ultimoEnvio = Number(localStorage.getItem(chaveEnvio) ?? 0) || 0;
    const cursor = localStorage.getItem(chaveCursor) ?? '';

    // ajustes salvos antes da sincronização existir não têm data de alteração
    const ajustesLocal = await db.ajustes.get('financeiro');
    if (ajustesLocal && !ajustesLocal.atualizadoEm) {
      await db.ajustes.update('financeiro', { atualizadoEm: new Date().toISOString() });
    }

    // 1) receber o que mudou na nuvem
    const aplicados = new Set<string>();
    let recebidos = 0;
    let maiorRecebido = cursor;
    for (let pagina = 0; ; pagina++) {
      let filtro = nuvem.from('registros').select('tabela,id,dados,recebido_em');
      if (cursor) filtro = filtro.gt('recebido_em', cursor);
      const { data: linhas, error } = await filtro
        .order('recebido_em', { ascending: true })
        .order('tabela', { ascending: true })
        .order('id', { ascending: true })
        .range(pagina * TAMANHO_PAGINA, pagina * TAMANHO_PAGINA + TAMANHO_PAGINA - 1);
      if (error) throw error;
      for (const l of linhas ?? []) {
        if (String(l.recebido_em) > maiorRecebido) maiorRecebido = String(l.recebido_em);
        if (!(TABELAS_SINCRONIZADAS as readonly string[]).includes(l.tabela)) continue;
        const tabela = db.table(l.tabela);
        const local = await tabela.get(l.id);
        const obj = await desserializar(l.dados as Record<string, unknown>, textoParaBlob);
        if (nuvemSubstitui(dataDoRegistro(obj as { atualizadoEm?: string; criadoEm?: string }), local ? dataDoRegistro(local) : null)) {
          await tabela.put(obj);
          aplicados.add(`${l.tabela}/${l.id}`);
          recebidos += 1;
        }
      }
      if ((linhas ?? []).length < TAMANHO_PAGINA) break;
    }

    // 2) enviar o que mudou aqui desde o último envio
    let enviados = 0;
    for (const nome of TABELAS_SINCRONIZADAS) {
      const todos = (await db.table(nome).toArray()) as Record<string, unknown>[];
      const mudados = todos.filter((r) => !aplicados.has(`${nome}/${String(r.id)}`) && precisaEnviar(dataDoRegistro(r), ultimoEnvio));
      for (const lote of emLotes(mudados, TAMANHO_LOTE)) {
        const linhas = await Promise.all(
          lote.map(async (r) => ({
            user_id: uid,
            tabela: nome,
            id: String(r.id),
            dados: await serializar(r, blobParaTexto),
            atualizado_em: new Date(dataDoRegistro(r) || Date.now()).toISOString(),
          })),
        );
        const { error } = await nuvem.from('registros').upsert(linhas, { onConflict: 'user_id,tabela,id' });
        if (error) throw error;
        enviados += lote.length;
      }
    }

    localStorage.setItem(chaveEnvio, String(inicio));
    localStorage.setItem(chaveCursor, maiorRecebido);
    definir({ situacao: 'ok', ultima: new Date().toISOString(), mensagem: '', enviados, recebidos });
  } catch (e) {
    definir({ situacao: 'erro', mensagem: textoDoErro(e) });
  }
}

/** Esquece até onde já sincronizou e refaz tudo: envia todos os registros daqui e confere todos os da nuvem. */
export async function refazerSincronizacao(): Promise<void> {
  if (!nuvem) return;
  const { data } = await nuvem.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  localStorage.removeItem(`cnu.sync.${uid}.cursor`);
  localStorage.removeItem(`cnu.sync.${uid}.envio`);
  await sincronizar();
}

// ---------- automático ----------

let agendar: (() => void) | null = null;
let ganchosRegistrados = false;

function registrarGanchos() {
  if (ganchosRegistrados) return;
  ganchosRegistrados = true;
  const marcar = () => {
    agendar?.();
  };
  db.materiais.hook('creating', marcar);
  db.materiais.hook('updating', marcar);
  db.movimentacoes.hook('creating', marcar);
  db.fornecedores.hook('creating', marcar);
  db.fornecedores.hook('updating', marcar);
  db.produtos.hook('creating', marcar);
  db.produtos.hook('updating', marcar);
  db.clientes.hook('creating', marcar);
  db.clientes.hook('updating', marcar);
  db.pedidos.hook('creating', marcar);
  db.pedidos.hook('updating', marcar);
  db.despesas.hook('creating', marcar);
  db.despesas.hook('updating', marcar);
  db.ajustes.hook('creating', marcar);
  db.ajustes.hook('updating', marcar);
  db.equipamentos.hook('creating', marcar);
  db.equipamentos.hook('updating', marcar);
  db.publicacoes.hook('creating', marcar);
  db.publicacoes.hook('updating', marcar);
  db.preferencias.hook('creating', marcar);
  db.preferencias.hook('updating', marcar);
}

/** Liga a sincronização automática: ao abrir, a cada poucos minutos, ao voltar a internet, ao voltar para a aba e ~15 s depois de cada alteração. */
export function iniciarSincronizacaoAutomatica(): () => void {
  if (!nuvem) return () => {};
  registrarGanchos();
  let espera: ReturnType<typeof setTimeout> | undefined;
  agendar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => void sincronizar(), ESPERA_APOS_ALTERACAO_MS);
  };
  const agora = () => void sincronizar();
  const aoVisivel = () => {
    if (document.visibilityState === 'visible') agora();
  };
  agora();
  const intervalo = setInterval(agora, 3 * 60 * 1000);
  window.addEventListener('online', agora);
  document.addEventListener('visibilitychange', aoVisivel);
  return () => {
    clearTimeout(espera);
    clearInterval(intervalo);
    window.removeEventListener('online', agora);
    document.removeEventListener('visibilitychange', aoVisivel);
    agendar = null;
  };
}
