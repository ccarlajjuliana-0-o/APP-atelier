import type { Plano } from '../../dominio/ladrilho.ts';

/** Monta, em uma imagem só, o arranjo de repetição (espaço, diagonal ou espalhado) para o fundo se repetir sem emendas. */
export async function desenharLadrilho(imagem: Blob, plano: Plano): Promise<Blob> {
  const bmp = await createImageBitmap(imagem);
  const densidade = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const escala = Math.min(densidade, 4096 / Math.max(plano.largura, plano.altura));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(plano.largura * escala));
  canvas.height = Math.max(1, Math.round(plano.altura * escala));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bmp.close();
    throw new Error('Não consegui montar o fundo.');
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(escala, escala);
  const proporcao = bmp.width / bmp.height;
  for (const i of plano.itens) {
    const w = proporcao >= 1 ? i.lado : i.lado * proporcao;
    const h = proporcao >= 1 ? i.lado / proporcao : i.lado;
    ctx.save();
    ctx.translate(i.x + i.lado / 2, i.y + i.lado / 2);
    ctx.rotate((i.giro * Math.PI) / 180);
    ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  bmp.close();
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui montar o fundo.'))), 'image/png'));
}
