import { SCREEN_WIDTH, SCREEN_HEIGHT, PIXEL_RATIO } from '../render';
import { SHAPES, COLORS, cellsAt, shapeBounds, validateSolutionVisibility } from './shapes';
import { getSafeArea } from './layout';
import { encodeShareLevel } from './levelCodec';
import { C, roundRect, drawAtmosphere, drawBtn, drawCard, drawSoftPanel } from './ui';

const CUSTOM_KEY = 'stackpuzzle_custom';
const GRID = 10;

function emptyGrid() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function stackPiece(answer, zGrid, cells, gx, gy, color, z) {
  cellsAt(cells, gx, gy).forEach(([x, y]) => {
    if (zGrid[y][x] === undefined || z >= zGrid[y][x]) {
      answer[y][x] = color;
      zGrid[y][x] = z;
    }
  });
}

export default class LevelEditor {
  solutionPieces = [];
  decoyPieces = [];
  shapeIdx = 0;
  colorIdx = 0;
  selectedId = null;
  modal = null;
  savedList = [];

  constructor(engine) {
    this.engine = engine;
    this.savedList = wx.getStorageSync(CUSTOM_KEY) || [];
  }

  open() {
    this.engine.screen = 'editor';
    this.solutionPieces = [];
    this.decoyPieces = [];
    this.selectedId = null;
    this.modal = null;
  }

  close() {
    this.engine.screen = 'menu';
  }

  allPieces() {
    return [...this.solutionPieces, ...this.decoyPieces];
  }

  getPiece(id) {
    return this.allPieces().find((p) => p.id === id);
  }

  recomputeAnswer() {
    const answer = emptyGrid();
    const zGrid = Array.from({ length: GRID }, () => Array(GRID).fill(-1));
    [...this.solutionPieces].sort((a, b) => a.z - b.z).forEach((p) => {
      stackPiece(answer, zGrid, p.cells, p.gridX, p.gridY, p.color, p.z);
    });
    return answer;
  }

  canPlace(cells, gx, gy) {
    for (const [x, y] of cellsAt(cells, gx, gy)) {
      if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
    }
    return true;
  }

  placeShape(gx, gy) {
    const cells = SHAPES[this.shapeIdx].map((c) => [...c]);
    if (!this.canPlace(cells, gx, gy)) return false;
    const color = COLORS[this.colorIdx];
    const z = this.solutionPieces.length
      ? Math.max(...this.solutionPieces.map((p) => p.z)) + 1
      : 0;
    const id = this.allPieces().length;
    this.solutionPieces.push({
      id,
      cells,
      color,
      gridX: gx,
      gridY: gy,
      z,
      isCorrect: true,
      solutionX: gx,
      solutionY: gy,
      solutionZ: z,
    });
    if (!validateSolutionVisibility(this.solutionPieces)) {
      this.solutionPieces.pop();
      this.modal = { type: 'info', title: '无法放置', msg: '每块拼图至少露出一格，不能完全被遮挡' };
      return false;
    }
    this.selectedId = id;
    return true;
  }

  movePiece(id, gx, gy) {
    const p = this.solutionPieces.find((x) => x.id === id);
    if (!p || !this.canPlace(p.cells, gx, gy)) return false;
    const ox = p.gridX;
    const oy = p.gridY;
    p.gridX = gx;
    p.gridY = gy;
    p.solutionX = gx;
    p.solutionY = gy;
    if (!validateSolutionVisibility(this.solutionPieces)) {
      p.gridX = ox;
      p.gridY = oy;
      p.solutionX = ox;
      p.solutionY = oy;
      this.modal = { type: 'info', title: '无法放置', msg: '每块拼图至少露出一格，不能完全被遮挡' };
      return false;
    }
    this.selectedId = id;
    return true;
  }

  layerUp(id) {
    const sorted = [...this.solutionPieces].sort((a, b) => a.z - b.z);
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return false;
    const a = sorted[idx];
    const b = sorted[idx + 1];
    const az = a.z;
    const bz = b.z;
    a.z = bz;
    b.z = az;
    a.solutionZ = a.z;
    b.solutionZ = b.z;
    if (!validateSolutionVisibility(this.solutionPieces)) {
      a.z = az;
      b.z = bz;
      a.solutionZ = az;
      b.solutionZ = bz;
      this.modal = { type: 'info', title: '无法调层', msg: '调层后会有拼图被完全遮挡' };
      return false;
    }
    return true;
  }

