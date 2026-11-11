import Dexie, { type Table } from 'dexie';
import type { Movimentacao } from '../dominio/estoque.ts';
import type { Categoria, Unidade } from '../dominio/materiais.ts';
import type { ItemProduto, Linha, Perfil3D } from '../dominio/produtos.ts';

export interface Material {
  id: string;
  nome: string;
  categoria: Categoria;
  unidade: Unidade;
  essencial: boolean;
  minimo: number;
  embalagemNome: string; // resma, rolo, pacote...
  embalagemQtd: number; // unidades de estoque por embalagem
  custoMedioMicro: number; // 0 = ainda sem custo (nasce da primeira compra)
  foto?: Blob | null;
  ativo: boolean;
  atualizadoEm: string;
}

export interface MovimentacaoRegistro extends Movimentacao {
  id: string;
  criadoEm: string;
  observacao?: string;
  custoUnitMicro?: number; // só em compras
  valorTotalCentavos?: number;
  fornecedor?: string;
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

export interface Fornecedor {
  id: string;
  nome: string;
  contato: string; // telefone ou WhatsApp
  email: string;
  link: string; // site ou loja online
  categorias: string[]; // o que vende (categorias de material)
  observacoes: string;
  ativo: boolean;
  atualizadoEm: string;
}

export interface Produto {
  id: string;
  nome: string;
  linha: Linha;
  categoria: string;
  tempoTrabalhoMin: number;
  precoCentavos: number | null; // preço de venda atual (o sugerido vem na precificação)
  receita: ItemProduto[];
  perfil3d: Perfil3D | null;
  fotos?: Blob[];
  ativo: boolean;
  atualizadoEm: string;
}

class BancoAtelie extends Dexie {
  materiais!: Table<Material, string>;
  movimentacoes!: Table<MovimentacaoRegistro, string>;
  fontes!: Table<FonteRegistro, string>;
  escritas!: Table<TracoRegistro, string>;
  mostruario!: Table<MostruarioRegistro, string>;
  produtos!: Table<Produto, string>;
  fornecedores!: Table<Fornecedor, string>;

  constructor() {
    super('craft-notes-atelie');
    this.version(1).stores({
      materiais: 'id, nome',
      movimentacoes: 'id, materialId, criadoEm',
      fontes: 'id, nome',
      escritas: 'id, criadoEm',
    });
    this.version(2).stores({ mostruario: 'id, tipo, ordem' });
    this.version(3).stores({ materiais: 'id, nome, categoria' });
    this.version(4).stores({ produtos: 'id, nome, linha' });
    this.version(5).stores({ fornecedores: 'id, nome' });
  }
}

export const db = new BancoAtelie();

export function novoId(): string {
  return crypto.randomUUID();
}
