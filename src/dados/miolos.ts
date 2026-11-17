import { db, novoId, type MioloRegistro, type MostruarioRegistro } from './db.ts';
import { nuvem } from './nuvem.ts';
import { CONFIG_PADRAO, MODELOS_MIOLO, TAMANHOS_MIOLO, type ConfigMiolo } from '../dominio/miolo.ts';

export function novoMiolo(): MioloRegistro {
  return { id: novoId(), nome: 'Meu miolo', config: { ...CONFIG_PADRAO }, folhasPorCaderno: 0, atualizadoEm: new Date().toISOString() };
}

export async function salvarMiolo(m: MioloRegistro): Promise<MioloRegistro> {
  const salvo = { ...m, nome: m.nome.trim() || 'Meu miolo', atualizadoEm: new Date().toISOString() };
  await db.miolos.put(salvo);
  return salvo;
}

/** Nada é apagado de vez: o miolo some da lista, mas continua guardado. */
export async function arquivarMiolo(id: string): Promise<void> {
  await db.miolos.update(id, { arquivado: true });
}

export async function listarMiolos(): Promise<MioloRegistro[]> {
  const todos = await db.miolos.toArray();
  return todos.filter((m) => !m.arquivado).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export const idNoMostruario = (id: string) => `miolo-${id}`;

/** Coloca (ou atualiza) o miolo no Mostruário, que os clientes veem ao escolher o miolo do pedido. */
export async function enviarAoMostruario(m: MioloRegistro, previa: Blob): Promise<{ nuvem: boolean }> {
  const cfg: ConfigMiolo = m.config;
  const t = TAMANHOS_MIOLO[cfg.tamanho];
  const id = idNoMostruario(m.id);
  const existente = await db.mostruario.get(id);
  const ordem = existente?.ordem ?? (await db.mostruario.filter((x) => x.tipo === 'modelo').count());
  const reg: MostruarioRegistro = {
    id, tipo: 'modelo', manual: true, nome: m.nome.trim() || 'Meu miolo',
    categoria: MODELOS_MIOLO[cfg.modelo].grupo,
    descricao: `${MODELOS_MIOLO[cfg.modelo].nome} · ${cfg.paginas} páginas`,
    tamanhos: [cfg.tamanho], tamanhoBase: { nome: cfg.tamanho, largura_mm: t.l, altura_mm: t.a },
    ordem, visivel: true, previa, atualizadoEm: new Date().toISOString(),
  };
  await db.mostruario.put(reg);

  if (nuvem) {
    const sessao = await nuvem.auth.getSession();
    if (sessao.data.session) {
      const caminho = `modelo/${id}.png`;
      const up = await nuvem.storage.from('mostruario').upload(caminho, previa, { upsert: true, contentType: 'image/png' });
      if (up.error) throw up.error;
      const { error } = await nuvem.from('mostruario_itens').upsert({
        id, tipo: 'modelo', nome: reg.nome, categoria: reg.categoria, descricao: reg.descricao,
        tamanhos: reg.tamanhos, tamanho_base: reg.tamanhoBase, ordem, preview_path: caminho, visivel: true, atualizado_em: reg.atualizadoEm,
      });
      if (error) throw error;
      return { nuvem: true };
    }
  }
  return { nuvem: false };
}