  layerDown(id) {
    const sorted = [...this.solutionPieces].sort((a, b) => a.z - b.z);
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx <= 0) return false;
    const a = sorted[idx];
    const b = sorted[idx - 1];
    const az = a.z;
    const bz = b.z;
    a.z = bz;
    b.z = az;
    a.solutionZ = a.z;
    b.solutionZ = b.z;
    if (!validateSolutionVisibility(this.solutionPieces)) {
      a.z = az;
      b.z = bz;
      a.solutionZ = az;
      b.solutionZ = bz;
      this.modal = { type: 'info', title: '无法调层', msg: '调层后会有拼图被完全遮挡' };
      return false;
    }
    return true;
  }

  checkVisibility() {
    if (!validateSolutionVisibility(this.solutionPieces)) {
      this.modal = { type: 'info', title: '规则不符', msg: '有拼图被完全遮挡，请调整后再试' };
      return false;
    }
    return true;
  }

  addDecoy() {
    const id = this.allPieces().length;
    const si = Math.floor(Math.random() * SHAPES.length);
    const ci = Math.floor(Math.random() * COLORS.length);
    this.decoyPieces.push({
      id,
      cells: SHAPES[si].map((c) => [...c]),
      color: COLORS[ci],
      isCorrect: false,
    });
  }

  removeSelected() {
    if (this.selectedId == null) return;
    this.solutionPieces = this.solutionPieces.filter((p) => p.id !== this.selectedId);
    this.decoyPieces = this.decoyPieces.filter((p) => p.id !== this.selectedId);
    this.solutionPieces.forEach((p, i) => {
      p.z = i;
      p.solutionZ = i;
    });
    this.selectedId = null;
  }

  clearAll() {
    this.solutionPieces = [];
    this.decoyPieces = [];
    this.selectedId = null;
  }

  toLevelData() {
    const answer = this.recomputeAnswer();
    const pieces = this.allPieces().map((p, i) => ({
      id: i,
      cells: p.cells.map((c) => [...c]),
      color: p.color,
      placed: false,
      gridX: 0,
      gridY: 0,
      z: 0,
      isCorrect: !!p.isCorrect,
      solutionX: p.solutionX,
      solutionY: p.solutionY,
      solutionZ: p.solutionZ,
    }));
    return { answer, pieces, custom: true };
  }

  saveLevel() {
    const data = this.toLevelData();
    if (!this.solutionPieces.length) {
      this.modal = { type: 'info', title: '保存', msg: '请至少放置一块碎片' };
      return;
    }
    if (!this.checkVisibility()) return;
    const entry = { name: `自定义 ${this.savedList.length + 1}`, ...data, savedAt: Date.now() };
    this.savedList.push(entry);
    wx.setStorageSync(CUSTOM_KEY, this.savedList);
    this.modal = { type: 'info', title: '已保存', msg: entry.name };
  }

  testPlay() {
    if (!this.solutionPieces.length) {
      this.modal = { type: 'info', title: '试玩', msg: '请至少放置一块碎片' };
      return;
    }
    if (!this.checkVisibility()) return;
    this.engine.loadCustomLevel(this.toLevelData(), 'editor');
  }

  shareLevel() {
    if (!this.solutionPieces.length) {
      this.modal = { type: 'info', title: '分享', msg: '请至少放置一块碎片' };
      return;
    }
    if (!this.checkVisibility()) return;
    const code = encodeShareLevel(this.toLevelData());
    if (code.length > 1900) {
      this.modal = { type: 'info', title: '分享', msg: '关卡过大，请减少碎片数量' };
      return;
    }
    this.engine.shareCustomLevel(code);
  }

  boardToGrid(layout, x, y) {
    const b = layout.board;
    if (x < b.x || y < b.y || x >= b.x + b.size || y >= b.y + b.size) return null;
    return {
      gx: Math.min(9, Math.max(0, Math.floor((x - b.x) / b.cell))),
      gy: Math.min(9, Math.max(0, Math.floor((y - b.y) / b.cell))),
    };
  }

  findPieceAt(gx, gy) {
    const sorted = [...this.solutionPieces].sort((a, b) => b.z - a.z);
    for (const p of sorted) {
      for (const [dx, dy] of p.cells) {
        if (p.gridX + dx === gx && p.gridY + dy === gy) return p;
      }
    }
    return null;
  }

  cycleShape(dir) {
    this.shapeIdx = (this.shapeIdx + dir + SHAPES.length) % SHAPES.length;
  }

  cycleColor(dir) {
    this.colorIdx = (this.colorIdx + dir + COLORS.length) % COLORS.length;
  }
}

