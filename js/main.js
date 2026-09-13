import { ctx } from './render';
import PuzzleEngine from './puzzle/engine';
import InputHandler from './puzzle/input';
import { renderGame, renderMenu } from './puzzle/render';

export default class Main {
  aniId = 0;

  constructor() {
    this.engine = new PuzzleEngine();
    this.input = new InputHandler(this.engine, () => {
      this.input.needsRender = true;
    });
    this.input.needsRender = true;
    this.loop();
  }

  loop() {
    const dragging = this.input.drag && this.input.drag.active;
    const floating = !!this.input.materialFloat;
    const matAnim = dragging && this.input.drag.source === 'material'
      && this.input.tickMaterialAnim(this.input.getLayout());
    if (this.input.needsRender || dragging || floating || matAnim) {
      if (this.engine.screen === 'menu') renderMenu(ctx, this.engine);
      else renderGame(ctx, this.engine, this.input.drag, this.input.materialFloat);
      if (!dragging && !floating && !matAnim) this.input.needsRender = false;
    }
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
