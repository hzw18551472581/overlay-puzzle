import { computeLayout, boardToGrid, materialIndexAt, gridToBoard, materialSlotRect, snapPieceGrid, materialMaxScroll } from './layout';
import { shapeBounds, SHAPES, COLORS } from './shapes';
import { hitTestButtons, hitTestModal, hitTestMenu, hitTestRank } from './render';
import PuzzleEngine from './engine';
import { computeEditorLayout, hitTestEditor, hitTestEditorModal, editorSnapGrid } from './editor';

const DRAG_THRESHOLD = 8;
const SCROLL_THRESHOLD = 8;
const LONG_PRESS_MS = 380;

export default class InputHandler {
  engine = null;
  drag = null;
  touchStart = null;
  materialTouch = null;
  materialFloat = null;
  editorDrag = null;
  editorTouch = null;
  scrollStartY = null;
  scrolling = false;
  needsRender = true;
  onChange = null;

  constructor(engine, onChange) {
    this.engine = engine;
    this.onChange = onChange;
    wx.onTouchStart(this.onTouchStart.bind(this));
    wx.onTouchMove(this.onTouchMove.bind(this));
    wx.onTouchEnd(this.onTouchEnd.bind(this));
    wx.onTouchCancel(this.onTouchEnd.bind(this));
  }

  getLayout() {
    const sel = this.engine.selectedId != null ? this.engine.getPiece(this.engine.selectedId) : null;
    const showLayer = !!(sel && sel.placed);
    const hintLeft = PuzzleEngine.MAX_HINTS - this.engine.hintsUsed;
    const hintLabel = hintLeft > 0 ? `提示 (${hintLeft})` : '提示 (0)';
    let layout = computeLayout(this.engine.materialScroll, showLayer, hintLabel);
    const max = materialMaxScroll(layout, this.engine.unplacedPieces().length);
    if (this.engine.materialScroll > max) {
      this.engine.materialScroll = max;
      layout = computeLayout(this.engine.materialScroll, showLayer, hintLabel);
    }
    return layout;
  }

  markDirty() {
    this.needsRender = true;
    if (this.onChange) this.onChange();
  }

  touchXY(t) {
    return { x: t.x != null ? t.x : t.clientX, y: t.y != null ? t.y : t.clientY };
  }

  onTouchStart(e) {
    const t = e.touches[0];
    const { x, y } = this.touchXY(t);
    if (this.engine.screen === 'editor') {
      this.onEditorTouchStart(x, y);
      return;
    }
    if (this.engine.screen === 'rank') {
      if (hitTestRank(x, y) === 'rankBack') this.engine.closeRank();
      this.markDirty();
      return;
    }
    if (this.engine.screen === 'menu') {
      const hit = hitTestMenu(this.engine, x, y);
      if (hit === 'continue') this.engine.continueGame();
      else if (hit === 'newGame') this.engine.newGame();
      else if (hit === 'rank') this.engine.openRank();
      else if (hit === 'share') this.engine.shareGame();
      else if (hit === 'editor') this.engine.editor.open();
      this.markDirty();
      return;
    }
    this.scrolling = false;
    this.scrollStartY = null;
    this.materialTouch = null;
    this.materialFloat = null;
    const layout = this.getLayout();

    if (x < layout.leftW) {
      const modalHit = this.engine.modal ? hitTestModal(this.engine, x, y) : null;
      if (modalHit) {
        this.handleModal(modalHit);
        this.markDirty();
        return;
      }
      if (this.engine.modal) return;
      const btn = hitTestButtons(layout, x, y);
      if (btn) {
        this.handleButton(btn);
        this.markDirty();
        return;
      }
      this.engine.clearSelect();
      this.markDirty();
      return;
    }

    const modalHit = hitTestModal(this.engine, x, y);
    if (modalHit) {
      this.handleModal(modalHit);
      this.markDirty();
      return;
    }
    if (this.engine.modal) return;

    const btn = hitTestButtons(layout, x, y);
    if (btn) {
      this.handleButton(btn);
      this.markDirty();
      return;
    }

    const placed = this.findPlacedAt(layout, x, y);
    if (placed) {
      this.touchStart = { x, y, pieceId: placed.id, source: 'board', origGx: placed.gridX, origGy: placed.gridY };
      this.engine.select(placed.id);
      this.markDirty();
      return;
    }

    const unplaced = this.engine.unplacedPieces();
    const matIdx = materialIndexAt(layout, unplaced, x, y);
    if (matIdx >= 0) {
      const piece = unplaced[matIdx];
      const slot = materialSlotRect(layout, matIdx);
      const dc = layout.material.displayCell;
      const b = shapeBounds(piece.cells);
      const ox = slot.x + (slot.w - b.w * dc) / 2;
      const oy = slot.y + (slot.h - b.h * dc) / 2;
      const grab = this.grabOffset(piece.cells, dc, ox, oy, x, y);
      this.materialTouch = {
        x, y, pieceId: piece.id,
        grabDx: x - slot.x, grabDy: y - slot.y,
        grabOx: grab.ox, grabOy: grab.oy,
        slotW: slot.w, slotH: slot.h, displayCell: dc,
        scroll: this.engine.materialScroll, time: Date.now(),
      };
      return;
    }

    if (x >= layout.board.x && x <= layout.board.x + layout.board.size && y >= layout.board.y && y <= layout.board.y + layout.board.size) {
      this.engine.clearSelect();
      this.markDirty();
      return;
    }

    if (x >= layout.material.x && x <= layout.material.x + layout.material.w && y >= layout.material.y && y <= layout.material.y + layout.material.h) {
      this.scrollStartY = { x, y, scroll: this.engine.materialScroll };
      this.scrolling = false;
    } else {
      this.engine.clearSelect();
      this.markDirty();
    }
  }

