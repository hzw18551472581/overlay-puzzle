const KEY = 'totalStars';

function parseStars(user) {
  const kv = (user.KVDataList || []).find((k) => k.key === KEY);
  if (!kv) return 0;
  try {
    return JSON.parse(kv.value).stars || 0;
  } catch (e) {
    return 0;
  }
}

function drawUI(ctx, list, w, h) {
  ctx.fillStyle = '#0d0d18';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#eef0f6';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('好友排行榜', w / 2, 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#8b93a8';
  ctx.fillText('按总星数排名', w / 2, 54);

  const startY = 80;
  const rowH = 34;
  if (!list.length) {
    ctx.fillText('暂无好友数据', w / 2, h / 2 - 20);
    ctx.fillText('分享给好友一起玩吧', w / 2, h / 2 + 4);
    return;
  }
  list.slice(0, 12).forEach((item, i) => {
    const y = startY + i * rowH;
    ctx.textAlign = 'left';
    ctx.fillStyle = i < 3 ? '#f0c040' : '#eef0f6';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(String(i + 1), 28, y);
    ctx.fillStyle = '#eef0f6';
    ctx.font = '13px sans-serif';
    ctx.fillText((item.nickname || '玩家').slice(0, 10), 56, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f0c040';
    ctx.fillText(`${item.stars} 星`, w - 28, y);
  });
}

wx.onMessage((data) => {
  if (data.type !== 'render') return;
  const canvas = wx.getSharedCanvas();
  const ctx = canvas.getContext('2d');
  const dpr = data.dpr || 1;
  canvas.width = data.width * dpr;
  canvas.height = data.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wx.getFriendCloudStorage({
    keyList: [KEY],
    success(res) {
      const list = res.data.map((u) => ({
        nickname: u.nickname,
        stars: parseStars(u),
      })).sort((a, b) => b.stars - a.stars);
      drawUI(ctx, list, data.width, data.height);
    },
    fail() {
      drawUI(ctx, [], data.width, data.height);
    },
  });
});
