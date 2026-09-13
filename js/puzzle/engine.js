import { generateLevel, TOTAL_LEVELS, GRID } from './levelGen';
import { cellsAt } from './shapes';

const SAVE_KEY = 'stackpuzzle_save';

export default class PuzzleEngine {
  screen = 'menu';
  level = 1;
  answer = null;
  pieces = [];
  selectedId = null;
  materialScroll = 0;
  modal = null;
  pendingReset = false;
  pendingExit = false;
  allClear = false;
  savedLevel = null;
  savedState = null;

  constructor() {
    const save = wx.getStorageSync(SAVE_KEY);
    if (save && save.level >= 1 && save.level <= TOTAL_LEVELS) {
      this.savedLevel = save.level;
      this.savedState = save;
    }
  }

  saveProgress() {
    const data = {
      level: this.level,
      materialScroll: this.materialScroll,
      pieces: this.pieces.map((p) => ({
        id: p.id,
        placed: p.placed,
        gridX: p.gridX,
        gridY: p.gridY,
        z: p.z,
      })),
    };
    wx.setStorageSync(SAVE_KEY, data);
    this.savedLevel = this.level;
    this.savedState = data;
  }

  restoreState(save) {
    this.loadLevel(save.level, false);
    save.pieces.forEach((sp) => {
      const p = this.getPiece(sp.id);
      if (!p) return;
      p.placed = sp.placed;
      p.gridX = sp.gridX;
      p.gridY = sp.gridY;
      p.z = sp.z;
    });
    this.materialScroll = save.materialScroll || 0;
    this.saveProgress();
  }

  continueGame() {
    this.screen = 'game';
    if (this.savedState && this.savedState.pieces) {
      this.restoreState(this.savedState);
    } else {
      this.loadLevel(this.savedLevel || 1);
    }
  }

  newGame() {
    wx.removeStorageSync(SAVE_KEY);
    this.savedLevel = null;
    this.savedState = null;
    this.screen = 'game';
    this.loadLevel(1);
  }

  loadLevel(level, save = true) {
    this.level = level;
    const data = generateLevel(level);
    this.answer = data.answer;
    this.pieces = data.pieces.map((p) => ({ ...p, placed: false, gridX: 0, gridY: 0, z: 0 }));
    this.selectedId = null;
    this.modal = null;
    this.pendingReset = false;
    this.pendingExit = false;
    this.allClear = false;
    if (save) this.saveProgress();
  }

  unplacedPieces() {
    return this.pieces.filter((p) => !p.placed);
  }

  placedPieces() {
    return this.pieces.filter((p) => p.placed);
  }

  placedCount() {
    return this.placedPieces().length;
  }

  getPiece(id) {
    return this.pieces.find((p) => p.id === id);
  }

  select(id) {
    this.selectedId = id;
  }

  clearSelect() {
    this.selectedId = null;
  }

  canPlace(piece, gx, gy) {
    for (const [x, y] of cellsAt(piece.cells, gx, gy)) {
      if (x < 0 || x >= GRID || y < 0 || y >= GRID) return false;
    }
    return true;
  }

  placeFromMaterial(piece, gx, gy) {
    if (!this.canPlace(piece, gx, gy)) return false;
    piece.placed = true;
    piece.gridX = gx;
    piece.gridY = gy;
    piece.z = this.nextZ();
    this.selectedId = null;
    return true;
  }

  movePlaced(piece, gx, gy) {
    if (!this.canPlace(piece, gx, gy)) return false;
    piece.gridX = gx;
    piece.gridY = gy;
    this.selectedId = null;
    return true;
  }

  recall(piece) {
    piece.placed = false;
    piece.gridX = 0;
    piece.gridY = 0;
    piece.z = 0;
    this.selectedId = null;
  }

  nextZ() {
    const placed = this.placedPieces();
    if (!placed.length) return 0;
    return Math.max(...placed.map((p) => p.z)) + 1;
  }

  layerUp(piece) {
    const placed = [...this.placedPieces()].sort((a, b) => a.z - b.z);
    const idx = placed.findIndex((p) => p.id === piece.id);
    if (idx < 0 || idx >= placed.length - 1) return;
    const upper = placed[idx + 1];
    const tmp = piece.z;
    piece.z = upper.z;
    upper.z = tmp;
  }

  layerDown(piece) {
    const placed = [...this.placedPieces()].sort((a, b) => a.z - b.z);
    const idx = placed.findIndex((p) => p.id === piece.id);
    if (idx <= 0) return;
    const lower = placed[idx - 1];
    const tmp = piece.z;
    piece.z = lower.z;
    lower.z = tmp;
  }

  resultGrid() {
    const grid = Array.from({ length: GRID }, () => Array(GRID).fill(null));
    [...this.placedPieces()].sort((a, b) => a.z - b.z).forEach((p) => {
      cellsAt(p.cells, p.gridX, p.gridY).forEach(([x, y]) => {
        grid[y][x] = p.color;
      });
    });
    return grid;
  }

  submit() {
    const result = this.resultGrid();
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (result[y][x] !== this.answer[y][x]) {
          this.modal = { type: 'fail', title: '未通过', msg: '图案不一致，请继续调整' };
          return;
        }
      }
    }
    if (this.level >= TOTAL_LEVELS) {
      this.modal = { type: 'win', title: '全部通关', msg: '恭喜你完成所有关卡！' };
      this.allClear = true;
    } else {
      this.modal = { type: 'pass', title: '过关！', msg: `第 ${this.level} 关完成` };
    }
  }

  nextLevel() {
    if (this.allClear) {
      this.level = 1;
      this.allClear = false;
    } else {
      this.level = Math.min(TOTAL_LEVELS, this.level + 1);
    }
    this.loadLevel(this.level);
  }

  requestReset() {
    this.pendingReset = true;
    this.modal = { type: 'confirm', title: '重置', msg: '清空本关已放置的碎片？' };
  }

  confirmReset() {
    this.placedPieces().forEach((p) => this.recall(p));
    this.pendingReset = false;
    this.modal = null;
    this.selectedId = null;
    this.saveProgress();
  }

  requestExitToMenu() {
    this.pendingExit = true;
    this.modal = { type: 'exit', title: '返回主界面', msg: '是否返回主界面？当前进度将保存' };
  }

  confirmExitToMenu() {
    this.saveProgress();
    this.pendingExit = false;
    this.modal = null;
    this.selectedId = null;
    this.materialScroll = 0;
    this.screen = 'menu';
  }

  dismissModal() {
    if (this.pendingReset) this.pendingReset = false;
    if (this.pendingExit) this.pendingExit = false;
    this.modal = null;
  }

}
