'use strict';

/* ============================================================================
 * main.js — 小游戏启动、模式路由、主循环、输入分发
 * ==========================================================================*/

var platform = require('./platform.js');
var createHost = require('./scene-host.js').createHost;
var createUI = require('./ui.js').createUI;
var createHomeMode = require('./modes/home.js').createHomeMode;
var createEmotionMode = require('./modes/emotion.js').createEmotionMode;
var createViewerMode = require('./modes/viewer.js').createViewerMode;

var host = createHost(platform);
var ui = createUI(host, platform);

var app = {
  platform: platform,
  host: host,
  ui: ui,
  mode: null,
  drawQueued: true,
  uiTouch: false,
  requestDraw: function () {
    app.drawQueued = true;
  },
  switchMode: function (name) {
    var next = modes[name];
    if (!next || next === app.mode) return;
    if (app.mode && app.mode.leave) app.mode.leave();
    app.mode = next;
    if (app.mode.enter) app.mode.enter();
    app.drawQueued = true;
  }
};

var modes = {
  home: createHomeMode(app),
  emotion: createEmotionMode(app),
  viewer: createViewerMode(app)
};

/* ------------------------------------------------------------- 输入分发 */
platform.bindTouch({
  start: function (points) {
    if (!points.length) return;
    var p = points[0];
    if (ui.touchStart(p.x, p.y)) {
      app.uiTouch = true;
      return;
    }
    app.uiTouch = false;
    if (app.mode && app.mode.touchStart) app.mode.touchStart(points);
  },
  move: function (points) {
    if (app.uiTouch) return;
    if (app.mode && app.mode.touchMove) app.mode.touchMove(points);
  },
  end: function (points) {
    var p = points[0] || { x: 0, y: 0 };
    if (app.uiTouch) {
      app.uiTouch = false;
      ui.touchEnd(p.x, p.y);
      return;
    }
    if (app.mode && app.mode.touchEnd) app.mode.touchEnd(points);
  }
});

platform.bindKeyboard({
  input: function (value) {
    if (app.mode && app.mode.onKeyboardInput) app.mode.onKeyboardInput(value);
  },
  confirm: function (value) {
    if (app.mode && app.mode.onKeyboardConfirm) app.mode.onKeyboardConfirm(value);
  },
  complete: function (value) {
    if (app.mode && app.mode.onKeyboardComplete) app.mode.onKeyboardComplete(value);
  }
});

platform.bindKeyboardHeight(function () {
  app.requestDraw();
});

platform.onResize(function () {
  host.resize();
  app.requestDraw();
});

/* ------------------------------------------------------------- 生命周期 */
var paused = false;
var last = Date.now();

platform.onHide(function () {
  paused = true;
  if (app.mode && app.mode.onHide) app.mode.onHide();
});

platform.onShow(function () {
  paused = false;
  last = Date.now();
  if (app.mode && app.mode.onShow) app.mode.onShow();
  app.requestDraw();
});

/* 转发给朋友 */
try {
  if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true });
  if (wx.onShareAppMessage) {
    wx.onShareAppMessage(function () {
      return {
        title: '向日葵和情绪向日葵｜会看脸色的花与可打印的 3D 向日葵'
      };
    });
  }
} catch (e) { /* 忽略分享初始化失败 */ }

/* ------------------------------------------------------------- 主循环 */
var errorShown = false;

function frame() {
  platform.raf(frame);
  var now = Date.now();
  var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (paused) return;

  try {
    if (app.mode && app.mode.update) app.mode.update(dt);
    var didDraw = false;
    if (app.drawQueued && app.mode && app.mode.drawUI) {
      app.drawQueued = false;
      app.mode.drawUI(ui);
      didDraw = true;
    }
    /* 首页是静态的，只在界面变化时重绘，省电 */
    if (didDraw || (app.mode && app.mode.needsFrame)) host.render();
  } catch (err) {
    if (!errorShown) {
      errorShown = true;
      console.error('[sunflower] frame error', err);
    }
  }
}

app.switchMode('home');
frame();

if (typeof GameGlobal !== 'undefined') {
  GameGlobal.__sunflower = app;
}
