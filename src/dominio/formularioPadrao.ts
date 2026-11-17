// Perguntas que já vêm no orçamento personalizado: o básico do produto e, depois, as de personalização (do questionário da agenda).
import type { GrupoOpcoes, OpcaoProduto, TipoGrupo } from './opcoes.ts';

type NovoId = () => string;

export const CORES_WIREO = ['Preto', 'Branco', 'Prata', 'Dourado', 'Rosê', 'Rosa', 'Lilás', 'Roxo', 'Azul', 'Verde', 'Vermelho'];
export const CORES_DISCO = ['Preto', 'Branco', 'Prata', 'Dourado', 'Rosa', 'Lilás', 'Roxo', 'Azul', 'Transparente'];

export function formularioPadrao(id: NovoId): GrupoOpcoes[] {
  const o = (nome: string): OpcaoProduto => ({ id: id(), nome, materialId: null, quantidade: 0, desperdicioPct: 0, acrescimoCentavos: null, padrao: false });
  const g = (nome: string, tipo: TipoGrupo, nomes: string[] = [], extra: Partial<GrupoOpcoes> = {}): GrupoOpcoes => ({
    id: id(), nome, tipo, obrigatorio: tipo !== 'secao', opcoes: nomes.map(o), ...extra,
  });
  const idDe = (gr: GrupoOpcoes, nome: string) => gr.opcoes.find((x) => x.nome === nome)!.id;

  const tipo = g('Caderno, agenda ou planner?', 'unica', ['Caderno', 'Agenda', 'Planner']);
  const tamanho = g('Tamanho', 'unica', ['A4', 'A5', 'A6'], { permiteOutro: true });
  const cor = g('Cor', 'unica', ['Azul', 'Roxo', 'Rosa', 'Lilás', 'Verde', 'Neutras (bege, cinza, branco)', 'Preto e branco'], { permiteOutro: true });
  const enc = g('Tipo de encadernação', 'unica', ['Wire-o', 'Disco', 'Costura']);
  const costura = g('Costura', 'unica', ['Exposta', 'Oculta'], { mostrarSe: { grupoId: enc.id, opcaoIds: [idDe(enc, 'Costura')] } });
  const wireo = g('Cor do wire-o', 'unica', CORES_WIREO, { mostrarSe: { grupoId: enc.id, opcaoIds: [idDe(enc, 'Wire-o')] } });
  const disco = g('Cor dos discos', 'unica', CORES_DISCO, { mostrarSe: { grupoId: enc.id, opcaoIds: [idDe(enc, 'Disco')] } });
  const capa = g('Capa', 'unica', ['Brochura', 'Capa dura']);

  // as perguntas de agenda/planner só aparecem quando o produto é agenda ou planner
  const agenda = { grupoId: tipo.id, opcaoIds: [idDe(tipo, 'Agenda'), idDe(tipo, 'Planner')] };
  const ag = (nome: string, t: TipoGrupo, nomes: string[] = [], extra: Partial<GrupoOpcoes> = {}) => g(nome, t, nomes, { mostrarSe: agenda, ...extra });

  return [
    tipo, tamanho, cor, enc, costura, wireo, disco, capa,
    g('Personalização', 'secao'),
    g('Quais cores você mais gosta?', 'multipla', ['Tons neutros (bege, cinza, branco)', 'Tons pastéis', 'Cores vibrantes', 'Preto e branco']),
    g('Você prefere um estilo mais:', 'multipla', ['Minimalista', 'Delicado / fofo', 'Moderno', 'Elegante', 'Divertido / criativo'], { permiteOutro: true }),
    g('Você gosta de estampas ou prefere algo mais liso?', 'unica', ['Liso', 'Estampado', 'Um pouco dos dois']),
    g('Como você prefere definir a arte da capa?', 'unica', [
      'Quero enviar imagens de referência para que a papelaria crie a arte personalizada para mim',
      'Já tenho a arte pronta e enviarei o arquivo final para impressão',
      'Quero escolher entre os modelos pré-prontos disponíveis',
      'Prefiro que a papelaria desenvolva a arte com base nas minhas informações e estilo desejado',
    ]),
    ag('Qual versão você gostaria de escolher?', 'unica', [
      'Essential – capa personalizada + até 115 páginas (miolo simples: pautado, pontilhado ou quadriculado)',
      'Premium – até 190 páginas + até 3 tipos de miolos + capa personalizada',
      'Deluxe – até 220 páginas + até 5 tipos de miolos + capa personalizada',
      'Master – versão completa, altamente personalizada, com mais páginas e miolos exclusivos',
    ]),
    ag('Estrutura da agenda', 'secao'),
    ag('Como você prefere a organização principal da agenda?', 'unica', ['Diário', 'Semanal', 'Mensal', 'Misto (ex.: semanal + diário)']),
    ag('Você prefere a agenda:', 'unica', ['Datada – 1 dia por página (sáb. e dom. em 1 página)', 'Datada – 1 dia por página', 'Datada – 2 dias por página', 'Não datada', 'Indiferente']),
    ag('Qual o período da agenda?', 'unica', ['6 meses', '12 meses'], { permiteOutro: true }),
    ag('Qual formato você prefere?', 'unica', ['Digital', 'Físico', 'Ambos']),
    ag('Você prefere que a agenda esteja na:', 'unica', ['Horizontal', 'Vertical']),
    ag('Conteúdos e Acompanhamentos', 'secao', [], { descricao: 'Escolha até 3 tipos para a versão Premium e 5 para Deluxe e/ou Master.' }),
    ag('Quais acompanhamentos você gostaria de ter na agenda?', 'multipla', [
      'Planejamento financeiro', 'Controle de hábitos', 'Acompanhamento fitness', 'Alimentação / refeições', 'Hobbies', 'Estudos', 'Trabalho', 'Humor / bem-estar', 'Rotina pessoal',
    ], { permiteOutro: true }),
    ag('Você gostaria de espaços para:', 'multipla', ['Anotações livres', 'Metas mensais', 'Metas anuais', 'Checklists', 'Reflexões ou diário'], { permiteOutro: true }),
    ag('Cultura & Lazer', 'secao'),
    ag('Você gostaria de acompanhar:', 'multipla', ['Filmes assistidos', 'Séries', 'Doramas', 'Livros lidos', 'Wishlist (filmes/livros/doramas)', 'Avaliação / notas', 'Citações favoritas'], { permiteOutro: true, obrigatorio: false }),
    ag('Reflexão & Desenvolvimento Pessoal', 'secao'),
    ag('Você gostaria de incluir espaços para:', 'multipla', ['Reflexão semanal', 'Reflexão mensal', 'Diário pessoal', 'Devocional', 'Gratidão', 'Intenções para o mês', 'Autoavaliação (o que funcionou / o que melhorar)'], { permiteOutro: true, obrigatorio: false }),
    g('Algo mais que queira contar?', 'paragrafo', [], { obrigatorio: false }),
  ];
}
