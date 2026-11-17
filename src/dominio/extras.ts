// Extras do catálogo: itens a mais (elástico, cantoneira...) que somam ao preço do pedido.
import { ID_EXTRAS, type GrupoOpcoes } from './opcoes.ts';

export interface ExtraCatalogo {
  id: string;
  nome: string;
  precoCentavos: number; // valor somado ao item
  materialId: string | null; // material do estoque reservado (opcional)
  quantidade: number;
  variantes: string[]; // ex.: tipos de cantoneira (materiais); a cliente só vê os que têm estoque
  pedeTexto: string; // ex.: "Qual nome na capa?" — vazio = não pede
  ativo: boolean;
  ordem: number;
  atualizadoEm: string;
}

/** Extras de encadernação que já vêm cadastrados. Só os valores combinados já entram; o resto fica em R$ 0,00 para você definir. */
export const EXTRAS_PADRAO: { id: string; nome: string; precoCentavos: number; pedeTexto?: string }[] = [
  { id: 'extra-bolso-canguru', nome: 'Bolso canguru', precoCentavos: 650 },
  { id: 'extra-elastico', nome: 'Elástico', precoCentavos: 500 },
  { id: 'extra-pin-elastico', nome: 'Pin no elástico', precoCentavos: 0 },
  { id: 'extra-nome-capa', nome: 'Nome na capa', precoCentavos: 0, pedeTexto: 'Qual nome na capa?' },
  { id: 'extra-cantoneira', nome: 'Cantoneira', precoCentavos: 600 },
  { id: 'extra-cartela-adesivos', nome: 'Cartela de adesivos', precoCentavos: 0 },
  { id: 'extra-miolo-extra', nome: 'Miolo extra', precoCentavos: 0 },
  { id: 'extra-fecho-ima', nome: 'Fecho de imã', precoCentavos: 0 },
];

export function extrasPadrao(agora: string): ExtraCatalogo[] {
  return EXTRAS_PADRAO.map((e, i) => ({
    id: e.id, nome: e.nome, precoCentavos: e.precoCentavos, materialId: null, quantidade: 1, variantes: [],
    pedeTexto: e.pedeTexto ?? '', ativo: true, ordem: i, atualizadoEm: agora,
  }));
}

/** Os extras viram uma pergunta de marcar várias, para usar o mesmo formulário dos pedidos. */
export function extrasComoGrupo(extras: ExtraCatalogo[]): GrupoOpcoes {
  return {
    id: ID_EXTRAS, nome: 'Extras', tipo: 'multipla', obrigatorio: false,
    opcoes: extras.filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem).map((e) => ({
      id: e.id, nome: e.nome, materialId: e.variantes.length ? null : e.materialId, quantidade: e.quantidade || 1, desperdicioPct: 0,
      acrescimoCentavos: e.precoCentavos, padrao: false,
      ...(e.variantes.length ? { variantes: e.variantes } : {}),
      ...(e.pedeTexto ? { pedeTexto: e.pedeTexto } : {}),
    })),
  };
}