export function computeEditorLayout(editor) {
  const safe = getSafeArea();
  const pad = 10;
  const leftW = Math.max(150, SCREEN_WIDTH * 0.22) + safe.left;
  const rightW = Math.max(140, SCREEN_WIDTH * 0.22);
  const topPad = Math.max(safe.top, 10) + 4;
  const midX = leftW + pad;
  const midW = SCREEN_WIDTH - leftW - rightW - pad * 2;
  const availH = SCREEN_HEIGHT - topPad - pad;
  const cell = Math.floor(Math.min(midW, availH - 8) / 10);
  const boardSize = cell * 10;
  const boardX = midX + (midW - boardSize) / 2;
  const boardY = topPad + (availH - boardSize) / 2;
  const leftX = safe.left + pad;
  const leftInner = leftW - safe.left - pad;
  const btnH = 28;
  const btnGap = 6;
  const showLayer = editor.selectedId != null
    && editor.solutionPieces.some((p) => p.id === editor.selectedId);
  const btnRows = showLayer ? 5 : 4;
  const btnAreaH = btnRows * btnH + (btnRows - 1) * btnGap;
  const btnStartY = SCREEN_HEIGHT - pad - btnAreaH;
  const headerY = topPad + 4;
  const toolsTop = headerY + 24;
  const toolsBottom = btnStartY - 10;
  const toolsH = Math.max(90, toolsBottom - toolsTop);
  let previewMax = Math.min(leftInner - 8, Math.floor((toolsH - 70) / 1));
  previewMax = Math.max(40, Math.min(previewMax, 96));
  const previewCell = Math.max(1, Math.floor(previewMax / 4));
  const previewSize = previewCell * 4;
  const previewY = toolsTop + 14;
  const shapeBtnY = previewY + previewSize + 8;
  const colorBtnY = Math.min(shapeBtnY + 34, btnStartY - 38);

  const buttons = [];
  let btnY = btnStartY;
  const addRow = (items) => {
    items.forEach((item, i) => {
      const w = item.span === 2 ? leftInner : (leftInner - btnGap) / 2;
      const x = item.span === 2 ? leftX : leftX + i * ((leftInner + btnGap) / 2);
      buttons.push({ id: item.id, label: item.label, x, y: btnY, w, h: btnH });
    });
    btnY += btnH + btnGap;
  };
  if (showLayer) addRow([{ id: 'edLayerUp', label: '上移 ↑' }, { id: 'edLayerDown', label: '下移 ↓' }]);
  addRow([{ id: 'edBack', label: '返回' }, { id: 'edClear', label: '清空' }]);
  addRow([{ id: 'edDecoy', label: '加干扰' }, { id: 'edDel', label: '删除' }]);
  addRow([{ id: 'edTest', label: '试玩' }, { id: 'edSave', label: '保存' }]);
  addRow([{ id: 'edShare', label: '分享给好友', span: 2 }]);

  return {
    leftW,
    rightW,
    leftX,
    leftInner,
    topPad,
    headerY,
    board: { x: boardX, y: boardY, size: boardSize, cell },
    preview: {
      x: leftX + (leftInner - previewSize) / 2,
      y: previewY,
      cell: previewCell,
      size: previewSize,
      boxX: leftX + (leftInner - previewSize) / 2 - 4,
      boxY: previewY - 4,
      boxW: previewSize + 8,
      boxH: previewSize + 8,
    },
    shapeBtns: {
      prev: { x: leftX, y: shapeBtnY, w: 36, h: 28 },
      next: { x: leftX + leftInner - 36, y: shapeBtnY, w: 36, h: 28 },
    },
    colorBtns: {
      prev: { x: leftX, y: colorBtnY, w: 36, h: 28 },
      next: { x: leftX + leftInner - 36, y: colorBtnY, w: 36, h: 28 },
      swatch: { x: leftX + 44, y: colorBtnY, w: leftInner - 88, h: 28 },
    },
    right: { x: SCREEN_WIDTH - rightW + pad, y: topPad + 24, w: rightW - pad * 2, h: SCREEN_HEIGHT - topPad - pad - 24 },
    buttons,
    panels: {
      left: { x: 0, w: leftW },
      center: { x: leftW, w: midW + pad * 2 },
      right: { x: SCREEN_WIDTH - rightW, w: rightW },
    },
  };
}