  onTouchMove(e) {
    const t = e.touches[0];
    const { x, y } = this.touchXY(t);
    if (this.engine.screen === 'editor') {
      this.onEditorTouchMove(x, y);
      return;
    }
    const layout = this.getLayout();

    if (this.materialTouch && !this.drag && !this.materialFloat) {
      const mt = this.materialTouch;
      const dist = Math.hypot(x - mt.x, y - mt.y);
      if (dist >= SCROLL_THRESHOLD) {
        this.scrolling = true;
        const maxScroll = materialMaxScroll(layout, this.engine.unplacedPieces().length);
        this.engine.materialScroll = Math.min(maxScroll, Math.max(0, mt.scroll + (mt.y - y)));
        this.scrollStartY = { x, y, scroll: this.engine.materialScroll };
        this.materialTouch = null;
        this.markDirty();
        return;
      }
      if (Date.now() - mt.time >= LONG_PRESS_MS) {
        wx.vibrateShort({ type: 'light' });
        this.materialFloat = {
          pieceId: mt.pieceId,
          x, y,
          grabDx: mt.grabDx, grabDy: mt.grabDy,
          grabOx: mt.grabOx, grabOy: mt.grabOy,
          slotW: mt.slotW, slotH: mt.slotH, displayCell: mt.displayCell,
          startX: mt.x, startY: mt.y,
        };
        this.materialTouch = null;
        this.markDirty();
        return;
      }
      return;
    }

    if (this.materialFloat && !this.drag) {
      this.materialFloat.x = x;
      this.materialFloat.y = y;
      const dist = Math.hypot(x - this.materialFloat.startX, y - this.materialFloat.startY);
      if (dist >= 2) {
        const f = this.materialFloat;
        this.drag = {
          active: true,
          pieceId: f.pieceId,
          source: 'material',
          x, y,
          grabDx: f.grabDx, grabDy: f.grabDy,
          grabOx: f.grabOx, grabOy: f.grabOy,
          slotW: f.slotW, slotH: f.slotH, displayCell: f.displayCell,
          boardBlend: 0, animCell: f.displayCell,
          overBoard: false, previewGx: null, previewGy: null,
        };
        this.materialFloat = null;
        this.updateMaterialDrag(layout, x, y);
      }
      this.markDirty();
      return;
    }

    if (this.drag && this.drag.source === 'material') {
      this.updateMaterialDrag(layout, x, y);
      this.markDirty();
      return;
    }

    if (this.scrollStartY && !this.drag && !this.touchStart) {
      const dy = this.scrollStartY.y - y;
      if (!this.scrolling && Math.abs(dy) < SCROLL_THRESHOLD) return;
      this.scrolling = true;
      const maxScroll = materialMaxScroll(layout, this.engine.unplacedPieces().length);
      this.engine.materialScroll = Math.min(maxScroll, Math.max(0, this.scrollStartY.scroll + dy));
      this.markDirty();
      return;
    }

    if (this.drag) {
      const piece = this.engine.getPiece(this.drag.pieceId);
      this.drag.x = x;
      this.drag.y = y;
      const snap = snapPieceGrid(layout, x, y, this.drag.grabOx, this.drag.grabOy, piece.cells);
      this.drag.overBoard = snap.over;
      this.drag.previewGx = snap.over ? snap.gx : null;
      this.drag.previewGy = snap.over ? snap.gy : null;
      this.markDirty();
      return;
    }

    if (!this.touchStart) return;

    const dist = Math.hypot(x - this.touchStart.x, y - this.touchStart.y);
    if (dist >= DRAG_THRESHOLD && this.touchStart.source === 'board') {
      wx.vibrateShort({ type: 'light' });
      const piece = this.engine.getPiece(this.touchStart.pieceId);
      const pos = gridToBoard(layout, piece.gridX, piece.gridY);
      const grab = this.grabOffset(piece.cells, layout.board.cell, pos.x, pos.y, this.touchStart.x, this.touchStart.y);
      this.drag = {
        active: true,
        pieceId: this.touchStart.pieceId,
        source: 'board',
        x, y,
        grabOx: grab.ox, grabOy: grab.oy,
        origGx: this.touchStart.origGx, origGy: this.touchStart.origGy,
        overBoard: false, previewGx: null, previewGy: null,
      };
      this.markDirty();
    }
  }

