import { escalaMax } from '../dominio/imagem.ts';

/** Reduz a foto (maior lado 900 px, JPEG) para caber bem no armazenamento do aparelho. */
export async function reduzirImagem(arquivo: File, max = 900): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
  const bmp = await createImageBitmap(arquivo);
  const { w, h } = escalaMax(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não consegui processar a foto.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui processar a foto.'))), 'image/jpeg', 0.82),
  );
}

/** Tamanho (largura e altura) de uma imagem guardada. */
export async function medirImagem(imagem: Blob): Promise<{ largura: number; altura: number }> {
  const bmp = await createImageBitmap(imagem);
  const r = { largura: bmp.width, altura: bmp.height };
  bmp.close();
  return r;
}

/**
 * Imagem de fundo de tema: guarda a transparência (PNG/WebP/GIF viram PNG; o resto vira JPEG), até `max` px no maior lado.
 * Recusa imagens muito pequenas, que ficariam desfocadas (`minimo` px no maior lado).
 */
export async function prepararFundo(arquivo: File, minimo: number, max = 1920): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
  const bmp = await createImageBitmap(arquivo);
  const maior = Math.max(bmp.width, bmp.height);
  if (maior < minimo) {
    bmp.close();
    throw new Error(`Essa imagem é pequena demais (${bmp.width}×${bmp.height} px) e ficaria desfocada. Use uma com pelo menos ${minimo} px no maior lado.`);
  }
  const comAlfa = /png|webp|gif/.test(arquivo.type);
  const tentativas = comAlfa ? [max, 1400, 1000] : [max];
  for (const lado of tentativas) {
    const { w, h } = escalaMax(bmp.width, bmp.height, lado);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não consegui processar a imagem.');
    if (!comAlfa) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, comAlfa ? 'image/png' : 'image/jpeg', 0.88));
    if (blob && (blob.size <= 2_500_000 || lado === tentativas[tentativas.length - 1])) {
      bmp.close();
      return blob;
    }
  }
  bmp.close();
  throw new Error('Não consegui processar a imagem.');
}

/** Logo: mantém o fundo transparente (PNG), no máximo `max` px no maior lado. SVG é guardado como está (até 500 KB). */
export async function prepararLogo(arquivo: File, max = 512): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (PNG, JPG ou SVG).');
  if (arquivo.type === 'image/svg+xml') {
    if (arquivo.size > 500_000) throw new Error('Esse SVG é muito grande (limite de 500 KB). Use um PNG.');
    return new Blob([await arquivo.arrayBuffer()], { type: 'image/svg+xml' });
  }
  const bmp = await createImageBitmap(arquivo);
  const { w, h } = escalaMax(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não consegui processar a imagem.');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não consegui processar a imagem.'))), 'image/png'));
}
