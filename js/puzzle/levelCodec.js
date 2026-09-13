import { SHAPES, COLORS, cellsAt, validateSolutionVisibility } from './shapes';
import { createRng, shuffle } from './rng';

const GRID = 10;

function shapeIdx(cells) {
  const k = JSON.stringify(cells);
  const i = SHAPES.findIndex((s) => JSON.stringify(s) === k);
  return i >= 0 ? i : 0;
}

function colorIdx(color) {
  const i = COLORS.indexOf(color);
  return i >= 0 ? i : 0;
}

function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) bytes.push(192 | (c >> 6), 128 | (c & 63));
    else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  return bytes;
}

function bytesToUtf8(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 128) out += String.fromCharCode(b);
    else if (b < 224) out += String.fromCharCode(((b & 31) << 6) | (bytes[++i] & 63));
    else out += String.fromCharCode(((b & 15) << 12) | ((bytes[++i] & 63) << 6) | (bytes[++i] & 63));
  }
  return out;
}

function toBase64Url(str) {
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = utf8ToBytes(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += b64[(n >> 18) & 63] + b64[(n >> 12) & 63]
      + (i + 1 < bytes.length ? b64[(n >> 6) & 63] : '')
      + (i + 2 < bytes.length ? b64[n & 63] : '');
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const n = (b64.indexOf(str[i]) << 18) | (b64.indexOf(str[i + 1]) << 12)
      | (b64.indexOf(str[i + 2]) << 6) | b64.indexOf(str[i + 3]);
    bytes.push((n >> 16) & 255);
    if (str[i + 2] !== '=') bytes.push((n >> 8) & 255);
    if (str[i + 3] !== '=') bytes.push(n & 255);
  }
  return bytesToUtf8(bytes);
}

function buildAnswer(pieces) {
  const answer = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  const zGrid = Array.from({ length: GRID }, () => Array(GRID).fill(-1));
  pieces.filter((p) => p.isCorrect).sort((a, b) => a.solutionZ - b.solutionZ).forEach((p) => {
    cellsAt(p.cells, p.solutionX, p.solutionY).forEach(([x, y]) => {
      if (p.solutionZ >= zGrid[y][x]) {
        answer[y][x] = p.color;
        zGrid[y][x] = p.solutionZ;
      }
    });
  });
  return answer;
}

export function encodeShareLevel(data) {
  const c = [];
  const d = [];
  data.pieces.forEach((p) => {
    const si = shapeIdx(p.cells);
    const ci = colorIdx(p.color);
    if (p.isCorrect) c.push([si, ci, p.solutionX, p.solutionY, p.solutionZ]);
    else d.push([si, ci]);
  });
  return toBase64Url(JSON.stringify({ c, d }));
}

export function decodeShareLevel(code) {
  try {
    const raw = decodeURIComponent(String(code));
    const { c, d } = JSON.parse(fromBase64Url(raw));
    if (!c || !c.length) return null;
    const pieces = [];
    c.forEach(([si, ci, gx, gy, z]) => {
      pieces.push({
        cells: SHAPES[si].map((x) => [...x]),
        color: COLORS[ci],
        isCorrect: true,
        solutionX: gx,
        solutionY: gy,
        solutionZ: z,
      });
    });
    (d || []).forEach(([si, ci]) => {
      pieces.push({
        cells: SHAPES[si].map((x) => [...x]),
        color: COLORS[ci],
        isCorrect: false,
      });
    });
    const rng = createRng(12345);
    shuffle(rng, pieces);
    const mapped = pieces.map((p, i) => ({
      id: i,
      cells: p.cells,
      color: p.color,
      placed: false,
      gridX: 0,
      gridY: 0,
      z: 0,
      isCorrect: p.isCorrect,
      solutionX: p.solutionX,
      solutionY: p.solutionY,
      solutionZ: p.solutionZ,
    }));
    if (!validateSolutionVisibility(mapped)) return null;
    return { answer: buildAnswer(mapped), pieces: mapped, custom: true, shared: true };
  } catch (e) {
    return null;
  }
}
