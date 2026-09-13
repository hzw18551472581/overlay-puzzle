import { generateLevel, TOTAL_LEVELS, GRID, pieceCountForLevel } from './levelGen';
import { cellsAt } from './shapes';
import { syncRankData, requestRankRender, shareTitle } from './rank';
import LevelEditor from './editor';
import { createRng, shuffle } from './rng';

const SAVE_KEY = 'stackpuzzle_save';
const STARS_KEY = 'stackpuzzle_stars';
const MAX_HINTS = 3;

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function parTimeMs(level) {
  return (90 + level * 12 + pieceCountForLevel(level) * 2) * 1000;
}

export function calcStars(level, timeMs, hintsUsed) {
  const par = parTimeMs(level);
  if (hintsUsed === 0 && timeMs <= par) return 3;
  if (hintsUsed <= 1 && timeMs <= par * 1.5) return 2;
  return 1;
}

export default class PuzzleEngine {
  static MAX_HINTS = MAX_HINTS;

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
  levelTimeMs = 0;
  timerRunningAt = 0;
  timerPaused = false;
  hintsUsed = 0;
  hintFlash = null;
  lastStars = 0;
  editor = null;
  isCustom = false;
  customReturn = null;
  levelLabel = null;
  shareLevelQuery = null;

  constructor() {
    this.editor = new LevelEditor(this);
    const save = wx.getStorageSync(SAVE_KEY);
    if (save && save.level >= 1 && save.level <= TOTAL_LEVELS) {
      this.savedLevel = save.level;
      this.savedState = save;
    }
    syncRankData(this);
  }

  loadStars() {
    return wx.getStorageSync(STARS_KEY) || {};
  }

  getStars(level) {
    return this.loadStars()[String(level)] || 0;
  }

  totalStars() {
    return Object.values(this.loadStars()).reduce((a, b) => a + b, 0);
  }

  recordStars(level, stars) {
    const all = this.loadStars();
    const key = String(level);
    if (!all[key] || stars > all[key]) all[key] = stars;
    wx.setStorageSync(STARS_KEY, all);
    syncRankData(this);
    return all[key];
  }

  openRank() {
    this.screen = 'rank';
    syncRankData(this);
    requestRankRender();
  }

  closeRank() {
    this.screen = 'menu';
  }

  shareGame() {
    if (typeof wx.shareAppMessage !== 'function') return;
    wx.shareAppMessage({ title: shareTitle(this) });
  }

  shareCustomLevel(code) {
    this.shareLevelQuery = code;
    if (typeof wx.shareAppMessage !== 'function') {
      this.editor.modal = { type: 'info', title: '分享', msg: '当前环境不支持分享' };
      return;
    }
    wx.shareAppMessage({
      title: '给你出一道叠影拼图，来解解看！',
      query: `lv=${code}`,
    });
  }

  loadSharedLevel(data) {
    this.loadCustomLevel(data, 'menu');
    this.levelLabel = '好友关卡';
  }

  getShareMessage() {
    if (this.shareLevelQuery) {
      const q = this.shareLevelQuery;
      this.shareLevelQuery = null;
      return { title: '给你出一道叠影拼图，来解解看！', query: `lv=${q}` };
    }
    return { title: shareTitle(this) };
  }

  getLevelTimeMs() {
    if (this.timerPaused) return this.levelTimeMs;
    return this.levelTimeMs + (Date.now() - this.timerRunningAt);
  }

  initLevelTimer() {
    this.levelTimeMs = 0;
    this.timerRunningAt = Date.now();
    this.timerPaused = false;
  }

  pauseTimer() {
    if (this.timerPaused) return;
    this.levelTimeMs = this.getLevelTimeMs();
    this.timerPaused = true;
  }

  resumeTimer() {
    if (!this.timerPaused) return;
    this.timerRunningAt = Date.now();
    this.timerPaused = false;
  }

  showModal(modal) {
    this.pauseTimer();
    this.modal = modal;
  }

