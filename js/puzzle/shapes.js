export const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [2, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0]],
];

export const COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#C0392B',
];

export function shapeBounds(cells) {
  let maxX = 0;
  let maxY = 0;
  cells.forEach(([x, y]) => {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  return { w: maxX + 1, h: maxY + 1 };
}

export function cellsAt(cells, gx, gy) {
  return cells.map(([x, y]) => [gx + x, gy + y]);
}

export function fitsGrid(grid, cells, gx, gy) {
  for (const [x, y] of cellsAt(cells, gx, gy)) {
    if (x < 0 || x >= 10 || y < 0 || y >= 10) return false;
    if (grid[y][x] !== null) return false;
  }
  return true;
}

export function paintGrid(grid, cells, gx, gy, color) {
  cellsAt(cells, gx, gy).forEach(([x, y]) => {
    grid[y][x] = color;
  });
}

export function validateSolutionVisibility(pieces) {
  const solution = pieces.filter((p) => p.isCorrect !== false && (
    p.solutionX != null || p.gridX != null || p.gx != null
  ));
  if (!solution.length) return true;
  for (const p of solution) {
    const gx = p.gridX ?? p.solutionX ?? p.gx;
    const gy = p.gridY ?? p.solutionY ?? p.gy;
    const z = p.z ?? p.solutionZ;
    let visible = false;
    for (const [dx, dy] of p.cells) {
      const x = gx + dx;
      const y = gy + dy;
      let topZ = -1;
      for (const q of solution) {
        const qgx = q.gridX ?? q.solutionX ?? q.gx;
        const qgy = q.gridY ?? q.solutionY ?? q.gy;
        const qz = q.z ?? q.solutionZ;
        for (const [qdx, qdy] of q.cells) {
          if (qgx + qdx === x && qgy + qdy === y && qz > topZ) topZ = qz;
        }
      }
      if (z === topZ) visible = true;
    }
    if (!visible) return false;
  }
  return true;
}