  updateMaterialDrag(layout, x, y) {
    const drag = this.drag;
    const piece = this.engine.getPiece(drag.pieceId);
    drag.x = x;
    drag.y = y;
    const snap = snapPieceGrid(layout, x, y, drag.grabOx, drag.grabOy, piece.cells);
    drag.overBoard = snap.over;
    drag.previewGx = snap.over ? snap.gx : null;
    drag.previewGy = snap.over ? snap.gy : null;
    this.tickMaterialAnim(layout);
  }

  tickMaterialAnim(layout) {
    const drag = this.drag;
    if (!drag || drag.source !== 'material') return false;
    let dirty = false;
    const targetBlend = drag.overBoard ? 1 : 0;
    drag.boardBlend = drag.boardBlend ?? 0;
    const nb = drag.boardBlend + (targetBlend - drag.boardBlend) * 0.28;
    if (Math.abs(nb - drag.boardBlend) > 0.005) {
      drag.boardBlend = nb;
      dirty = true;
    }
    drag.animCell = drag.animCell ?? drag.displayCell;
    const targetCell = drag.overBoard ? layout.board.cell : drag.displayCell;
    const nc = drag.animCell + (targetCell - drag.animCell) * 0.28;
    if (Math.abs(nc - drag.animCell) > 0.05) {
      drag.animCell = nc;
      dirty = true;
    }
    return dirty;
  }

  onTouchEnd(e) {
    const t = e.changedTouches[0];
    const { x, y } = this.touchXY(t);
    if (this.engine.screen === 'editor') {
      this.onEditorTouchEnd(x, y);
      return;
    }

    if (this.drag) {
      const layout = this.getLayout();
      const piece = this.engine.getPiece(this.drag.pieceId);
      const snap = snapPieceGrid(layout, x, y, this.drag.grabOx, this.drag.grabOy, piece.cells);
      if (snap.over) {
        if (this.drag.source === 'material') {
          this.engine.placeFromMaterial(piece, snap.gx, snap.gy);
        } else {
          this.engine.movePlaced(piece, snap.gx, snap.gy);
        }
      } else if (this.drag.source === 'board') {
        piece.gridX = this.drag.origGx;
        piece.gridY = this.drag.origGy;
      }
      this.engine.clearSelect();
      this.drag = null;
      this.touchStart = null;
      this.materialTouch = null;
      this.materialFloat = null;
      this.scrollStartY = null;
      this.scrolling = false;
      this.markDirty();
      return;
    }

    if (this.materialFloat) {
      this.materialFloat = null;
      this.markDirty();
      return;
    }

    if (this.touchStart && this.touchStart.source === 'board') {
      const dist = Math.hypot(x - this.touchStart.x, y - this.touchStart.y);
      if (dist < DRAG_THRESHOLD) {
        this.engine.select(this.touchStart.pieceId);
      }
    }

    this.touchStart = null;
    this.materialTouch = null;
    this.materialFloat = null;
    this.scrollStartY = null;
    this.scrolling = false;
    this.markDirty();
  }

