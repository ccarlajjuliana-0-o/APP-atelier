// Perguntas que já vêm no orçamento personalizado: o básico do produto e, depois, as de personalização (do questionário da agenda).
import type { Condicao, GrupoOpcoes, OpcaoProduto, TipoGrupo } from './opcoes.ts';

type NovoId = () => string;

export const CORES_WIREO = ['Preto', 'Branco', 'Prata', 'Dourado', 'Rosê', 'Rosa', 'Lilás', 'Roxo', 'Azul', 'Verde', 'Vermelho'];
export const CORES_DISCO = ['Preto', 'Branco', 'Prata', 'Dourado', 'Rosa', 'Lilás', 'Roxo', 'Azul', 'Transparente'];

/** Sobe quando as perguntas padrão mudam: quem nunca editou o formulário recebe a versão nova. */
export const VERSAO_FORMULARIO = 2;

export function formularioPadrao(id: NovoId): GrupoOpcoes[] {
  const o = (nome: string): OpcaoProduto => ({ id: id(), nome, materialId: null, quantidade: 0, desperdicioPct: 0, acrescimoCentavos: null, padrao: false });
  const g = (nome: string, tipo: TipoGrupo, nomes: string[] = [], extra: Partial<GrupoOpcoes> = {}): GrupoOpcoes => ({
    id: id(), nome, tipo, obrigatorio: tipo !== 'secao', opcoes: nomes.map(o), ...extra,
  });
  const idDe = (gr: GrupoOpcoes, inicio: string) => gr.opcoes.find((x) => x.nome.startsWith(inicio))!.id;
  const se = (gr: GrupoOpcoes, ...inicios: string[]): Condicao => ({ grupoId: gr.id, opcaoIds: inicios.map((n) => idDe(gr, n)) });

  const tipo = g('Caderno, agenda ou planner?', 'unica', ['Caderno', 'Agenda', 'Planner']);
  const tamanho = g('Tamanho', 'unica', ['A4', 'A5', 'A6'], { permiteOutro: true });
  const cor = g('Cor', 'unica', ['Azul', 'Roxo', 'Rosa', 'Lilás', 'Verde', 'Neutras (bege, cinza, branco)', 'Preto e branco'], { permiteOutro: true });
  const enc = g('Tipo de encadernação', 'unica', ['Wire-o', 'Disco', 'Costura']);
  const costura = g('Costura', 'unica', ['Exposta', 'Oculta'], { mostrarSe: se(enc, 'Costura') });
  const wireo = g('Cor do wire-o', 'unica', CORES_WIREO, { mostrarSe: se(enc, 'Wire-o') });
  const disco = g('Cor dos discos', 'unica', CORES_DISCO, { mostrarSe: se(enc, 'Disco') });
  const capa = g('Capa', 'unica', ['Brochura', 'Capa dura']);

  // versões: caderno e agenda têm uma lista; planner tem o Essential com outro texto
  const versaoGeral = g('Qual versão você gostaria de escolher?', 'unica', [
    'Essential – até 115 páginas', 'Premium – até 190 páginas', 'Deluxe – até 220 páginas', 'Master – maior número de páginas',
  ], { mostrarSe: se(tipo, 'Caderno', 'Agenda') });
  const versaoPlanner = g('Qual versão você gostaria de escolher?', 'unica', [
    'Essential – até 115 páginas (opção datada, não datada + opção miolo de anotações ou check list)', 'Premium – até 190 páginas', 'Deluxe – até 220 páginas', 'Master – maior número de páginas',
  ], { mostrarSe: se(tipo, 'Planner') });
  const quando = (...v: string[]): Condicao[] => [se(versaoGeral, ...v), se(versaoPlanner, ...v)];

  const agenda = [se(tipo, 'Agenda', 'Planner')];
  const ag = (nome: string, t: TipoGrupo, nomes: string[] = [], extra: Partial<GrupoOpcoes> = {}) => g(nome, t, nomes, { mostrarSe: agenda, ...extra });
  const datada = ag('Você prefere a agenda:', 'unica', ['Datada', 'Não datada']);
  const datadaComo = g('Datada: como você prefere?', 'unica', ['1 dia por página (sáb. e dom. em 1 página)', '1 dia por página', '2 dias por página'], { mostrarSe: se(datada, 'Datada') });

  return [
    tipo, tamanho, cor, enc, costura, wireo, disco, capa,
    g('Personalização', 'secao'),
    g('Como você prefere definir a arte da capa?', 'unica', [
      'Quero enviar imagens de referência para que a papelaria crie a arte personalizada para mim',
      'Já tenho a arte pronta e enviarei o arquivo final para impressão',
      'Quero escolher entre os modelos pré-prontos disponíveis',
      'Prefiro que a papelaria desenvolva a arte com base nas minhas informações e estilo desejado',
    ]),
    g('Quais cores você mais gosta?', 'unica', ['Tons neutros (bege, cinza, branco)', 'Tons pastéis', 'Cores vibrantes', 'Preto e branco']),
    g('Você prefere um estilo mais:', 'unica', ['Minimalista', 'Delicado / fofo', 'Moderno', 'Elegante', 'Divertido / criativo'], { permiteOutro: true }),
    g('Tipo de bordas do miolo', 'unica', ['Com estampas', 'Cor lisa / sólida', 'Sem borda']),
    versaoGeral, versaoPlanner,
    ag('Estrutura da agenda', 'secao'),
    ag('Como você prefere a organização principal da agenda?', 'unica', ['Diário', 'Semanal', 'Mensal', 'Misto (ex.: semanal + diário)']),
    datada, datadaComo,
    ag('Qual o período da agenda?', 'unica', ['6 meses', '12 meses'], { permiteOutro: true }),
    ag('Qual formato você prefere?', 'unica', ['Digital', 'Físico', 'Ambos']),
    ag('Você prefere que a agenda esteja na:', 'unica', ['Horizontal', 'Vertical']),
    g('Conteúdos e Acompanhamentos', 'secao', [], { mostrarSe: quando('Premium', 'Deluxe', 'Master') }),
    g('Quais acompanhamentos você gostaria de ter? (até 3 na versão Premium)', 'multipla', [
      'Planejamento financeiro', 'Controle de hábitos', 'Acompanhamento fitness', 'Alimentação / refeições', 'Hobbies', 'Estudos', 'Trabalho', 'Humor / bem-estar', 'Rotina pessoal',
    ], { permiteOutro: true, maxSelecao: 3, mostrarSe: quando('Premium') }),
    g('Quais acompanhamentos você gostaria de ter? (até 5 nas versões Deluxe e Master)', 'multipla', [
      'Planejamento financeiro', 'Controle de hábitos', 'Acompanhamento fitness', 'Alimentação / refeições', 'Hobbies', 'Estudos', 'Trabalho', 'Humor / bem-estar', 'Rotina pessoal',
    ], { permiteOutro: true, maxSelecao: 5, mostrarSe: quando('Deluxe', 'Master') }),
    g('Você gostaria de acompanhar:', 'multipla', ['Filmes assistidos', 'Séries', 'Doramas', 'Livros lidos', 'Wishlist (filmes/livros/doramas)', 'Avaliação / notas', 'Citações favoritas'], { permiteOutro: true, obrigatorio: false, mostrarSe: agenda }),
    g('Você gostaria de espaços para:', 'multipla', ['Anotações livres', 'Metas mensais', 'Metas anuais', 'Checklists', 'Reflexões ou diário'], { permiteOutro: true, obrigatorio: false }),
    g('Você gostaria de incluir espaços para:', 'multipla', ['Reflexão semanal', 'Reflexão mensal', 'Diário pessoal', 'Devocional', 'Gratidão', 'Intenções para o mês', 'Autoavaliação (o que funcionou / o que melhorar)'], { permiteOutro: true, obrigatorio: false }),
    g('Algo mais que queira contar?', 'paragrafo', [], { obrigatorio: false }),
  ];
}
