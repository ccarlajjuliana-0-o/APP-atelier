import Dexie, { type Table } from 'dexie';
import type { Movimentacao } from '../dominio/estoque.ts';

export interface Material {
  id: string;
  nome: string;
  unidade: 'folha' | 'g' | 'un';
  essencial: boolean;
  minimo: number;
  custoMedioMicro: number;
  atualizadoEm: string;
}

export interface MovimentacaoRegistro extends Movimentacao {
  id: string;
  criadoEm: string;
  observacao?: string;
}

export interface FonteRegistro {
  id: string;
  nome: string;
  formato: 'ttf' | 'otf';
  licenca: string;
  ativa: boolean;
  arquivo: Blob;
  criadoEm: string;
}

export interface TracoRegistro {
  id: string;
  imagem: Blob; // escrita à mão (PNG)
  criadoEm: string;
}

export interface MostruarioRegistro {
  id: string;
  tipo: 'modelo' | 'adesivo';
  nome: string;
  categoria: string;
  descricao: string;
  tamanhos: string[];
  tamanhoBase: { nome: string; largura_mm: number; altura_mm: number } | null;
  ordem: number;
  visivel: boolean;
  previa: Blob;
  atualizadoEm: string;
}

class BancoAtelie extends Dexie {
  materiais!: Table<Material, string>;
  movimentacoes!: Table<MovimentacaoRegistro, string>;
  fontes!: Table<FonteRegistro, string>;
  escritas!: Table<TracoRegistro, string>;
  mostruario!: Table<MostruarioRegistro, string>;

  constructor() {
    super('craft-notes-atelie');
    this.version(1).stores({
      materiais: 'id, nome',
      movimentacoes: 'id, materialId, criadoEm',
      fontes: 'id, nome',
      escritas: 'id, criadoEm',
    });
    this.version(2).stores({ mostruario: 'id, tipo, ordem' });
  }
}

export const db = new BancoAtelie();

export function novoId(): string {
  return crypto.randomUUID();
}