  grabOffset(cells, cell, ox, oy, x, y) {
    for (const [cx, cy] of cells) {
      const px = ox + cx * cell;
      const py = oy + cy * cell;
      if (x >= px && x < px + cell && y >= py && y < py + cell) {
        return { ox: cx + (x - px) / cell, oy: cy + (y - py) / cell };
      }
    }
    return { ox: 0, oy: 0 };
  }

  findPlacedAt(layout, x, y) {
    const g = boardToGrid(layout, x, y);
    if (!g) return null;
    const placed = [...this.engine.placedPieces()].sort((a, b) => b.z - a.z);
    for (const p of placed) {
      for (const [dx, dy] of p.cells) {
        if (p.gridX + dx === g.gx && p.gridY + dy === g.gy) return p;
      }
    }
    return null;
  }

  handleButton(btn) {
    const sel = this.engine.selectedId != null ? this.engine.getPiece(this.engine.selectedId) : null;
    switch (btn) {
      case 'layerUp':
        if (sel) this.engine.layerUp(sel);
        break;
      case 'layerDown':
        if (sel) this.engine.layerDown(sel);
        break;
      case 'recall':
        if (sel) this.engine.recall(sel);
        break;
      case 'cancel':
        this.engine.clearSelect();
        break;
      case 'reset':
        this.engine.requestReset();
        break;
      case 'submit':
        this.engine.submit();
        break;
      case 'home':
        this.engine.requestExitToMenu();
        break;
      case 'hint':
        this.engine.useHint();
        break;
      default:
        break;
    }
  }

  onEditorTouchStart(x, y) {
    const ed = this.engine.editor;
    this.editorDrag = null;
    this.editorTouch = null;
    if (ed.modal) {
      if (hitTestEditorModal(ed, x, y) === 'dismiss') ed.modal = null;
      this.markDirty();
      return;
    }
    const layout = computeEditorLayout(ed);
    const hit = hitTestEditor(layout, x, y);
    if (hit === 'edBack') ed.close();
    else if (hit === 'edClear') ed.clearAll();
    else if (hit === 'edDecoy') ed.addDecoy();
    else if (hit === 'edDel') ed.removeSelected();
    else if (hit === 'edSave') ed.saveLevel();
    else if (hit === 'edTest') ed.testPlay();
    else if (hit === 'edShare') ed.shareLevel();
    else if (hit === 'edLayerUp' && ed.selectedId != null) ed.layerUp(ed.selectedId);
    else if (hit === 'edLayerDown' && ed.selectedId != null) ed.layerDown(ed.selectedId);
    else if (hit === 'shapePrev') ed.cycleShape(-1);
    else if (hit === 'shapeNext') ed.cycleShape(1);
    else if (hit === 'colorPrev') ed.cycleColor(-1);
    else if (hit === 'colorNext') ed.cycleColor(1);
    else if (hit === 'preview') {
      const cells = SHAPES[ed.shapeIdx].map((c) => [...c]);
      const color = COLORS[ed.colorIdx];
      const pv = layout.preview;
      const b = shapeBounds(cells);
      const ox = pv.x + (pv.size - b.w * pv.cell) / 2;
      const oy = pv.y + (pv.size - b.h * pv.cell) / 2;
      const grab = this.grabOffset(cells, pv.cell, ox, oy, x, y);
      this.editorTouch = {
        source: 'palette',
        x, y,
        cells,
        color,
        grabOx: grab.ox,
        grabOy: grab.oy,
      };
    } else {
      const g = ed.boardToGrid(layout, x, y);
      if (g) {
        const found = ed.findPieceAt(g.gx, g.gy);
        if (found) {
          ed.selectedId = found.id;
          const posX = layout.board.x + found.gridX * layout.board.cell;
          const posY = layout.board.y + found.gridY * layout.board.cell;
          const grab = this.grabOffset(found.cells, layout.board.cell, posX, posY, x, y);
          this.editorTouch = {
            source: 'board',
            x, y,
            pieceId: found.id,
            cells: found.cells,
            color: found.color,
            grabOx: grab.ox,
            grabOy: grab.oy,
            origGx: found.gridX,
            origGy: found.gridY,
          };
        } else {
          ed.selectedId = null;
        }
      }
    }
    this.markDirty();
  }

