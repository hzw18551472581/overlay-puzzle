import { SCREEN_WIDTH, SCREEN_HEIGHT, PIXEL_RATIO } from '../render';
import { TOTAL_LEVELS } from './levelGen';
import { shapeBounds } from './shapes';
import { computeLayout, materialSlotRect, materialMaxScroll } from './layout';

const C = {
  bg: '#0d0d18',
  panel: '#13131f',
  card: '#1a1a2c',
  cardBorder: 'rgba(255,255,255,0.1)',
  gridEmpty: '#222236',
  text: '#eef0f6',
  textSub: '#8b93a8',
  accent: '#5b8def',
  gold: '#f0c040',
  submit: '#2ecc71',
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCell(ctx, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.fillStyle = color;
  roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x + 2.5, y + 2.5, size - 5, (size - 5) * 0.35, 3);
  ctx.fill();
  ctx.restore();
}

function drawGridLines(ctx, x, y, cell, strong) {
  const size = cell * 10;
  ctx.save();
  ctx.strokeStyle = strong ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const lx = Math.round(x + i * cell) + 0.5;
    const ly = Math.round(y + i * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + size, ly);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(ctx, x, y, cell, colors, emptyColor, strongLines) {
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = 0; gx < 10; gx++) {
      drawCell(ctx, x + gx * cell, y + gy * cell, cell, colors[gy][gx] || emptyColor, 1);
    }
  }
  drawGridLines(ctx, x, y, cell, strongLines);
}

function drawBoardBg(ctx, x, y, cell) {
  for (let gy = 0; gy < 10; gy++) {
    for (let gx = 0; gx < 10; gx++) {
      const c = (gx + gy) % 2 === 0 ? '#232338' : '#1c1c30';
      ctx.fillStyle = c;
      ctx.fillRect(x + gx * cell, y + gy * cell, cell, cell);
    }
  }
}

function drawMaterialSlot(ctx, sx, sy, sw, sh, cells, color, dc, floating) {
  ctx.save();
  if (floating) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
  }
  ctx.fillStyle = '#24243a';
  roundRect(ctx, sx, sy, sw, sh, 8);
  ctx.fill();
  ctx.strokeStyle = floating ? C.gold : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = floating ? 2 : 1;
  ctx.stroke();
  const b = shapeBounds(cells);
  const ox = sx + (sw - b.w * dc) / 2;
  const oy = sy + (sh - b.h * dc) / 2;
  drawPieceCells(ctx, cells, ox, oy, dc, color, 1, floating);
  ctx.restore();
}

function drawFloatingSlot(ctx, x, y, grabDx, grabDy, sw, sh, cells, color, dc, lift) {
  const sx = x - grabDx;
  const sy = y - grabDy - (lift == null ? 12 : lift);
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.06, 1.06);
  ctx.translate(-cx, -cy);
  drawMaterialSlot(ctx, sx, sy, sw, sh, cells, color, dc, true);
  ctx.restore();
}

function drawMaterialDrag(ctx, drag, layout, piece) {
  const blend = drag.boardBlend || 0;
  const boardCell = layout.board.cell;
  const lift = 12 * (1 - blend * 0.6);

  if (blend < 0.95) {
    ctx.save();
    ctx.globalAlpha = 1 - blend * 0.85;
    drawFloatingSlot(ctx, drag.x, drag.y, drag.grabDx, drag.grabDy,
      drag.slotW, drag.slotH, piece.cells, piece.color, drag.displayCell, lift);
    ctx.restore();
  }

  if (blend > 0.05) {
    const cell = drag.animCell || boardCell;
    const px = drag.x - drag.grabOx * boardCell;
    const py = drag.y - drag.grabOy * boardCell - lift;
    ctx.save();
    ctx.globalAlpha = 0.4 + blend * 0.55;
    drawPieceCells(ctx, piece.cells, px, py, boardCell, piece.color, 1, blend > 0.5);
    ctx.restore();
  }

  if (drag.overBoard && drag.previewGx != null && blend > 0.4) {
    const sp = {
      x: layout.board.x + drag.previewGx * boardCell,
      y: layout.board.y + drag.previewGy * boardCell,
    };
    drawPieceCells(ctx, piece.cells, sp.x, sp.y, boardCell, piece.color, 0.35 * blend, false);
  }
}

