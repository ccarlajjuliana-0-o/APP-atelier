import Dexie, { type Table } from 'dexie';
import type { Movimentacao } from '../dominio/estoque.ts';
import type { Categoria, Unidade } from '../dominio/materiais.ts';
import type { FichaProduto, ItemProduto, Linha, Perfil3D, TipoColecao, UsoFilamento } from '../dominio/produtos.ts';
import type { GrupoOpcoes } from '../dominio/opcoes.ts';
import type { ExtraCatalogo } from '../dominio/extras.ts';
import type { Orcamento } from '../dominio/orcamentos.ts';
import type { ItemPedido, Pagamento, Reserva, StatusPedido } from '../dominio/pedidos.ts';
import type { Devolucao } from '../dominio/devolucoes.ts';
import type { TipoPedido } from '../dominio/prazo.ts';
import type { Ajustes, Despesa } from '../dominio/financeiro.ts';
import type { Equipamento } from '../dominio/equipamentos.ts';
import type { Publicacao } from '../dominio/divulgacao.ts';
import type { Preferencias } from '../app/tema/tema.ts';
import type { TemaPersonalizado } from '../dominio/temas.ts';

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
  atualizadoEm?: string;
  removida?: boolean; // "remover" só esconde (nada é apagado da nuvem)
}

export interface TracoRegistro {
  id: string;
  imagem: Blob; // escrita à mão (PNG)
  criadoEm: string;
}

export interface MostruarioRegistro {
  id: string;
  tipo: 'modelo' | 'capa' | 'adesivo'; // modelo = miolo
  manual?: boolean; // capa adicionada à mão (o pacote do Estúdio não a esconde)
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
  modo?: 'catalogo' | 'personalizado'; // legado
  opcoes?: GrupoOpcoes[]; // variações do produto (ex.: cor da capa azul/roxo)
  ficha?: FichaProduto; // descrição: tipo, tamanho, cor, encadernação, folhas
  colecaoTipo?: TipoColecao;
  colecao?: string; // agrupamento: coleção, temporada, data comemorativa ou temática
  prontos?: number; // unidades já prontas (feitas)
  filamentos?: UsoFilamento[]; // 3D: filamentos do estoque (um por cor), com volume e purga
  filamentoMaterialId?: string | null; // legado (um só filamento) // 3D: filamento do estoque (a receita sai do volume + purga)
  capaId?: string | null; // do Mostruário
  miolosIds?: string[];
  adesivosIds?: string[];
  perfil3d: Perfil3D | null;
  fotos?: Blob[];
  ativo: boolean;
  atualizadoEm: string;
}

export interface Cliente {
  id: string;
  nome: string;
  contato: string; // telefone ou WhatsApp
  email: string;
  origem: string; // Instagram, Shopee, indicação, site...
  observacoes: string;
  ativo: boolean;
  atualizadoEm: string;
}

export interface Pedido {
  id: string;
  numero: number;
  clienteId: string | null;
  tipo: TipoPedido;
  status: StatusPedido;
  itens: ItemPedido[];
  observacoes: string;
  prazoDias: number; // em dias úteis, contados da confirmação
  criadoEm: string;
  confirmadoEm: string | null; // AAAA-MM-DD
  dataPrometida: string | null; // AAAA-MM-DD
  entregueEm: string | null; // AAAA-MM-DD
  pagamentos: Pagamento[];
  reservas: Reserva[]; // material reservado e ainda não baixado
  orcamentoId?: string | null;
  orcamentoNumero?: number | null;
  devolucoes?: Devolucao[]; // devoluções de pedido entregue (até 7 dias)
  atualizadoEm: string;
}

/** Perguntas do orçamento personalizado (um registro só, id 'orcamento'). */
export interface FormularioRegistro {
  id: string;
  grupos: GrupoOpcoes[];
  versao?: number; // versão das perguntas padrão que originou este registro
  editado?: boolean; // a dona mexeu: não é substituído por versões novas do padrão
  atualizadoEm: string;
}

export interface PreferenciasRegistro extends Preferencias {
  id: 'tema';
  atualizadoEm: string;
}

export interface IdentidadeRegistro {
  id: 'logo';
  imagem: Blob | null; // null = volta à logo original
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
  clientes!: Table<Cliente, string>;
  pedidos!: Table<Pedido, string>;
  despesas!: Table<Despesa, string>;
  ajustes!: Table<Ajustes, string>;
  equipamentos!: Table<Equipamento, string>;
  publicacoes!: Table<Publicacao, string>;
  preferencias!: Table<PreferenciasRegistro, string>;
  temas!: Table<TemaPersonalizado, string>;
  identidade!: Table<IdentidadeRegistro, string>;
  orcamentos!: Table<Orcamento, string>;
  extras!: Table<ExtraCatalogo, string>;
  formularios!: Table<FormularioRegistro, string>;

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
    this.version(6).stores({ clientes: 'id, nome', pedidos: 'id, numero, status, clienteId' });
    this.version(7).stores({ despesas: 'id, tipo, data', ajustes: 'id' });
    this.version(8).stores({ equipamentos: 'id, nome, tipo' });
    this.version(9).stores({ publicacoes: 'id, data, status' });
    this.version(10).stores({ preferencias: 'id' });
    this.version(11).stores({ temas: 'id', identidade: 'id' });
    // As fontes passam a ir para a nuvem: as que já existem neste aparelho são marcadas como alteradas agora, para serem enviadas.
    this.version(12).stores({}).upgrade((tx) => tx.table('fontes').toCollection().modify((f) => { f.atualizadoEm = new Date().toISOString(); }));
    this.version(13).stores({ orcamentos: 'id, numero, status, clienteId', extras: 'id', formularios: 'id' });
  }
}

export const db = new BancoAtelie();

export function novoId(): string {
  return crypto.randomUUID();
}
