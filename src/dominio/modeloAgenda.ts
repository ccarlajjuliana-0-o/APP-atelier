// Modelo pronto do formulário "Agenda personalizada" (baseado no questionário que já era usado com as clientes).
import type { GrupoOpcoes, OpcaoProduto, TipoGrupo } from './opcoes.ts';

type NovoId = () => string;

export function modeloAgenda(id: NovoId): GrupoOpcoes[] {
  const o = (nome: string): OpcaoProduto => ({ id: id(), nome, materialId: null, quantidade: 0, desperdicioPct: 0, acrescimoCentavos: null, padrao: false });
  const g = (nome: string, tipo: TipoGrupo, opcoes: string[] = [], extra: Partial<GrupoOpcoes> = {}): GrupoOpcoes => ({
    id: id(), nome, tipo, obrigatorio: tipo !== 'secao', opcoes: opcoes.map(o), ...extra,
  });
  return [
    g('E-mail', 'email'),
    g('Cores & Estilo Visual', 'secao'),
    g('Quais cores você mais gosta?', 'multipla', ['Tons neutros (bege, cinza, branco)', 'Tons pastéis', 'Cores vibrantes', 'Preto e branco']),
    g('Você prefere um estilo mais:', 'multipla', ['Minimalista', 'Delicado / fofo', 'Moderno', 'Elegante', 'Divertido / criativo'], { permiteOutro: true }),
    g('Você gosta de estampas ou prefere algo mais liso?', 'unica', ['Liso', 'Estampado', 'Um pouco dos dois']),
    g('Como você prefere definir a arte da capa?', 'unica', [
      'Quero enviar imagens de referência para que a papelaria crie a arte personalizada para mim',
      'Já tenho a arte pronta e enviarei o arquivo final para impressão',
      'Quero escolher entre os modelos pré-prontos disponíveis',
      'Prefiro que a papelaria desenvolva a arte com base nas minhas informações e estilo desejado',
    ]),
    g('Estilo de encadernação', 'unica', ['Wire-o (garra metal duplo anel)', 'Caderno de Disco (folhas reposicionáveis)']),
    g('Qual versão você gostaria de escolher?', 'unica', [
      'Essential – capa personalizada + até 115 páginas (miolo simples: pautado, pontilhado ou quadriculado)',
      'Premium – até 190 páginas + até 3 tipos de miolos + capa personalizada',
      'Deluxe – até 220 páginas + até 5 tipos de miolos + capa personalizada',
      'Master – versão completa, altamente personalizada, com mais páginas e miolos exclusivos',
    ]),
    g('Estrutura da Agenda', 'secao'),
    g('Como você prefere a organização principal da agenda?', 'unica', ['Diário', 'Semanal', 'Mensal', 'Misto (ex.: semanal + diário)']),
    g('Você prefere a agenda:', 'unica', ['Datada – 1 dia por página (sáb. e dom. em 1 página)', 'Datada – 1 dia por página', 'Datada – 2 dias por página', 'Não datada', 'Indiferente']),
    g('Qual o período da agenda?', 'unica', ['6 meses', '12 meses'], { permiteOutro: true }),
    g('Qual formato você prefere?', 'unica', ['Digital', 'Físico', 'Ambos']),
    g('Você prefere que a agenda esteja na:', 'unica', ['Horizontal', 'Vertical']),
    g('Conteúdos e Acompanhamentos', 'secao', [], { descricao: 'Escolha até 3 tipos para a versão Premium e 5 para Deluxe e/ou Master.' }),
    g('Quais acompanhamentos você gostaria de ter na agenda?', 'multipla', [
      'Planejamento financeiro', 'Controle de hábitos', 'Acompanhamento fitness', 'Alimentação / refeições', 'Hobbies', 'Estudos', 'Trabalho', 'Humor / bem-estar', 'Rotina pessoal',
    ], { permiteOutro: true }),
    g('Você gostaria de espaços para:', 'multipla', ['Anotações livres', 'Metas mensais', 'Metas anuais', 'Checklists', 'Reflexões ou diário'], { permiteOutro: true }),
    g('Cultura & Lazer', 'secao'),
    g('Você gostaria de acompanhar:', 'multipla', ['Filmes assistidos', 'Séries', 'Doramas', 'Livros lidos', 'Wishlist (filmes/livros/doramas)', 'Avaliação / notas', 'Citações favoritas'], { permiteOutro: true, obrigatorio: false }),
    g('Reflexão & Desenvolvimento Pessoal', 'secao'),
    g('Você gostaria de incluir espaços para:', 'multipla', ['Reflexão semanal', 'Reflexão mensal', 'Diário pessoal', 'Devocional', 'Gratidão', 'Intenções para o mês', 'Autoavaliação (o que funcionou / o que melhorar)'], { permiteOutro: true, obrigatorio: false }),
    g('Algo mais que queira contar?', 'paragrafo', [], { obrigatorio: false }),
  ];
}