function drawPieceCells(ctx, cells, px, py, cell, color, alpha, highlight) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  cells.forEach(([dx, dy]) => {
    const cx = px + dx * cell;
    const cy = py + dy * cell;
    drawCell(ctx, cx, cy, cell, color, 1);
    if (highlight) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      roundRect(ctx, cx + 1.5, cy + 1.5, cell - 3, cell - 3, 4);
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawBtn(ctx, btn) {
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
  if (btn.primary) ctx.fillStyle = C.submit;
  else if (btn.active) ctx.fillStyle = C.gold;
  else ctx.fillStyle = '#2a3348';
  ctx.fill();
  ctx.strokeStyle = btn.primary ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = btn.primary || btn.active ? '#fff' : C.text;
  ctx.font = `bold ${btn.w > 100 ? 14 : 13}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
}

function drawCard(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLabel(ctx, text, x, y, opts) {
  ctx.fillStyle = (opts && opts.color) || C.textSub;
  ctx.font = (opts && opts.font) || '11px sans-serif';
  ctx.textAlign = (opts && opts.align) || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function drawMaterialScroll(ctx, layout, count) {
  const m = layout.material;
  const maxScroll = materialMaxScroll(layout, count);
  if (maxScroll <= 0) return;
  const barX = m.x + m.w - 4;
  const barH = m.h - 8;
  const barY = m.y + 4;
  const ratio = m.h / (maxScroll + m.h);
  const thumbH = Math.max(20, barH * ratio);
  const thumbY = barY + (m.scroll / maxScroll) * (barH - thumbH);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, barX, barY, 3, barH, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, barX, thumbY, 3, thumbH, 2);
  ctx.fill();
  if (m.scroll > 2) {
    const g = ctx.createLinearGradient(0, m.y, 0, m.y + 16);
    g.addColorStop(0, C.card);
    g.addColorStop(1, 'rgba(26,26,44,0)');
    ctx.fillStyle = g;
    ctx.fillRect(m.x, m.y, m.w - 6, 16);
  }
  if (m.scroll < maxScroll - 2) {
    const g = ctx.createLinearGradient(0, m.y + m.h - 16, 0, m.y + m.h);
    g.addColorStop(0, 'rgba(26,26,44,0)');
    g.addColorStop(1, C.card);
    ctx.fillStyle = g;
    ctx.fillRect(m.x, m.y + m.h - 16, m.w - 6, 16);
  }
}

function drawPanelBg(ctx, layout) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = C.panel;
  ctx.fillRect(layout.panels.left.x, 0, layout.panels.left.w, SCREEN_HEIGHT);
  ctx.fillRect(layout.panels.right.x, 0, layout.panels.right.w, SCREEN_HEIGHT);
  ctx.fillStyle = '#151525';
  ctx.fillRect(layout.panels.center.x, 0, layout.panels.center.w, SCREEN_HEIGHT);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.panels.center.x, 0);
  ctx.lineTo(layout.panels.center.x, SCREEN_HEIGHT);
  ctx.moveTo(layout.panels.right.x, 0);
  ctx.lineTo(layout.panels.right.x, SCREEN_HEIGHT);
  ctx.stroke();
}

function menuButtons(engine) {
  const bw = 220;
  const bh = 48;
  const cx = SCREEN_WIDTH / 2;
  const hasSave = engine.savedLevel != null;
  const gap = 16;
  const count = hasSave ? 2 : 1;
  const totalH = count * bh + (count - 1) * gap;
  const startY = SCREEN_HEIGHT / 2 - totalH / 2 + 40;
  const items = [];
  if (hasSave) {
    items.push({
      id: 'continue',
      label: `继续游戏 · 第 ${engine.savedLevel} 关`,
      x: cx - bw / 2,
      y: startY,
      w: bw,
      h: bh,
      primary: true,
    });
  }
  items.push({
    id: 'newGame',
    label: '新游戏',
    x: cx - bw / 2,
    y: hasSave ? startY + bh + gap : startY,
    w: bw,
    h: bh,
    primary: !hasSave,
  });
  return items;
}

export function renderMenu(ctx, engine) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = C.text;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('叠影拼图', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 80);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = C.textSub;
  ctx.fillText('叠放碎片，还原谜底图案', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 48);
  menuButtons(engine).forEach((btn) => drawBtn(ctx, btn));
}

export function hitTestMenu(engine, x, y) {
  for (const btn of menuButtons(engine)) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn.id;
  }
  return null;
}

export function renderGame(ctx, engine, drag, materialFloat) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const sel = engine.selectedId != null ? engine.getPiece(engine.selectedId) : null;
  const layout = computeLayout(engine.materialScroll, !!(sel && sel.placed));
  drawPanelBg(ctx, layout);

  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`第 ${engine.level} / ${TOTAL_LEVELS} 关`, layout.leftX, layout.headerY);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = C.textSub;
  ctx.fillText(`已放置 ${engine.placedCount()} 块`, layout.leftX, layout.headerY + 22);

  drawCard(ctx, layout.preview.x - 6, layout.preview.y - 4, layout.preview.size + 12, layout.preview.size + 8, 8);
  drawGrid(ctx, layout.preview.x, layout.preview.y, layout.preview.cell, engine.answer, C.gridEmpty);

  const highlightBoard = drag && drag.overBoard;
  const bx = layout.board.x;
  const by = layout.board.y;
  const bc = layout.board.cell;
  const bs = layout.board.size;
  drawCard(ctx, bx - 8, by - 8, bs + 16, bs + 16, 12);
  drawBoardBg(ctx, bx, by, bc);

  const placed = [...engine.placedPieces()].sort((a, b) => a.z - b.z);
  const dragId = drag && drag.active ? drag.pieceId : null;
  placed.forEach((p) => {
    if (p.id === dragId) return;
    const isSel = p.id === engine.selectedId;
    const pos = { x: bx + p.gridX * bc, y: by + p.gridY * bc };
    if (isSel) drawPieceCells(ctx, p.cells, pos.x, pos.y, bc, p.color, 1, true);
    else if (engine.selectedId != null) drawPieceCells(ctx, p.cells, pos.x, pos.y, bc, p.color, 0.3, false);
    else drawPieceCells(ctx, p.cells, pos.x, pos.y, bc, p.color, 1, false);
  });

  if (engine.selectedId != null) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx, by, bs, bs);
  }

  drawGridLines(ctx, bx, by, bc, true);

  if (highlightBoard) {
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2.5;
    roundRect(ctx, bx - 8, by - 8, bs + 16, bs + 16, 12);
    ctx.stroke();
  }

  const m = layout.material;
  const unplaced = engine.unplacedPieces();
  drawCard(ctx, m.x - 6, m.y - 6, m.w + 12, m.h + 10, 12);
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`材料栏 (${unplaced.length})`, m.x, m.headerY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.x, m.y, m.w - 8, m.h);
  ctx.clip();
  unplaced.forEach((p, i) => {
    const slot = materialSlotRect(layout, i);
    if (slot.y + slot.h < m.y || slot.y > m.y + m.h) return;
    if (drag && drag.pieceId === p.id) return;
    if (materialFloat && materialFloat.pieceId === p.id) return;
    drawMaterialSlot(ctx, slot.x, slot.y, slot.w, slot.h, p.cells, p.color, m.displayCell, false);
  });
  ctx.restore();
  drawMaterialScroll(ctx, layout, unplaced.length);

  layout.buttons.items.forEach((btn) => {
    drawBtn(ctx, { ...btn, active: btn.id === 'cancel' && engine.selectedId != null });
  });

  if (materialFloat) {
    const p = engine.getPiece(materialFloat.pieceId);
    if (p) {
      drawFloatingSlot(ctx, materialFloat.x, materialFloat.y, materialFloat.grabDx, materialFloat.grabDy,
        materialFloat.slotW, materialFloat.slotH, p.cells, p.color, materialFloat.displayCell);
    }
  }

  if (drag && drag.active) {
    const p = engine.getPiece(drag.pieceId);
    if (p) {
      const cell = layout.board.cell;
      if (drag.source === 'material') {
        drawMaterialDrag(ctx, drag, layout, p);
      } else if (drag.overBoard && drag.previewGx != null) {
        const pos = { x: layout.board.x + drag.previewGx * cell, y: layout.board.y + drag.previewGy * cell };
        drawPieceCells(ctx, p.cells, pos.x, pos.y, cell, p.color, 0.8, true);
      } else {
        drawPieceCells(ctx, p.cells, drag.x - drag.grabOx * cell, drag.y - drag.grabOy * cell, cell, p.color, 0.92, true);
      }
    }
  }

  if (engine.modal) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    const mw = 280;
    const mh = 150;
    const mx = (SCREEN_WIDTH - mw) / 2;
    const my = (SCREEN_HEIGHT - mh) / 2;
    drawCard(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = C.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(engine.modal.title, mx + mw / 2, my + 40);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = C.textSub;
    ctx.fillText(engine.modal.msg, mx + mw / 2, my + 72);
    if (engine.modal.type === 'confirm') {
      drawBtn(ctx, { x: mx + 24, y: my + 96, w: 108, h: 36, label: '确定', primary: true });
      drawBtn(ctx, { x: mx + 148, y: my + 96, w: 108, h: 36, label: '取消' });
    } else if (engine.modal.type === 'exit') {
      drawBtn(ctx, { x: mx + 24, y: my + 96, w: 108, h: 36, label: '返回', primary: true });
      drawBtn(ctx, { x: mx + 148, y: my + 96, w: 108, h: 36, label: '取消' });
    } else if (engine.modal.type === 'pass') {
      drawBtn(ctx, { x: mx + 90, y: my + 96, w: 100, h: 36, label: '下一关', primary: true });
    } else {
      drawBtn(ctx, { x: mx + 90, y: my + 96, w: 100, h: 36, label: '确定', primary: true });
    }
  }

  return layout;
}

export function hitTestButtons(layout, x, y) {
  for (const btn of layout.buttons.items) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn.id;
  }
  return null;
}

export function hitTestModal(engine, x, y) {
  if (!engine.modal) return null;
  const mw = 280;
  const mh = 150;
  const mx = (SCREEN_WIDTH - mw) / 2;
  const my = (SCREEN_HEIGHT - mh) / 2;
  const inRect = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  if (engine.modal.type === 'confirm') {
    if (inRect(mx + 24, my + 96, 108, 36)) return 'confirmYes';
    if (inRect(mx + 148, my + 96, 108, 36)) return 'confirmNo';
  } else if (engine.modal.type === 'exit') {
    if (inRect(mx + 24, my + 96, 108, 36)) return 'exitYes';
    if (inRect(mx + 148, my + 96, 108, 36)) return 'exitNo';
  } else if (engine.modal.type === 'pass') {
    if (inRect(mx + 90, my + 96, 100, 36)) return 'nextLevel';
  } else if (inRect(mx + 90, my + 96, 100, 36)) {
    return 'dismiss';
  }
  return null;
}

