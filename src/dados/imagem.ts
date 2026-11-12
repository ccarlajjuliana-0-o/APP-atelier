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
