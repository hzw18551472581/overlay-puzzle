import { createRng, randInt, shuffle } from './rng';
import { SHAPES, COLORS, cellsAt, validateSolutionVisibility } from './shapes';

const GRID = 10;
const TOTAL_LEVELS = 20;

function pickColor(rng) {
  return COLORS[randInt(rng, 0, COLORS.length - 1)];
}

function pickShape(rng) {
  return SHAPES[randInt(rng, 0, SHAPES.length - 1)].map((c) => [...c]);
}

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function randomPos(rng, cells) {
  let maxX = 0;
  let maxY = 0;
  cells.forEach(([x, y]) => {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  return {
    gx: randInt(rng, 0, Math.max(0, GRID - 1 - maxX)),
    gy: randInt(rng, 0, Math.max(0, GRID - 1 - maxY)),
  };
}

function stackPiece(answer, zGrid, cells, gx, gy, color, z) {
  cellsAt(cells, gx, gy).forEach(([x, y]) => {
    if (zGrid[y][x] === undefined || z >= zGrid[y][x]) {
      answer[y][x] = color;
      zGrid[y][x] = z;
    }
  });
}

export function pieceCountForLevel(level) {
  return 20 + Math.floor(((level - 1) * 10) / (TOTAL_LEVELS - 1));
}

function buildLevel(rng, level) {
  const total = pieceCountForLevel(level);
  const correctCount = Math.max(1, Math.round(total * 0.55));
  const answer = emptyGrid();
  const zGrid = Array.from({ length: GRID }, () => Array(GRID).fill(-1));
  const solution = [];

  for (let i = 0; i < correctCount; i++) {
    const cells = pickShape(rng);
    const { gx, gy } = randomPos(rng, cells);
    const color = pickColor(rng);
    stackPiece(answer, zGrid, cells, gx, gy, color, i);
    solution.push({ cells, color, gx, gy, z: i });
  }

  if (!validateSolutionVisibility(solution)) return null;

  const pieces = solution.map((s, idx) => ({
    id: idx,
    cells: s.cells,
    color: s.color,
    placed: false,
    gridX: 0,
    gridY: 0,
    z: 0,
    isCorrect: true,
    solutionX: s.gx,
    solutionY: s.gy,
    solutionZ: s.z,
  }));

  for (let i = correctCount; i < total; i++) {
    pieces.push({
      id: i,
      cells: pickShape(rng),
      color: pickColor(rng),
      placed: false,
      gridX: 0,
      gridY: 0,
      z: 0,
      isCorrect: false,
    });
  }

  shuffle(rng, pieces);
  pieces.forEach((p, i) => {
    p.id = i;
  });

  return { level, answer, pieces, solution };
}

export function generateLevel(level) {
  const baseSeed = level * 7919 + 104729;
  for (let attempt = 0; attempt < 80; attempt++) {
    const rng = createRng(baseSeed + attempt * 9973);
    const result = buildLevel(rng, level);
    if (result) return result;
  }
  const rng = createRng(baseSeed);
  const total = pieceCountForLevel(level);
  const answer = emptyGrid();
  const cells = SHAPES[0].map((c) => [...c]);
  const color = COLORS[0];
  stackPiece(answer, Array.from({ length: GRID }, () => Array(GRID).fill(-1)), cells, 4, 4, color, 0);
  const solution = [{ cells, color, gx: 4, gy: 4, z: 0 }];
  const pieces = solution.map((s, idx) => ({
    id: idx,
    cells: s.cells,
    color: s.color,
    placed: false,
    gridX: 0,
    gridY: 0,
    z: 0,
    isCorrect: true,
    solutionX: s.gx,
    solutionY: s.gy,
    solutionZ: s.z,
  }));
  for (let i = 1; i < total; i++) {
    pieces.push({
      id: i,
      cells: pickShape(rng),
      color: pickColor(rng),
      placed: false,
      gridX: 0,
      gridY: 0,
      z: 0,
      isCorrect: false,
    });
  }
  shuffle(rng, pieces);
  pieces.forEach((p, i) => { p.id = i; });
  return { level, answer, pieces, solution };
}

export { TOTAL_LEVELS, GRID };
