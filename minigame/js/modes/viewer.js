'use strict';

/* ============================================================================
 * modes/viewer.js — 向日葵三维模型查看器（小游戏版）
 * ==========================================================================*/

var T = require('../theme.js');
var createViewerScene = require('../viewer-scene.js').createViewerScene;

var VIEWS = [
  { key: 'full', label: '全身' },
  { key: 'head', label: '花头' },
  { key: 'side', label: '侧面' },
  { key: 'back', label: '花托' }
];

function formatNumber(n) {
  return String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function createViewerMode(app) {
  var platform = app.platform;
  var host = app.host;
  var W = platform.W;
  var H = platform.H;
  var s = platform.scale;

  var scene = null;
  var current = 'full';
  var auto = true;

  function ensureScene() {
    if (scene) return;
    scene = createViewerScene(host, platform, Math.floor(Math.random() * 1000000000));
  }

  function drawBackdrop() {
    host.drawBackdrop(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2b3524');
      g.addColorStop(0.45, '#1a2118');
      g.addColorStop(1, '#0c100b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      var glow = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.12, h * 0.6);
      glow.addColorStop(0, 'rgba(240,181,60,0.10)');
      glow.addColorStop(1, 'rgba(240,181,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    });
  }

  function enter() {
    ensureScene();
    scene.mount();
    scene.frame(current);
    scene.setAutoRotate(auto);
    drawBackdrop();
    app.requestDraw();
  }

  function leave() {
    if (scene) scene.unmount();
  }

  function update(dt) {
    if (scene) scene.update(dt);
  }

  function drawUI(ui) {
    var ctx = ui.begin();
    var pal = T.palette(true);
    var contentW = Math.min(W - 32 * s, 520);
    var left = (W - contentW) / 2;
    /* 顶部留出状态栏 + 胶囊按钮的高度 */
    var top = platform.safeTop + 44 * s;
    var headerR = 17 * s;

    /* 返回 */
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.arc(left + headerR, top + headerR, headerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(left + headerR, top + headerR, headerR, 0, Math.PI * 2);
    ctx.stroke();
    T.iconBack(ctx, left + headerR, top + headerR, headerR * 0.52, pal.ink);
    ui.hit(left, top, headerR * 2, headerR * 2, function () { app.switchMode('home'); });

    var titleX = left + headerR * 2 + 12 * s;
    T.text(ctx, '向日葵三维模型', titleX, top + 20 * s, 17 * s, pal.ink, 600);
    var stats = scene ? scene.getStats() : null;
    var sub = stats
      ? formatNumber(stats.triangles) + ' 三角面 · ' + stats.parts + ' 个部件'
      : '正在构建模型…';
    T.text(ctx, sub, titleX, top + 38 * s, 10.5 * s, pal.muted, 400);

    /* 底部面板 */
    var panelH = 168 * s + platform.safeBottom + 10 * s;
    var panelY = H - panelH;
    T.fillRound(ctx, -12, panelY, W + 24, panelH + 30, 22 * s, 'rgba(20,25,18,0.92)');
    T.strokeRound(ctx, -12, panelY, W + 24, panelH + 30, 22 * s, 'rgba(255,255,255,0.10)', 1);

    /* 视角切换 */
    var viewY = panelY + 18 * s;
    var viewH = 36 * s;
    var viewGap = 8 * s;
    var viewW = (contentW - viewGap * 3) / 4;
    for (var i = 0; i < VIEWS.length; i++) {
      var vx = left + i * (viewW + viewGap);
      var active = VIEWS[i].key === current;
      T.fillRound(ctx, vx, viewY, viewW, viewH, 10 * s,
        active ? 'rgba(240,181,60,0.88)' : 'rgba(255,255,255,0.05)');
      T.text(ctx, VIEWS[i].label, vx + viewW / 2, viewY + 23 * s, 11.5 * s,
        active ? '#241c09' : pal.muted, active ? 600 : 400, 'center');
      (function (key) {
        ui.hit(vx, viewY, viewW, viewH, function () {
          if (current === key || !scene) return;
          current = key;
          scene.frame(key);
          app.requestDraw();
        });
      })(VIEWS[i].key);
    }

    /* 自动旋转（居中） */
    var rowY = panelY + 64 * s;
    var autoLabel = '自动旋转';
    var labelW = T.measure(ctx, autoLabel, 11.5 * s, 400);
    var swW = 46 * s;
    var swH = 24 * s;
    var gap = 12 * s;
    var groupW = labelW + gap + swW;
    var groupX = left + (contentW - groupW) / 2;
    T.text(ctx, autoLabel, groupX, rowY + 26 * s, 11.5 * s, pal.muted, 400);

    var swX = groupX + labelW + gap;
    var swY = rowY + 9 * s;
    T.fillRound(ctx, swX, swY, swW, swH, swH / 2, auto ? 'rgba(240,181,60,0.9)' : 'rgba(255,255,255,0.12)');
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath();
    ctx.arc(auto ? swX + swW - swH / 2 : swX + swH / 2, swY + swH / 2, swH * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ui.hit(swX - 6 * s, swY - 10 * s, swW + 12 * s, swH + 20 * s, function () {
      auto = !auto;
      if (scene) scene.setAutoRotate(auto);
      app.requestDraw();
    });

    var hint = auto ? '拖动旋转 · 双指缩放 · 停止操作后自动旋转' : '拖动旋转 · 双指缩放';
    T.text(ctx, hint, W / 2, H - platform.safeBottom - 16 * s, 9.5 * s, 'rgba(242,236,223,0.4)', 400, 'center');

    ui.end();
  }

  function touchStart(points) { if (scene) scene.touchStart(points); }
  function touchMove(points) { if (scene) scene.touchMove(points); }
  function touchEnd(points) { if (scene) scene.touchEnd(points); }

  return {
    name: 'viewer',
    needsFrame: true,
    enter: enter,
    leave: leave,
    update: update,
    drawUI: drawUI,
    touchStart: touchStart,
    touchMove: touchMove,
    touchEnd: touchEnd
  };
}

module.exports = { createViewerMode: createViewerMode };
