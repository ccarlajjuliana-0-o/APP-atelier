// Como uma imagem de fundo se repete (ladrilho) e se ela tem qualidade para o tamanho pedido.

export type Disposicao = 'grade' | 'diagonal' | 'aleatoria';
export type Medida = 'tamanho' | 'porLinha';

export interface ItemDoLadrilho { x: number; y: number; lado: number; giro: number } // caixa lado×lado; giro em graus
export interface Plano { largura: number; altura: number; colunas: number; itens: ItemDoLadrilho[] }

export const LADO_MINIMO_ENVIO = 256; // px no maior lado: abaixo disso a imagem não serve de fundo
export const LARGURA_RECOMENDADA_UNICA = 1280; // para cobrir a tela inteira sem desfocar
export const AREA_REFERENCIA = { largura: 1400, altura: 900 };

function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Desenho de um ladrilho que, repetido, forma o fundo.
 * grade: alinhadas em linhas e colunas · diagonal: cada linha deslocada meia imagem · aleatoria: espalhadas, levemente giradas
 * (sempre o mesmo "sorteio", para o fundo não mudar a cada abertura).
 */
export function planoDoLadrilho(o: { disposicao: Disposicao; lado: number; espaco: number; semente?: number }): Plano {
  const lado = Math.max(8, Math.round(o.lado));
  const espaco = Math.max(0, Math.round(o.espaco));
  if (o.disposicao === 'diagonal') {
    const c = lado + espaco;
    const m = Math.round(espaco / 2);
    return {
      largura: c, altura: 2 * c, colunas: 1,
      itens: [
        { x: m, y: m, lado, giro: 0 },
        { x: m + Math.round(c / 2), y: c + m, lado, giro: 0 },
        { x: m + Math.round(c / 2) - c, y: c + m, lado, giro: 0 }, // a metade que sai pela direita volta pela esquerda
      ],
    };
  }
  if (o.disposicao === 'aleatoria') {
    const n = 4;
    const c = Math.round(lado * 1.3 + espaco);
    const sorte = sorteador(o.semente ?? 7);
    const itens: ItemDoLadrilho[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const l = Math.round(lado * (0.8 + 0.2 * sorte()));
        const giro = Math.round((sorte() * 2 - 1) * 18);
        const folga = Math.max(0, c / 2 - l * 0.64);
        const cx = j * c + c / 2 + (sorte() * 2 - 1) * folga;
        const cy = i * c + c / 2 + (sorte() * 2 - 1) * folga;
        itens.push({ x: Math.round(cx - l / 2), y: Math.round(cy - l / 2), lado: l, giro });
      }
    }
    return { largura: n * c, altura: n * c, colunas: n, itens };
  }
  const c = lado + espaco;
  return { largura: c, altura: c, colunas: 1, itens: [{ x: Math.round(espaco / 2), y: Math.round(espaco / 2), lado, giro: 0 }] };
}

/** Só a grade sem espaço dispensa montar um ladrilho: a própria imagem já se repete direitinho. */
export const precisaLadrilho = (o: { disposicao: Disposicao; espaco: number }): boolean => o.disposicao !== 'grade' || o.espaco > 0;

/** Lado (px) de cada imagem: o escolhido, ou a largura da área dividida pelas imagens por linha. */
export function ladoEmPx(o: { medida: Medida; tamanho: number; porLinha: number; areaLargura: number }): number {
  if (o.medida === 'tamanho') return o.tamanho;
  return Math.min(600, Math.max(40, Math.round(o.areaLargura / Math.max(1, o.porLinha))));
}

export type NivelQualidade = 'otima' | 'boa' | 'baixa';
export interface Qualidade {
  nivel: NivelQualidade;
  razao: number; // pixels da imagem para cada pixel mostrado (≥ 2 é nítido até em tela de alta resolução; < 1 desfoca)
  larguraMostrada: number;
  maxLado: number; // maior lado de cada imagem repetida sem desfocar
  maxPorcentagem: number; // maior tamanho (%) de uma imagem só sem desfocar
}

export function avaliarQualidade(o: {
  larguraImagem: number; alturaImagem: number; modo: 'unica' | 'repetida'; unico: number; lado: number;
  areaLargura?: number; areaAltura?: number;
}): Qualidade {
  const AL = o.areaLargura ?? AREA_REFERENCIA.largura;
  const AH = o.areaAltura ?? AREA_REFERENCIA.altura;
  const w = Math.max(1, o.larguraImagem);
  const h = Math.max(1, o.alturaImagem);
  const asp = w / h;
  let mostrada: number;
  if (o.modo === 'repetida') mostrada = asp >= 1 ? o.lado : o.lado * asp;
  else if (o.unico >= 100) mostrada = w * Math.max(AL / w, AH / h);
  else mostrada = (AL * o.unico) / 100;
  const razao = w / Math.max(1, mostrada);
  return {
    nivel: razao >= 2 ? 'otima' : razao >= 1 ? 'boa' : 'baixa',
    razao,
    larguraMostrada: Math.round(mostrada),
    maxLado: Math.max(w, h),
    maxPorcentagem: Math.min(100, Math.floor((100 * w) / AL)),
  };
}