export function hitTestEditor(layout, x, y) {
  for (const btn of layout.buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn.id;
  }
  const sb = layout.shapeBtns;
  if (x >= sb.prev.x && x <= sb.prev.x + sb.prev.w && y >= sb.prev.y && y <= sb.prev.y + sb.prev.h) return 'shapePrev';
  if (x >= sb.next.x && x <= sb.next.x + sb.next.w && y >= sb.next.y && y <= sb.next.y + sb.next.h) return 'shapeNext';
  const cb = layout.colorBtns;
  if (x >= cb.prev.x && x <= cb.prev.x + cb.prev.w && y >= cb.prev.y && y <= cb.prev.y + cb.prev.h) return 'colorPrev';
  if (x >= cb.next.x && x <= cb.next.x + cb.next.w && y >= cb.next.y && y <= cb.next.y + cb.next.h) return 'colorNext';
  if (x >= cb.swatch.x && x <= cb.swatch.x + cb.swatch.w && y >= cb.swatch.y && y <= cb.swatch.y + cb.swatch.h) return 'colorNext';
  const pv = layout.preview;
  if (x >= pv.boxX && x <= pv.boxX + pv.boxW && y >= pv.boxY && y <= pv.boxY + pv.boxH) return 'preview';
  return null;
}

export function editorSnapGrid(layout, x, y, grabOx, grabOy, cells) {
  const { board } = layout;
  const cell = board.cell;
  const originX = x - grabOx * cell;
  const originY = y - grabOy * cell;
  let gx = Math.round((originX - board.x) / cell);
  let gy = Math.round((originY - board.y) / cell);
  let maxCx = 0;
  let maxCy = 0;
  cells.forEach(([cx, cy]) => {
    if (cx > maxCx) maxCx = cx;
    if (cy > maxCy) maxCy = cy;
  });
  gx = Math.min(9 - maxCx, Math.max(0, gx));
  gy = Math.min(9 - maxCy, Math.max(0, gy));
  const over = x >= board.x && x <= board.x + board.size && y >= board.y && y <= board.y + board.size;
  return { gx, gy, over };
}

function drawCell(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x + 2.5, y + 2.5, size - 5, (size - 5) * 0.35, 3);
  ctx.fill();
}

function drawPieceCells(ctx, cells, px, py, cell, color, highlight, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  cells.forEach(([dx, dy]) => {
    const cx = px + dx * cell;
    const cy = py + dy * cell;
    drawCell(ctx, cx, cy, cell, color);
    if (highlight) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      roundRect(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, 4);
      ctx.stroke();
    }
  });
  ctx.restore();
}

