const canvas = wx.createCanvas();
GameGlobal.canvas = canvas;

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const pixelRatio = windowInfo.pixelRatio || 1;

export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;
export const PIXEL_RATIO = pixelRatio;

canvas.width = SCREEN_WIDTH * pixelRatio;
canvas.height = SCREEN_HEIGHT * pixelRatio;

const ctx = canvas.getContext('2d');
ctx.scale(pixelRatio, pixelRatio);

export { canvas, ctx };
