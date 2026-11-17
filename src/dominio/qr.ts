// Gerador de QR code (modo byte, correção M, versões 1 a 10 = até 213 bytes). Feito aqui para não depender de biblioteca.

// por versão (1..10): [codewords de correção por bloco, blocos do grupo 1, dados por bloco do grupo 1, blocos do grupo 2, dados por bloco do grupo 2]
const TABELA_M: [number, number, number, number, number][] = [
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
];
const ALINHAMENTO: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

export const MAX_BYTES_QR = 213;

function bytesUtf8(texto: string): number[] {
  return [...new TextEncoder().encode(texto)];
}

// ---- Reed-Solomon em GF(256) ----
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function geradora(grau: number): number[] {
  let g = [1];
  for (let i = 0; i < grau; i++) {
    const prox = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      prox[j] ^= g[j];
      prox[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = prox;
  }
  return g;
}

function correcao(dados: number[], n: number): number[] {
  const g = geradora(n);
  const resto = new Array<number>(n).fill(0);
  for (const d of dados) {
    const f = d ^ resto[0];
    resto.shift();
    resto.push(0);
    if (f !== 0) for (let i = 0; i < n; i++) resto[i] ^= mul(g[i + 1], f);
  }
  return resto;
}

function bch(valor: number, bitsDados: number, gerador: number, bitsTotal: number): number {
  let v = valor << (bitsTotal - bitsDados);
  const grauG = 31 - Math.clz32(gerador);
  for (let i = bitsTotal - 1; i >= grauG; i--) if ((v >> i) & 1) v ^= gerador << (i - grauG);
  return (valor << (bitsTotal - bitsDados)) | v;
}

function escolherVersao(n: number): number {
  for (let v = 1; v <= 10; v++) {
    const [, b1, d1, b2, d2] = TABELA_M[v - 1];
    const cap = b1 * d1 + b2 * d2;
    const cab = 4 + (v < 10 ? 8 : 16);
    if (cab + n * 8 <= cap * 8) return v;
  }
  throw new Error(`Texto grande demais para o QR (máximo ${MAX_BYTES_QR} bytes).`);
}

function codewords(bytes: number[], v: number): number[] {
  const [ec, b1, d1, b2, d2] = TABELA_M[v - 1];
  const total = b1 * d1 + b2 * d2;
  const bits: number[] = [];
  const poe = (valor: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };
  poe(0b0100, 4);
  poe(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) poe(b, 8);
  poe(0, Math.min(4, total * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; dados.length < total; pad++) dados.push(pad % 2 === 0 ? 0xec : 0x11);

  const blocos: number[][] = [];
  let pos = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const tam = i < b1 ? d1 : d2;
    blocos.push(dados.slice(pos, pos + tam));
    pos += tam;
  }
  const ecs = blocos.map((b) => correcao(b, ec));
  const out: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocos) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

type Matriz = (boolean | null)[][];

function base(v: number): { m: Matriz; reservado: boolean[][] } {
  const n = 17 + 4 * v;
  const m: Matriz = Array.from({ length: n }, () => new Array<boolean | null>(n).fill(null));
  const res: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (r: number, c: number, val: boolean) => { if (r >= 0 && c >= 0 && r < n && c < n) { m[r][c] = val; res[r][c] = true; } };

  const localizador = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const escuro = dentro && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(r0 + r, c0 + c, escuro);
    }
  };
  localizador(0, 0); localizador(0, n - 7); localizador(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALINHAMENTO[v - 1];
  for (const r of al) for (const c of al) {
    if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(4 * v + 9, 8, true); // módulo escuro
  // áreas das informações de formato e de versão (preenchidas depois)
  for (let i = 0; i < 9; i++) { if (!res[8][i]) set(8, i, false); if (!res[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i++) { if (!res[8][n - 1 - i]) set(8, n - 1 - i, false); if (!res[n - 1 - i][8]) set(n - 1 - i, 8, false); }
  set(4 * v + 9, 8, true);
  if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { set(i, n - 11 + j, false); set(n - 11 + j, i, false); }
  return { m, reservado: res };
}

const MASCARAS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (_r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function posicionar(v: number, palavras: number[], mascara: number): boolean[][] {
  const { m, reservado } = base(v);
  const n = m.length;
  const bits: boolean[] = [];
  for (const w of palavras) for (let i = 7; i >= 0; i--) bits.push(((w >> i) & 1) === 1);
  let k = 0;
  let subindo = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) {
      const r = subindo ? n - 1 - i : i;
      for (const cc of [c, c - 1]) {
        if (reservado[r][cc]) continue;
        const bit = k < bits.length ? bits[k] : false;
        k++;
        m[r][cc] = MASCARAS[mascara](r, cc) ? !bit : bit;
      }
    }
    subindo = !subindo;
  }
  // formato (nível M = 00)
  const formato = bch((0b00 << 3) | mascara, 5, 0x537, 15) ^ 0x5412;
  const f = (i: number) => ((formato >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = f(i);
  m[7][8] = f(6); m[8][8] = f(7); m[8][7] = f(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = f(i);
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = f(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = f(i);
  m[n - 8][8] = true;
  if (v >= 7) {
    const info = bch(v, 6, 0x1f25, 18);
    for (let i = 0; i < 18; i++) {
      const bit = ((info >> i) & 1) === 1;
      m[Math.floor(i / 3)][n - 11 + (i % 3)] = bit;
      m[n - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }
  return m.map((l) => l.map((x) => x === true));
}

function penalidade(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  for (let dir = 0; dir < 2; dir++) {
    for (let a = 0; a < n; a++) {
      let seq = 1;
      for (let b = 1; b < n; b++) {
        const x = dir ? m[b][a] : m[a][b];
        const y = dir ? m[b - 1][a] : m[a][b - 1];
        if (x === y) { seq++; if (seq === 5) p += 3; else if (seq > 5) p++; } else seq = 1;
      }
      const linha = Array.from({ length: n }, (_, b) => (dir ? m[b][a] : m[a][b]));
      const s = linha.map((x) => (x ? '1' : '0')).join('');
      for (let i = 0; i + 11 <= n; i++) {
        const t = s.slice(i, i + 11);
        if (t === '10111010000' || t === '00001011101') p += 40;
      }
    }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const x = m[r][c];
    if (x === m[r][c + 1] && x === m[r + 1][c] && x === m[r + 1][c + 1]) p += 3;
  }
  const escuros = m.reduce((s, l) => s + l.filter(Boolean).length, 0);
  p += Math.floor(Math.abs((escuros * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

/** Matriz do QR (true = módulo escuro). */
export function qrMatriz(texto: string): boolean[][] {
  const bytes = bytesUtf8(texto);
  const v = escolherVersao(bytes.length);
  const palavras = codewords(bytes, v);
  let melhor: boolean[][] | null = null;
  let menor = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = posicionar(v, palavras, mask);
    const p = penalidade(m);
    if (p < menor) { menor = p; melhor = m; }
  }
  return melhor!;
}

/** QR em SVG, com a margem de 4 módulos que os leitores esperam. */
export function qrSvg(texto: string, opc: { modulo?: number; escuro?: string; claro?: string } = {}): string {
  const m = qrMatriz(texto);
  const mod = opc.modulo ?? 8;
  const margem = 4;
  const tam = (m.length + margem * 2) * mod;
  const escuro = opc.escuro ?? '#3E3550';
  const claro = opc.claro ?? '#FFFFFF';
  let d = '';
  for (let r = 0; r < m.length; r++) {
    let c = 0;
    while (c < m.length) {
      if (!m[r][c]) { c++; continue; }
      let fim = c;
      while (fim < m.length && m[r][fim]) fim++;
      d += `M${(c + margem) * mod} ${(r + margem) * mod}h${(fim - c) * mod}v${mod}h${-(fim - c) * mod}z`;
      c = fim;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tam} ${tam}" width="${tam}" height="${tam}" role="img" aria-label="QR code"><rect width="${tam}" height="${tam}" fill="${claro}"/><path d="${d}" fill="${escuro}"/></svg>`;
}
