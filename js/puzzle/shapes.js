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