  saveProgress() {
    const data = {
      level: this.level,
      materialScroll: this.materialScroll,
      levelTimeMs: this.getLevelTimeMs(),
      hintsUsed: this.hintsUsed,
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
    this.levelTimeMs = save.levelTimeMs || 0;
    this.hintsUsed = save.hintsUsed || 0;
    this.timerRunningAt = Date.now();
    this.timerPaused = false;
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

  loadCustomLevel(data, returnTo) {
    this.isCustom = true;
    this.customReturn = returnTo;
    this.levelLabel = '自定义';
    this.level = 0;
    this.answer = data.answer.map((row) => [...row]);
    let pieces = data.pieces.map((p) => ({
      id: p.id,
      cells: p.cells.map((c) => [...c]),
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
    if (!data.shared) {
      const rng = createRng(Date.now() % 999983);
      shuffle(rng, pieces);
      pieces = pieces.map((p, i) => ({ ...p, id: i }));
    }
    this.pieces = pieces;
    this.selectedId = null;
    this.modal = null;
    this.pendingReset = false;
    this.pendingExit = false;
    this.allClear = false;
    this.hintsUsed = 0;
    this.hintFlash = null;
    this.materialScroll = 0;
    this.initLevelTimer();
    this.screen = 'game';
  }

  returnFromCustom() {
    const dest = this.customReturn;
    this.isCustom = false;
    this.customReturn = null;
    this.levelLabel = null;
    this.modal = null;
    this.selectedId = null;
    this.materialScroll = 0;
    if (dest === 'editor') this.editor.open();
    else this.screen = 'menu';
  }

  loadLevel(level, save = true) {
    this.isCustom = false;
    this.customReturn = null;
    this.levelLabel = null;
    this.level = level;
    const data = generateLevel(level);
    this.answer = data.answer;
    this.pieces = data.pieces.map((p) => ({ ...p, placed: false, gridX: 0, gridY: 0, z: 0 }));
    this.selectedId = null;
    this.modal = null;
    this.pendingReset = false;
    this.pendingExit = false;
    this.allClear = false;
    this.hintsUsed = 0;
    this.hintFlash = null;
    this.initLevelTimer();
    if (save) this.saveProgress();
  }

  useHint() {
    if (this.modal) return null;
    if (this.hintsUsed >= MAX_HINTS) {
      this.showModal({ type: 'info', title: '提示', msg: '本关提示次数已用完' });
      return null;
    }
    const candidates = this.pieces.filter((p) => p.isCorrect && (
      !p.placed || p.gridX !== p.solutionX || p.gridY !== p.solutionY
    ));
    if (!candidates.length) {
      this.showModal({ type: 'info', title: '提示', msg: '所有正确碎片已就位' });
      return null;
    }
    const piece = candidates[0];
    piece.placed = true;
    piece.gridX = piece.solutionX;
    piece.gridY = piece.solutionY;
    piece.z = piece.solutionZ;
    this.hintsUsed += 1;
    this.selectedId = piece.id;
    this.hintFlash = { pieceId: piece.id, until: Date.now() + 3000 };
    this.saveProgress();
    return piece.id;
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
          this.showModal({ type: 'fail', title: '未通过', msg: '图案不一致，请继续调整' });
          return;
        }
      }
    }
    if (this.isCustom) {
      if (this.customReturn === 'editor') {
        this.showModal({ type: 'customPass', title: '试玩通过', msg: '关卡验证成功，可返回继续编辑' });
      } else {
        const timeMs = this.getLevelTimeMs();
        this.showModal({
          type: 'sharedPass',
          title: '解题成功！',
          msg: `用时 ${formatTime(timeMs)}`,
        });
      }
      return;
    }
    const timeMs = this.getLevelTimeMs();
    const stars = calcStars(this.level, timeMs, this.hintsUsed);
    this.lastStars = this.recordStars(this.level, stars);
    if (this.level >= TOTAL_LEVELS) {
      this.allClear = true;
      this.showModal({
        type: 'win',
        title: '全部通关',
        msg: `用时 ${formatTime(timeMs)} · 总星 ${this.totalStars()}`,
        stars,
        timeMs,
      });
    } else {
      this.showModal({
        type: 'pass',
        title: '过关！',
        msg: `第 ${this.level} 关 · 用时 ${formatTime(timeMs)}`,
        stars,
        timeMs,
      });
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
    this.showModal({ type: 'confirm', title: '重置', msg: '清空本关已放置的碎片？' });
  }

  confirmReset() {
    this.placedPieces().forEach((p) => this.recall(p));
    this.pendingReset = false;
    this.modal = null;
    this.selectedId = null;
    this.resumeTimer();
    this.saveProgress();
  }

  requestExitToMenu() {
    this.pendingExit = true;
    if (this.isCustom) {
      const backEditor = this.customReturn === 'editor';
      this.showModal({
        type: 'exit',
        title: backEditor ? '退出试玩' : '退出关卡',
        msg: backEditor ? '返回关卡编辑器？' : '返回主界面？',
      });
      return;
    }
    this.showModal({ type: 'exit', title: '返回主界面', msg: '是否返回主界面？当前进度将保存' });
  }

  confirmExitToMenu() {
    if (this.isCustom) {
      this.pendingExit = false;
      this.returnFromCustom();
      return;
    }
    this.saveProgress();
    this.pendingExit = false;
    this.modal = null;
    this.selectedId = null;
    this.materialScroll = 0;
    this.hintFlash = null;
    this.screen = 'menu';
  }

  dismissModal() {
    if (this.pendingReset) this.pendingReset = false;
    if (this.pendingExit) this.pendingExit = false;
    this.modal = null;
    if (this.screen === 'game') this.resumeTimer();
  }

}
