import { SCREEN_WIDTH, SCREEN_HEIGHT, PIXEL_RATIO } from '../render';

export const RANK_KEY = 'totalStars';

let odc = null;

function getODC() {
  if (!odc && typeof wx.getOpenDataContext === 'function') {
    odc = wx.getOpenDataContext();
  }
  return odc;
}

export function syncRankData(engine) {
  if (typeof wx.setUserCloudStorage !== 'function') return;
  const stars = engine.totalStars();
  const level = engine.savedLevel || engine.level || 1;
  wx.setUserCloudStorage({
    KVDataList: [{ key: RANK_KEY, value: JSON.stringify({ stars, level }) }],
    fail() {},
  });
}

export function requestRankRender() {
  const context = getODC();
  if (!context) return;
  const canvas = context.canvas;
  canvas.width = SCREEN_WIDTH * PIXEL_RATIO;
  canvas.height = SCREEN_HEIGHT * PIXEL_RATIO;
  context.postMessage({
    type: 'render',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    dpr: PIXEL_RATIO,
  });
}

export function getSharedCanvas() {
  const context = getODC();
  return context ? context.canvas : null;
}

export function shareTitle(engine) {
  const stars = engine.totalStars();
  const level = engine.savedLevel || engine.level || 1;
  if (stars > 0) {
    return `我在叠影拼图获得 ${stars} 星，已到第 ${level} 关，来挑战！`;
  }
  return '叠影拼图 — 叠放碎片还原图案，来挑战！';
}
