import { SCREEN_WIDTH, SCREEN_HEIGHT, PIXEL_RATIO } from '../render';
import { TOTAL_LEVELS } from './levelGen';
import { shapeBounds } from './shapes';
import { computeLayout, materialSlotRect, materialMaxScroll } from './layout';
import PuzzleEngine, { formatTime } from './engine';
import { getSharedCanvas } from './rank';
import { C, roundRect, drawAtmosphere, drawBtn, drawCard, drawSoftPanel } from './ui';

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
      const c = (gx + gy) % 2 === 0 ? '#262a42' : '#1d2136';
      ctx.fillStyle = c;
      ctx.fillRect(x + gx * cell, y + gy * cell, cell, cell);
    }
  }
}

function drawMaterialSlot(ctx, sx, sy, sw, sh, cells, color, dc, floating) {
  ctx.save();
  if (floating) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
  }
  roundRect(ctx, sx, sy, sw, sh, 10);
  const g = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  g.addColorStop(0, '#2a2f48');
  g.addColorStop(1, '#1c2034');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = floating ? C.gold : 'rgba(255,255,255,0.1)';
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

function drawStars(ctx, x, y, count, max, size) {
  const gap = (size || 14) + 2;
  for (let i = 0; i < (max || 3); i++) {
    const cx = x + i * gap;
    ctx.fillStyle = i < count ? C.gold : 'rgba(255,255,255,0.15)';
    ctx.font = `${size || 14}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('★', cx, y);
  }
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
  drawAtmosphere(ctx, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawSoftPanel(ctx, layout.panels.left.x, 0, layout.panels.left.w, SCREEN_HEIGHT);
  drawSoftPanel(ctx, layout.panels.right.x, 0, layout.panels.right.w, SCREEN_HEIGHT);
  ctx.fillStyle = 'rgba(18,22,40,0.55)';
  ctx.fillRect(layout.panels.center.x, 0, layout.panels.center.w, SCREEN_HEIGHT);
  ctx.strokeStyle = C.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.panels.center.x + 0.5, 0);
  ctx.lineTo(layout.panels.center.x + 0.5, SCREEN_HEIGHT);
  ctx.moveTo(layout.panels.right.x + 0.5, 0);
  ctx.lineTo(layout.panels.right.x + 0.5, SCREEN_HEIGHT);
  ctx.stroke();
}

function drawMenuDecor(ctx) {
  const blocks = [
    { x: SCREEN_WIDTH * 0.12, y: SCREEN_HEIGHT * 0.22, s: 18, c: '#E74C3C', a: 0.35 },
    { x: SCREEN_WIDTH * 0.16, y: SCREEN_HEIGHT * 0.28, s: 18, c: '#3498DB', a: 0.45 },
    { x: SCREEN_WIDTH * 0.14, y: SCREEN_HEIGHT * 0.34, s: 18, c: '#2ECC71', a: 0.4 },
    { x: SCREEN_WIDTH * 0.82, y: SCREEN_HEIGHT * 0.55, s: 16, c: '#F39C12', a: 0.35 },
    { x: SCREEN_WIDTH * 0.86, y: SCREEN_HEIGHT * 0.6, s: 16, c: '#9B59B6', a: 0.4 },
    { x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.64, s: 16, c: '#1ABC9C', a: 0.3 },
  ];
  blocks.forEach((b) => {
    ctx.save();
    ctx.globalAlpha = b.a;
    drawCell(ctx, b.x, b.y, b.s, b.c, 1);
    ctx.restore();
  });
}

function menuStartY(engine) {
  const titleY = Math.max(42, SCREEN_HEIGHT * 0.16);
  if (engine.totalStars() > 0) return titleY + 56 + 24 + 20;
  return titleY + 56 + 12;
}

function menuButtons(engine, startY) {
  const bw = 220;
  const bh = 44;
  const cx = SCREEN_WIDTH / 2;
  const hasSave = engine.savedLevel != null;
  const gap = 12;
  let y = startY == null ? menuStartY(engine) : startY;
  const items = [];
  if (hasSave) {
    items.push({
      id: 'continue',
      label: `继续游戏 · 第 ${engine.savedLevel} 关`,
      x: cx - bw / 2,
      y,
      w: bw,
      h: bh,
      primary: true,
      r: 14,
    });
    y += bh + gap;
  }
  items.push({
    id: 'newGame',
    label: '新游戏',
    x: cx - bw / 2,
    y,
    w: bw,
    h: bh,
    primary: !hasSave,
    r: 14,
  });
  y += bh + gap;
  const hw = (bw - gap) / 2;
  items.push({ id: 'rank', label: '排行榜', x: cx - bw / 2, y, w: hw, h: bh, r: 14 });
  items.push({ id: 'share', label: '分享', x: cx - bw / 2 + hw + gap, y, w: hw, h: bh, primary: true, r: 14 });
  y += bh + gap;
  items.push({ id: 'editor', label: '关卡编辑器', x: cx - bw / 2, y, w: bw, h: bh, r: 14 });
  return items;
}

function rankBackButton() {
  return {
    id: 'rankBack',
    label: '返回',
    x: SCREEN_WIDTH / 2 - 50,
    y: SCREEN_HEIGHT - 46,
    w: 100,
    h: 36,
    primary: true,
  };
}

export function renderMenu(ctx, engine) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawAtmosphere(ctx, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawMenuDecor(ctx);
  const cx = SCREEN_WIDTH / 2;
  const titleY = Math.max(42, SCREEN_HEIGHT * 0.16);
  ctx.fillStyle = 'rgba(110,168,255,0.18)';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('叠影拼图', cx + 1, titleY + 1);
  ctx.fillStyle = C.text;
  ctx.fillText('叠影拼图', cx, titleY);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = C.textSub;
  ctx.fillText('叠放碎片，还原谜底图案', cx, titleY + 32);
  if (engine.totalStars() > 0) {
    const chipW = 110;
    const chipH = 24;
    const chipX = cx - chipW / 2;
    const chipY = titleY + 56;
    roundRect(ctx, chipX, chipY, chipW, chipH, 12);
    ctx.fillStyle = 'rgba(240,193,74,0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,193,74,0.35)';
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`★ 已获 ${engine.totalStars()} 星`, cx, chipY + chipH / 2);
  }
  menuButtons(engine).forEach((btn) => drawBtn(ctx, btn));
}

export function hitTestMenu(engine, x, y) {
  for (const btn of menuButtons(engine)) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn.id;
  }
  return null;
}

export function renderRank(ctx) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const shared = getSharedCanvas();
  if (shared && shared.width > 0) {
    ctx.drawImage(shared, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  } else {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = C.textSub;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('排行榜加载中…', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
  }
  drawBtn(ctx, rankBackButton());
}

export function hitTestRank(x, y) {
  const btn = rankBackButton();
  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return 'rankBack';
  return null;
}

export function renderGame(ctx, engine, drag, materialFloat) {
  ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const sel = engine.selectedId != null ? engine.getPiece(engine.selectedId) : null;
  const hintLeft = PuzzleEngine.MAX_HINTS - engine.hintsUsed;
  const hintLabel = hintLeft > 0 ? `提示 (${hintLeft})` : '提示 (0)';
  const layout = computeLayout(engine.materialScroll, !!(sel && sel.placed), hintLabel);
  drawPanelBg(ctx, layout);

  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  const levelText = engine.levelLabel || `第 ${engine.level} / ${TOTAL_LEVELS} 关`;
  ctx.fillText(levelText, layout.leftX, layout.headerY);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = C.textSub;
  ctx.fillText(`已放置 ${engine.placedCount()} 块`, layout.leftX, layout.headerY + 22);
  const bestStars = engine.getStars(engine.level);
  if (bestStars > 0) drawStars(ctx, layout.leftX + 88, layout.headerY + 1, bestStars, 3, 12);
  const timeText = formatTime(engine.getLevelTimeMs());
  const timeW = 58;
  const timeX = layout.leftX + layout.leftInner - timeW - 2;
  const timeY = layout.headerY + 18;
  roundRect(ctx, timeX, timeY, timeW, 20, 10);
  ctx.fillStyle = 'rgba(110,168,255,0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,168,255,0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.accent;
  ctx.font = 'bold 12px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeText, timeX + timeW / 2, timeY + 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  drawCard(ctx, layout.preview.x - 6, layout.preview.y - 4, layout.preview.size + 12, layout.preview.size + 8, 10);
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

  if (engine.hintFlash && Date.now() < engine.hintFlash.until) {
    const hp = engine.getPiece(engine.hintFlash.pieceId);
    if (hp && hp.placed) {
      const pos = { x: bx + hp.gridX * bc, y: by + hp.gridY * bc };
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 180) * 0.15;
      drawPieceCells(ctx, hp.cells, pos.x, pos.y, bc, '#fff', 1, true);
      ctx.restore();
    }
  } else if (engine.hintFlash) {
    engine.hintFlash = null;
  }

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
  ctx.fillText(`材料栏 · ${unplaced.length}`, m.x, m.headerY);
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
    const hasStars = engine.modal.stars != null;
    const mw = 280;
    const mh = hasStars ? 178 : 150;
    const mx = (SCREEN_WIDTH - mw) / 2;
    const my = (SCREEN_HEIGHT - mh) / 2;
    drawCard(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = C.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(engine.modal.title, mx + mw / 2, my + 28);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = C.textSub;
    ctx.fillText(engine.modal.msg, mx + mw / 2, my + 58);
    if (hasStars) {
      drawStars(ctx, mx + mw / 2 - 25, my + 82, engine.modal.stars, 3, 18);
    }
    const btnY = hasStars ? my + 118 : my + 96;
    if (engine.modal.type === 'confirm') {
      drawBtn(ctx, { x: mx + 24, y: btnY, w: 108, h: 36, label: '确定', primary: true });
      drawBtn(ctx, { x: mx + 148, y: btnY, w: 108, h: 36, label: '取消' });
    } else if (engine.modal.type === 'exit') {
      drawBtn(ctx, { x: mx + 24, y: btnY, w: 108, h: 36, label: '返回', primary: true });
      drawBtn(ctx, { x: mx + 148, y: btnY, w: 108, h: 36, label: '取消' });
    } else if (engine.modal.type === 'pass') {
      drawBtn(ctx, { x: mx + 90, y: btnY, w: 100, h: 36, label: '下一关', primary: true });
    } else if (engine.modal.type === 'customPass') {
      drawBtn(ctx, { x: mx + 90, y: btnY, w: 100, h: 36, label: '返回编辑', primary: true });
    } else if (engine.modal.type === 'sharedPass') {
      drawBtn(ctx, { x: mx + 90, y: btnY, w: 100, h: 36, label: '返回主界面', primary: true });
    } else {
      drawBtn(ctx, { x: mx + 90, y: btnY, w: 100, h: 36, label: '确定', primary: true });
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
  const hasStars = engine.modal.stars != null;
  const mw = 280;
  const mh = hasStars ? 178 : 150;
  const mx = (SCREEN_WIDTH - mw) / 2;
  const my = (SCREEN_HEIGHT - mh) / 2;
  const btnY = hasStars ? my + 118 : my + 96;
  const inRect = (rx, ry, rw, rh) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  if (engine.modal.type === 'confirm') {
    if (inRect(mx + 24, btnY, 108, 36)) return 'confirmYes';
    if (inRect(mx + 148, btnY, 108, 36)) return 'confirmNo';
  } else if (engine.modal.type === 'exit') {
    if (inRect(mx + 24, btnY, 108, 36)) return 'exitYes';
    if (inRect(mx + 148, btnY, 108, 36)) return 'exitNo';
  } else if (engine.modal.type === 'pass') {
    if (inRect(mx + 90, btnY, 100, 36)) return 'nextLevel';
  } else if (engine.modal.type === 'customPass') {
    if (inRect(mx + 90, btnY, 100, 36)) return 'customBack';
  } else if (engine.modal.type === 'sharedPass') {
    if (inRect(mx + 90, btnY, 100, 36)) return 'sharedBack';
  } else if (inRect(mx + 90, btnY, 100, 36)) {
    return 'dismiss';
  }
  return null;
}

