import { ctx } from './render';
import PuzzleEngine from './puzzle/engine';
import InputHandler from './puzzle/input';
import { renderGame, renderMenu, renderRank } from './puzzle/render';
import { renderEditor } from './puzzle/editor';
import { decodeShareLevel } from './puzzle/levelCodec';

export default class Main {
  aniId = 0;
  lastTimerSec = -1;

  constructor() {
    this.engine = new PuzzleEngine();
    this.input = new InputHandler(this.engine, () => {
      this.input.needsRender = true;
    });
    if (typeof wx.onShareAppMessage === 'function') {
      wx.onShareAppMessage(() => this.engine.getShareMessage());
    }
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    }
    if (typeof wx.onShow === 'function') {
      wx.onShow((res) => {
        if (res.query && res.query.lv) {
          const data = decodeShareLevel(res.query.lv);
          if (data) {
            this.engine.loadSharedLevel(data);
            this.input.needsRender = true;
          }
        }
      });
    }
    this.tryLaunchSharedLevel();
    this.input.needsRender = true;
    this.loop();
  }

  tryLaunchSharedLevel() {
    try {
      const q = wx.getLaunchOptionsSync().query;
      if (q && q.lv) {
        const data = decodeShareLevel(q.lv);
        if (data) this.engine.loadSharedLevel(data);
      }
    } catch (e) {}
  }

  loop() {
    const dragging = this.input.drag && this.input.drag.active;
    const floating = !!this.input.materialFloat;
    const matAnim = dragging && this.input.drag.source === 'material'
      && this.input.tickMaterialAnim(this.input.getLayout());
    let timerTick = false;
    if (this.engine.screen === 'game' && !this.engine.modal) {
      const sec = Math.floor(this.engine.getLevelTimeMs() / 1000);
      if (sec !== this.lastTimerSec) {
        this.lastTimerSec = sec;
        timerTick = true;
      }
    } else {
      this.lastTimerSec = -1;
    }
    const hintAnim = this.engine.hintFlash && Date.now() < this.engine.hintFlash.until;
    const rankView = this.engine.screen === 'rank';
    const editorView = this.engine.screen === 'editor';
    const editorDragging = !!(this.input.editorDrag && this.input.editorDrag.active);
    if (this.input.needsRender || dragging || floating || matAnim || timerTick || hintAnim || rankView || editorView || editorDragging) {
      if (this.engine.screen === 'menu') renderMenu(ctx, this.engine);
      else if (this.engine.screen === 'rank') renderRank(ctx);
      else if (this.engine.screen === 'editor') renderEditor(ctx, this.engine.editor, this.input.editorDrag);
      else renderGame(ctx, this.engine, this.input.drag, this.input.materialFloat);
      if (!dragging && !floating && !matAnim && !timerTick && !hintAnim && !rankView && !editorDragging) {
        this.input.needsRender = false;
      }
    }
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
