import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { shapeBounds } from './shapes';

export function getSafeArea() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const sa = info.safeArea || { left: 0, top: 0, right: info.screenWidth, bottom: info.screenHeight };
  return {
    left: sa.left || 0,
    top: sa.top || 0,
    right: info.screenWidth - (sa.right || info.screenWidth),
    bottom: info.screenHeight - (sa.bottom || info.screenHeight),
    width: info.screenWidth,
    height: info.screenHeight,
  };
}

function buildButtons(leftX, leftW, startY) {
  const gap = 6;
  const bh = 32;
  const bw = (leftW - gap) / 2;
  const rows = [];
  let y = startY;
  const add = (id, label, col, span, primary) => {
    const w = span === 2 ? leftW : bw;
    const x = col === 0 ? leftX : leftX + bw + gap;
    rows.push({ id, label, x, y, w, h: bh, primary });
    if (col === 1 || span === 2) y += bh + gap;
  };
  return { rows, add, endY: () => y };
}

export function computeLayout(materialScroll, showLayerTools, hintLabel) {
  const safe = getSafeArea();
  const pad = 10;
  const leftInner = Math.max(160, SCREEN_WIDTH * 0.24);
  const leftW = leftInner + safe.left;
  const rightW = Math.max(200, SCREEN_WIDTH * 0.28);
  const topPad = Math.max(safe.top, 10) + 4;
  const midX = leftW + pad;
  const midW = SCREEN_WIDTH - leftW - rightW - pad * 2;
  const availH = SCREEN_HEIGHT - topPad - pad;
  const cell = Math.floor(Math.min(midW, availH - 8) / 10);
  const boardSize = cell * 10;
  const boardX = midX + (midW - boardSize) / 2;
  const boardY = topPad + (availH - boardSize) / 2;

  const leftX = safe.left + pad;
  const btnW = leftInner - pad;
  const toolRows = showLayerTools ? 3 : 1;
  const btnRows = 1 + toolRows + 1;
  const btnAreaH = btnRows * 32 + (btnRows - 1) * 6;
  const btnStartY = SCREEN_HEIGHT - pad - btnAreaH;
  const headerY = topPad + 6;
  const previewY = headerY + 62;
  const previewMax = Math.min(btnW, btnStartY - previewY - 12, 170);
  const previewCell = Math.max(1, Math.floor(Math.max(0, previewMax) / 10));
  const previewSize = previewCell * 10;
  const previewX = leftX + (btnW - previewSize) / 2;

  const btnBuilder = buildButtons(leftX, btnW, btnStartY);
  btnBuilder.add('hint', hintLabel || '提示', 0, 2);
  if (showLayerTools) {
    btnBuilder.add('layerUp', '上移 ↑', 0);
    btnBuilder.add('layerDown', '下移 ↓', 1);
    btnBuilder.add('recall', '收回', 0);
    btnBuilder.add('cancel', '取消', 1);
  } else {
    btnBuilder.add('cancel', '取消选中', 0, 2);
  }
  btnBuilder.add('reset', '重置', 0);
  btnBuilder.add('submit', '提交', 1, 1, true);
  const homeBtn = { id: 'home', label: '主界面', x: leftX + btnW - 64, y: headerY - 2, w: 64, h: 28 };

  const matPad = 8;
  const matX = SCREEN_WIDTH - rightW + matPad;
  const matW = rightW - matPad * 2;
  const matHeaderY = topPad + 6;
  const matY = topPad + 24;
  const matH = SCREEN_HEIGHT - matY - pad;
  let matCols = 3;
  let matSlot = 0;
  for (let c = 3; c >= 2; c--) {
    const s = Math.floor((matW - (c - 1) * 8) / c);
    if (s >= 56) {
      matCols = c;
      matSlot = s;
      break;
    }
  }
  if (matSlot <= 0) {
    matCols = 2;
    matSlot = Math.floor((matW - 8) / 2);
  }
  const matDisplayCell = Math.max(1, Math.floor((matSlot - 6) / 4));

  return {
    safe,
    leftW,
    rightW,
    leftX,
    leftInner,
    topPad,
    headerY,
    board: { x: boardX, y: boardY, size: boardSize, cell },
    preview: { x: previewX, y: previewY, size: previewSize, cell: previewCell },
    material: {
      x: matX,
      y: matY,
      headerY: matHeaderY,
      w: matW,
      h: matH,
      cols: matCols,
      slot: matSlot,
      gap: 8,
      displayCell: matDisplayCell,
      scroll: materialScroll,
    },
    buttons: {
      items: [homeBtn, ...btnBuilder.rows],
    },
    panels: {
      left: { x: 0, y: 0, w: leftW, h: SCREEN_HEIGHT },
      center: { x: leftW, y: 0, w: midW + pad * 2, h: SCREEN_HEIGHT },
      right: { x: SCREEN_WIDTH - rightW, y: 0, w: rightW, h: SCREEN_HEIGHT },
    },
  };
}

export function snapPieceGrid(layout, x, y, grabOx, grabOy, cells) {
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
  const snappedX = board.x + gx * cell;
  const snappedY = board.y + gy * cell;
  const over = x >= board.x && x <= board.x + board.size && y >= board.y && y <= board.y + board.size;
  return { gx, gy, originX, originY, snappedX, snappedY, over, cell };
}

export function boardToGrid(layout, x, y) {
  const { board } = layout;
  if (x < board.x || y < board.y || x >= board.x + board.size || y >= board.y + board.size) {
    return null;
  }
  const gx = Math.floor((x - board.x) / board.cell);
  const gy = Math.floor((y - board.y) / board.cell);
  return { gx: Math.min(9, Math.max(0, gx)), gy: Math.min(9, Math.max(0, gy)) };
}

export function gridToBoard(layout, gx, gy) {
  return {
    x: layout.board.x + gx * layout.board.cell,
    y: layout.board.y + gy * layout.board.cell,
  };
}

export function materialMaxScroll(layout, count) {
  const m = layout.material;
  if (m.slot <= 0) return 0;
  const step = m.slot + m.gap;
  const rows = Math.ceil(count / m.cols);
  return Math.max(0, rows * step - m.h);
}

export function materialIndexAt(layout, unplacedPieces, x, y) {
  const m = layout.material;
  if (m.slot <= 0) return -1;
  if (x < m.x || x > m.x + m.w || y < m.y || y > m.y + m.h) return -1;
  for (let i = 0; i < unplacedPieces.length; i++) {
    const slot = materialSlotRect(layout, i);
    if (x >= slot.x && x < slot.x + slot.w && y >= slot.y && y < slot.y + slot.h) return i;
  }
  return -1;
}

export function materialSlotRect(layout, index) {
  const m = layout.material;
  const col = index % m.cols;
  const row = Math.floor(index / m.cols);
  const step = m.slot + m.gap;
  return {
    x: m.x + col * step,
    y: m.y + row * step - m.scroll,
    w: m.slot,
    h: m.slot,
  };
}

export function pieceDrawSize(cells, cellSize) {
  const b = shapeBounds(cells);
  return { w: b.w * cellSize, h: b.h * cellSize, bw: b.w, bh: b.h };
}
