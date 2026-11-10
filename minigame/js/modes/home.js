'use strict';

/* ============================================================================
 * modes/home.js — 首页：两个入口
 * ==========================================================================*/

var T = require('../theme.js');

function createHomeMode(app) {
  var platform = app.platform;
  var W = platform.W;
  var H = platform.H;
  var s = platform.scale;

  function drawBackdrop() {
    app.host.drawBackdrop(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fdf3e3');
      g.addColorStop(0.45, '#f7dfbb');
      g.addColorStop(1, '#e8c496');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      var rg = ctx.createRadialGradient(w * 0.5, h * 0.04, 8, w * 0.5, h * 0.04, h * 0.62);
      rg.addColorStop(0, 'rgba(255,241,205,0.9)');
      rg.addColorStop(1, 'rgba(255,241,205,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w * 0.5, -h * 0.03);
      ctx.fillStyle = 'rgba(238,177,61,0.055)';
      for (var i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 6 + 0.16);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-w * 0.055, h * 0.95);
        ctx.lineTo(w * 0.055, h * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      var bg2 = ctx.createLinearGradient(0, h * 0.66, 0, h);
      bg2.addColorStop(0, 'rgba(120,80,40,0)');
      bg2.addColorStop(1, 'rgba(120,80,40,0.14)');
      ctx.fillStyle = bg2;
      ctx.fillRect(0, h * 0.66, w, h * 0.34);
    });
  }

  function spaced(ctx, str, cx, y, size, spacing, color, weight) {
    ctx.font = T.font(size, weight || 500);
    var total = 0;
    var widths = [];
    for (var i = 0; i < str.length; i++) {
      var w = ctx.measureText(str.charAt(i)).width;
      widths.push(w);
      total += w + spacing;
    }
    total -= spacing;
    var x = cx - total / 2;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (var j = 0; j < str.length; j++) {
      ctx.fillText(str.charAt(j), x, y);
      x += widths[j] + spacing;
    }
  }

  function drawCard(ctx, pal, x, y, w, h, opt) {
    ctx.fillStyle = 'rgba(108,62,22,0.07)';
    T.roundPath(ctx, x, y + 3 * s, w, h, 18 * s);
    ctx.fill();
    T.fillRound(ctx, x, y, w, h, 18 * s, pal.card);
    T.strokeRound(ctx, x, y, w, h, 18 * s, pal.cardBorder, 1);

    var r = 25 * s;
    var cx = x + 22 * s + r;
    var cy = y + h / 2;
    ctx.fillStyle = opt.tint;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    opt.icon(ctx, cx, cy, r * 0.62);
    ctx.restore();

    var tx = cx + r + 16 * s;
    T.text(ctx, opt.title, tx, cy - 18 * s, 16.5 * s, pal.ink, 600);
    var lines = T.wrapText(ctx, opt.desc, w - (tx - x) - 42 * s, 11.5 * s, 400);
    var n = Math.min(2, lines.length);
    for (var i = 0; i < n; i++) {
      T.text(ctx, lines[i], tx, cy + 3 * s + i * 16 * s, 11.5 * s, pal.muted, 400);
    }
    T.text(ctx, opt.tag, tx, y + h - 14 * s, 10.5 * s, pal.faint, 400);

    T.iconChevron(ctx, x + w - 22 * s, cy, 9 * s, pal.faint);
  }

  function enter() {
    drawBackdrop();
    app.requestDraw();
  }

  function leave() {}

  function update() {}

  function drawUI(ui) {
    var ctx = ui.begin();
    var pal = T.palette(false);
    var contentW = Math.min(W - 32 * s, 520);
    var left = (W - contentW) / 2;

    var y = platform.safeTop + 22 * s;
    spaced(ctx, 'SUNFLOWER & EMOTION', W / 2, y + 10 * s, 9.5 * s, 3 * s, pal.faint, 500);
    y += 42 * s;

    var size = 32 * s;
    var t1 = '向日葵和';
    var t2 = '情绪向日葵';
    ctx.font = T.font(size, 600);
    var w1 = ctx.measureText(t1).width;
    var w2 = ctx.measureText(t2).width;
    var sx = W / 2 - (w1 + w2) / 2;
    T.text(ctx, t1, sx, y + size * 0.8, size, pal.ink, 600);
    T.text(ctx, t2, sx + w1, y + size * 0.8, size, pal.gold, 600);
    y += size * 0.8 + 20 * s;

    var sub = T.wrapText(ctx, '一株能切片打印的立体向日葵，一盆会看脸色的情绪向日葵。', contentW - 28 * s, 12.5 * s, 400);
    for (var i = 0; i < sub.length; i++) {
      T.text(ctx, sub[i], W / 2, y + i * 18 * s, 12.5 * s, pal.muted, 400, 'center');
    }
    y += sub.length * 18 * s + 24 * s;

    var gap = 14 * s;
    var cardH = 118 * s;

    drawCard(ctx, pal, left, y, contentW, cardH, {
      title: '情绪向日葵',
      desc: '浇水、晒太阳、摸摸、说说话，它会按心情回应你。',
      tag: '六种情绪 · 本地存档 · 每天来看它',
      tint: 'rgba(238,177,61,0.26)',
      icon: function (c, cx, cy, r) {
        T.iconFace(c, cx, cy, r, '#3a2a1b', 'rgba(239,127,122,0.75)');
      }
    });
    ui.hit(left, y, contentW, cardH, function () { app.switchMode('emotion'); });
    y += cardH + gap;

    drawCard(ctx, pal, left, y, contentW, cardH, {
      title: '向日葵三维模型',
      desc: '旋转、缩放，看花瓣、花盘与叶片的细节。',
      tag: '98,076 三角面 · 9 个部件',
      tint: 'rgba(120,150,85,0.24)',
      icon: function (c, cx, cy, r) {
        T.iconFlower(c, cx, cy, r, '#e7a92e', '#5b3a1e');
      }
    });
    ui.hit(left, y, contentW, cardH, function () { app.switchMode('viewer'); });
    var cardsBottom = y + cardH;

    /* 高屏补一点留白装饰；矮屏自动省略 */
    if (H - platform.safeBottom - cardsBottom > 118 * s) {
      var decoY = Math.max(cardsBottom + 34 * s, H - platform.safeBottom - 92 * s);
      T.iconFlower(ctx, W / 2, decoY, 15 * s, 'rgba(238,177,61,0.5)', 'rgba(91,58,30,0.42)');
      T.text(ctx, '每一次照顾，都会被记住', W / 2, decoY + 30 * s, 11 * s, pal.faint, 400, 'center');
    }

    var footY = H - platform.safeBottom - 24 * s;
    T.text(ctx, '《向日葵和情绪向日葵》· 单机离线', W / 2, footY, 10 * s, pal.faint, 400, 'center');
    T.text(ctx, '网页版：luoxiaomin25-star.github.io/xiangrikui', W / 2, footY + 13 * s, 9 * s, pal.faint, 400, 'center');

    ui.end();
  }

  return {
    name: 'home',
    enter: enter,
    leave: leave,
    update: update,
    drawUI: drawUI,
    touchStart: function () {},
    touchMove: function () {},
    touchEnd: function () {}
  };
}

module.exports = { createHomeMode: createHomeMode };