  onEditorTouchMove(x, y) {
    const ed = this.engine.editor;
    const layout = computeEditorLayout(ed);
    if (this.editorTouch && !this.editorDrag) {
      const dist = Math.hypot(x - this.editorTouch.x, y - this.editorTouch.y);
      if (dist >= DRAG_THRESHOLD) {
        wx.vibrateShort({ type: 'light' });
        const t = this.editorTouch;
        this.editorDrag = {
          active: true,
          source: t.source,
          pieceId: t.pieceId,
          cells: t.cells,
          color: t.color,
          grabOx: t.grabOx,
          grabOy: t.grabOy,
          origGx: t.origGx,
          origGy: t.origGy,
          x, y,
          over: false,
          previewGx: null,
          previewGy: null,
        };
        this.editorTouch = null;
      }
    }
    if (this.editorDrag) {
      const d = this.editorDrag;
      d.x = x;
      d.y = y;
      const snap = editorSnapGrid(layout, x, y, d.grabOx, d.grabOy, d.cells);
      d.over = snap.over;
      d.previewGx = snap.over ? snap.gx : null;
      d.previewGy = snap.over ? snap.gy : null;
      this.markDirty();
    }
  }

  onEditorTouchEnd(x, y) {
    const ed = this.engine.editor;
    if (this.editorDrag) {
      const d = this.editorDrag;
      const layout = computeEditorLayout(ed);
      const snap = editorSnapGrid(layout, x, y, d.grabOx, d.grabOy, d.cells);
      if (snap.over) {
        if (d.source === 'palette') ed.placeShape(snap.gx, snap.gy);
        else if (d.source === 'board') ed.movePiece(d.pieceId, snap.gx, snap.gy);
      }
      this.editorDrag = null;
      this.editorTouch = null;
      this.markDirty();
      return;
    }
    if (this.editorTouch && this.editorTouch.source === 'board') {
      const dist = Math.hypot(x - this.editorTouch.x, y - this.editorTouch.y);
      if (dist < DRAG_THRESHOLD) ed.selectedId = this.editorTouch.pieceId;
    }
    this.editorTouch = null;
    this.editorDrag = null;
    this.markDirty();
  }

  clearTouchState() {
    this.drag = null;
    this.touchStart = null;
    this.materialTouch = null;
    this.materialFloat = null;
    this.editorDrag = null;
    this.editorTouch = null;
    this.scrollStartY = null;
    this.scrolling = false;
  }

  handleModal(hit) {
    switch (hit) {
      case 'confirmYes':
        this.engine.confirmReset();
        break;
      case 'confirmNo':
        this.engine.dismissModal();
        break;
      case 'exitYes':
        this.engine.confirmExitToMenu();
        this.clearTouchState();
        break;
      case 'exitNo':
        this.engine.dismissModal();
        break;
      case 'nextLevel':
        this.engine.nextLevel();
        break;
      case 'customBack':
      case 'sharedBack':
        this.engine.returnFromCustom();
        break;
      case 'dismiss':
        if (this.engine.allClear) this.engine.loadLevel(1);
        else this.engine.dismissModal();
        break;
      default:
        break;
    }
  }
}
