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
