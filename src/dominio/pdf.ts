// Gerador de PDF simples e sem dependências: linhas, retângulos, pontos e texto com as fontes padrão (Helvetica e Times).
import { LARGURAS } from './pdfLarguras.ts';
import type { Elemento, FonteMiolo, PaginaMiolo } from './miolo.ts';

const PT = 72 / 25.4; // mm → pt
const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

function cor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '0 0 0';
  const v = parseInt(m[1], 16);
  return `${n(((v >> 16) & 255) / 255)} ${n(((v >> 8) & 255) / 255)} ${n((v & 255) / 255)}`;
}

const CP1252: Record<number, number> = { 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2026: 0x85, 0x20ac: 0x80 };

/** Texto em "string binária" (um caractere = um byte WinAnsi). Caracteres fora do alfabeto latino viram "?". */
function winAnsi(t: string): string {
  let o = '';
  for (const ch of t.normalize('NFC')) {
    const c = ch.codePointAt(0)!;
    if (c >= 32 && c <= 126) o += ch;
    else if (c >= 0xa0 && c <= 0xff) o += ch;
    else if (CP1252[c]) o += String.fromCharCode(CP1252[c]);
    else o += '?';
  }
  return o;
}
const escapar = (t: string) => t.replace(/[\\()]/g, (c) => '\\' + c);

function chaveFonte(f: FonteMiolo, negrito?: boolean): 'sans' | 'sansNegrito' | 'serif' | 'serifNegrito' {
  return (f === 'serif' ? (negrito ? 'serifNegrito' : 'serif') : negrito ? 'sansNegrito' : 'sans');
}
const NOMES_FONTE = { sans: 'Helvetica', sansNegrito: 'Helvetica-Bold', serif: 'Times-Roman', serifNegrito: 'Times-Bold' } as const;
const REF_FONTE = { sans: 'F1', sansNegrito: 'F2', serif: 'F3', serifNegrito: 'F4' } as const;

/** Largura do texto em pontos. */
export function larguraTexto(texto: string, tamPt: number, f: FonteMiolo, negrito?: boolean): number {
  const tab = LARGURAS[chaveFonte(f, negrito)];
  let soma = 0;
  for (const ch of winAnsi(texto)) {
    let c = ch.charCodeAt(0);
    if (c > 126) {
      const base = ch.normalize('NFD').charCodeAt(0); // sem o acento
      c = base >= 32 && base <= 126 ? base : 63;
    }
    soma += tab[c - 32] ?? 500;
  }
  return (soma * tamPt) / 1000;
}

function circulo(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return `${n(cx + r)} ${n(cy)} m ${n(cx + r)} ${n(cy + k)} ${n(cx + k)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c ` +
    `${n(cx - k)} ${n(cy + r)} ${n(cx - r)} ${n(cy + k)} ${n(cx - r)} ${n(cy)} c ` +
    `${n(cx - r)} ${n(cy - k)} ${n(cx - k)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c ` +
    `${n(cx + k)} ${n(cy - r)} ${n(cx + r)} ${n(cy - k)} ${n(cx + r)} ${n(cy)} c f\n`;
}

function conteudo(pg: PaginaMiolo): string {
  const Hpt = pg.alturaMm * PT;
  const X = (x: number) => x * PT;
  const Y = (y: number) => Hpt - y * PT;
  let s = '1 J 1 j\n';
  for (const e of pg.itens as Elemento[]) {
    if (e.t === 'linha') {
      s += `${cor(e.cor)} RG ${n(e.esp * PT)} w ${n(X(e.x1))} ${n(Y(e.y1))} m ${n(X(e.x2))} ${n(Y(e.y2))} l S\n`;
    } else if (e.t === 'ret') {
      if (e.preenche) s += `${cor(e.preenche)} rg `;
      s += `${cor(e.cor)} RG ${n(e.esp * PT)} w ${n(X(e.x))} ${n(Y(e.y + e.h))} ${n(e.w * PT)} ${n(e.h * PT)} re ${e.preenche ? 'B' : 'S'}\n`;
    } else if (e.t === 'ponto') {
      s += `${cor(e.cor)} rg ` + circulo(X(e.x), Y(e.y), (e.d / 2) * PT);
    } else if (e.texto) {
      const w = larguraTexto(e.texto, e.tam, e.fonte, e.negrito);
      const x = X(e.x) - (e.alinhar === 'c' ? w / 2 : e.alinhar === 'd' ? w : 0);
      s += `BT ${cor(e.cor)} rg /${REF_FONTE[chaveFonte(e.fonte, e.negrito)]} ${n(e.tam)} Tf ${n(x)} ${n(Y(e.y))} Td (${escapar(winAnsi(e.texto))}) Tj ET\n`;
    }
  }
  return s;
}

function bytes(s: string): Uint8Array {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255;
  return u;
}

/** PDF com uma página para cada PaginaMiolo (cada uma pode ter tamanho próprio). */
export function gerarPdf(paginas: PaginaMiolo[], titulo = 'Miolo'): Uint8Array {
  const objs: string[] = []; // objs[i] = corpo do objeto i+1
  const add = (corpo: string) => { objs.push(corpo); return objs.length; };
  const catalogo = add('');
  const arvore = add('');
  const fontes = (Object.keys(NOMES_FONTE) as (keyof typeof NOMES_FONTE)[]).map((k) =>
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${NOMES_FONTE[k]} /Encoding /WinAnsiEncoding >>`));
  const info = add(`<< /Title (${escapar(winAnsi(titulo))}) /Producer (Craft Notes Unique) >>`);
  const filhas: number[] = [];
  for (const pg of paginas) {
    const c = conteudo(pg);
    const idC = add(`<< /Length ${c.length} >>\nstream\n${c}endstream`);
    const idP = add(
      `<< /Type /Page /Parent ${arvore} 0 R /MediaBox [0 0 ${n(pg.larguraMm * PT)} ${n(pg.alturaMm * PT)}] ` +
      `/Resources << /Font << /F1 ${fontes[0]} 0 R /F2 ${fontes[1]} 0 R /F3 ${fontes[2]} 0 R /F4 ${fontes[3]} 0 R >> >> /Contents ${idC} 0 R >>`);
    filhas.push(idP);
  }
  objs[catalogo - 1] = `<< /Type /Catalog /Pages ${arvore} 0 R >>`;
  objs[arvore - 1] = `<< /Type /Pages /Count ${filhas.length} /Kids [${filhas.map((i) => `${i} 0 R`).join(' ')}] >>`;

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const pos: number[] = [];
  objs.forEach((corpo, i) => {
    pos.push(out.length);
    out += `${i + 1} 0 obj\n${corpo}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const p of pos) out += `${String(p).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogo} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return bytes(out);
}
