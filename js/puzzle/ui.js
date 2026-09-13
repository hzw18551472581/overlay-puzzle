export const C = {
  bg: '#0a0b14',
  bgMid: '#121428',
  panel: '#10121f',
  panelEdge: 'rgba(120,140,220,0.12)',
  card: '#171a2c',
  cardBorder: 'rgba(255,255,255,0.08)',
  gridEmpty: '#1e2032',
  text: '#f2f4fa',
  textSub: '#8a92a8',
  accent: '#6ea8ff',
  gold: '#f0c14a',
  submit: '#2fd67b',
  submitDeep: '#1f9e5a',
  btn: '#252b40',
  btnDeep: '#1a1f30',
};

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawAtmosphere(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 20, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#1a2040');
  g.addColorStop(0.45, '#101428');
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(w * 0.85, h * 0.8, 10, w * 0.85, h * 0.8, w * 0.4);
  g2.addColorStop(0, 'rgba(47,214,123,0.08)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
}

export function drawBtn(ctx, btn) {
  const r = btn.r == null ? 12 : btn.r;
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, r);
  let fill;
  if (btn.primary) {
    fill = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    fill.addColorStop(0, '#3ee88f');
    fill.addColorStop(1, C.submitDeep);
  } else if (btn.active) {
    fill = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    fill.addColorStop(0, '#f6d36a');
    fill.addColorStop(1, '#c99520');
  } else {
    fill = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
    fill.addColorStop(0, '#2d3450');
    fill.addColorStop(1, C.btnDeep);
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = btn.primary
    ? 'rgba(255,255,255,0.22)'
    : btn.active
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (btn.primary || btn.active) {
    ctx.save();
    roundRect(ctx, btn.x + 1, btn.y + 1, btn.w - 2, Math.max(4, btn.h * 0.38), r - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${btn.fontSize || (btn.w > 100 ? 14 : 13)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
}

export function drawCard(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#1c2036');
  g.addColorStop(1, '#141828');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawSoftPanel(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#0e101c');
  g.addColorStop(1, '#121526');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