export function renderEditor(ctx, editor, drag) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const layout = computeEditorLayout(editor);
  drawAtmosphere(ctx, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawSoftPanel(ctx, 0, 0, layout.panels.left.w, SCREEN_HEIGHT);
  drawSoftPanel(ctx, layout.panels.right.x, 0, layout.panels.right.w, SCREEN_HEIGHT);
  ctx.fillStyle = 'rgba(18,22,40,0.55)';
  ctx.fillRect(layout.panels.center.x, 0, layout.panels.center.w, SCREEN_HEIGHT);
  ctx.strokeStyle = 'rgba(120,140,220,0.12)';
  ctx.beginPath();
  ctx.moveTo(layout.panels.center.x + 0.5, 0);
  ctx.lineTo(layout.panels.center.x + 0.5, SCREEN_HEIGHT);
  ctx.moveTo(layout.panels.right.x + 0.5, 0);
  ctx.lineTo(layout.panels.right.x + 0.5, SCREEN_HEIGHT);
  ctx.stroke();

  ctx.fillStyle = C.text;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('关卡编辑器', layout.leftX, layout.headerY);

  const cells = SHAPES[editor.shapeIdx];
  const color = COLORS[editor.colorIdx];
  const pv = layout.preview;
  ctx.fillStyle = C.textSub;
  ctx.font = '11px sans-serif';
  ctx.fillText('形状', layout.leftX, pv.y - 12);
  drawCard(ctx, pv.x - 4, pv.y - 4, pv.size + 8, pv.size + 8, 8);
  const hidePreview = drag && drag.source === 'palette';
  if (!hidePreview) {
    const b = shapeBounds(cells);
    const ox = pv.x + (pv.size - b.w * pv.cell) / 2;
    const oy = pv.y + (pv.size - b.h * pv.cell) / 2;
    drawPieceCells(ctx, cells, ox, oy, pv.cell, color, false);
  }

  drawBtn(ctx, { ...layout.shapeBtns.prev, label: '◀', r: 8, fontSize: 12 });
  drawBtn(ctx, { ...layout.shapeBtns.next, label: '▶', r: 8, fontSize: 12 });
  ctx.fillStyle = C.textSub;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('颜色', layout.leftX, layout.colorBtns.swatch.y - 12);
  roundRect(ctx, layout.colorBtns.swatch.x, layout.colorBtns.swatch.y, layout.colorBtns.swatch.w, layout.colorBtns.swatch.h, 8);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();
  drawBtn(ctx, { ...layout.colorBtns.prev, label: '◀', r: 8, fontSize: 12 });
  drawBtn(ctx, { ...layout.colorBtns.next, label: '▶', r: 8, fontSize: 12 });

  layout.buttons.forEach((btn) => {
    const primary = btn.id === 'edShare' || btn.id === 'edTest' || btn.id === 'edSave';
    drawBtn(ctx, { ...btn, primary, r: 8, fontSize: 12 });
  });

  const bx = layout.board.x;
  const by = layout.board.y;
  const bc = layout.board.cell;
  drawCard(ctx, bx - 8, by - 8, bc * 10 + 16, bc * 10 + 16, 12);
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = 0; gx < 10; gx++) {
      ctx.fillStyle = (gx + gy) % 2 === 0 ? '#262a42' : '#1d2136';
      ctx.fillRect(bx + gx * bc, by + gy * bc, bc, bc);
    }
  }
  const dragId = drag && drag.source === 'board' ? drag.pieceId : null;
  [...editor.solutionPieces].sort((a, b) => a.z - b.z).forEach((p) => {
    if (p.id === dragId) return;
    const sel = p.id === editor.selectedId;
    drawPieceCells(ctx, p.cells, bx + p.gridX * bc, by + p.gridY * bc, bc, p.color, sel);
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const lx = Math.round(bx + i * bc) + 0.5;
    const ly = Math.round(by + i * bc) + 0.5;
    ctx.beginPath();
    ctx.moveTo(lx, by);
    ctx.lineTo(lx, by + bc * 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, ly);
    ctx.lineTo(bx + bc * 10, ly);
    ctx.stroke();
  }

  if (drag && drag.active) {
    const dCells = drag.cells;
    const dColor = drag.color;
    if (drag.over && drag.previewGx != null) {
      drawPieceCells(ctx, dCells, bx + drag.previewGx * bc, by + drag.previewGy * bc, bc, dColor, true, 0.35);
    }
    drawPieceCells(ctx, dCells, drag.x - drag.grabOx * bc, drag.y - drag.grabOy * bc - 8, bc, dColor, true, 0.92);
    if (drag.over) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2.5;
      roundRect(ctx, bx - 8, by - 8, bc * 10 + 16, bc * 10 + 16, 12);
      ctx.stroke();
    }
  }

  const r = layout.right;
  ctx.fillStyle = C.text;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`碎片 (${editor.allPieces().length})`, r.x, r.y - 16);
  let ry = r.y;
  editor.allPieces().forEach((p) => {
    if (ry > r.y + r.h - 40) return;
    roundRect(ctx, r.x, ry - 4, r.w, 30, 8);
    ctx.fillStyle = p.id === editor.selectedId ? 'rgba(240,193,74,0.12)' : 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.fillStyle = p.isCorrect ? C.textSub : '#c47a8a';
    ctx.font = '11px sans-serif';
    ctx.fillText(p.isCorrect ? `✓ 层${p.z + 1}` : '干扰', r.x + 6, ry + 4);
    const dc = 6;
    drawPieceCells(ctx, p.cells, r.x + 48, ry, dc, p.color, p.id === editor.selectedId);
    const pb = shapeBounds(p.cells);
    ry += Math.max(34, pb.h * dc + 12);
  });

  if (editor.modal) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const mw = 260;
    const mh = 130;
    const mx = (SCREEN_WIDTH - mw) / 2;
    const my = (SCREEN_HEIGHT - mh) / 2;
    drawCard(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = C.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(editor.modal.title, mx + mw / 2, my + 32);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = C.textSub;
    ctx.fillText(editor.modal.msg, mx + mw / 2, my + 62);
    drawBtn(ctx, { x: mx + 80, y: my + 88, w: 100, h: 32, label: '确定', primary: true });
  }

  return layout;
}

export function hitTestEditorModal(editor, x, y) {
  if (!editor.modal) return null;
  const mw = 260;
  const mh = 130;
  const mx = (SCREEN_WIDTH - mw) / 2;
  const my = (SCREEN_HEIGHT - mh) / 2;
  if (x >= mx + 80 && x <= mx + 180 && y >= my + 88 && y <= my + 120) return 'dismiss';
  return null;
}
