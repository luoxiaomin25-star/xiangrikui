'use strict';

/* ============================================================================
 * platform.js — 小游戏运行环境适配（尺寸、存储、输入、键盘、生命周期）
 * ==========================================================================*/

var info;
try {
  info = (typeof wx.getWindowInfo === 'function') ? wx.getWindowInfo() : wx.getSystemInfoSync();
} catch (e) {
  info = {};
}

var W = Math.max(1, info.windowWidth || info.screenWidth || 375);
var H = Math.max(1, info.windowHeight || info.screenHeight || 667);
var DPR = Math.max(1, Math.min(3, info.pixelRatio || 1));

var safeArea = info.safeArea || null;
var safeTop = Math.max(0, info.statusBarHeight || 0, safeArea ? safeArea.top : 0);
var safeBottom = safeArea ? Math.max(0, (info.screenHeight || H) - safeArea.bottom) : 0;
if (!isFinite(safeBottom) || safeBottom < 0) safeBottom = 0;

/* 以 375 宽为设计基准的缩放系数 */
var scale = Math.min(1.25, Math.max(0.86, W / 375));

var mainCanvas = null;

function getMainCanvas() {
  if (!mainCanvas) mainCanvas = wx.createCanvas();
  return mainCanvas;
}

/* 创建离屏 2D 画布：优先官方接口，失败退回 wx.createCanvas() 的离屏画布 */
function createCanvas2D(w, h) {
  var c = null;
  if (typeof wx.createOffscreenCanvas === 'function') {
    try {
      c = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
    } catch (e) {
      c = null;
    }
  }
  if (!c) c = wx.createCanvas();
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  /* 我们会反复 getImageData 做纹理上传，提前声明 willReadFrequently，
     避免开发者工具里的性能告警（不支持该参数的基础库会忽略它） */
  try {
    c.getContext('2d', { willReadFrequently: true });
  } catch (e) {
    try { c.getContext('2d'); } catch (e2) { /* ignore */ }
  }
  return c;
}

/* ------------------------------------------------------------------ 存储 */
function readJSON(key) {
  try {
    var raw = wx.getStorageSync(key);
    if (!raw) return null;
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch (e) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    wx.setStorageSync(key, JSON.stringify(value));
  } catch (e) { /* 存储空间不足时忽略 */ }
}

/* ------------------------------------------------------------ 帧循环/输入 */
function raf(cb) {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(cb);
  }
  return setTimeout(function () { cb(Date.now()); }, 16);
}

function pointOf(t) {
  return {
    x: (t.clientX !== undefined) ? t.clientX : (t.pageX !== undefined ? t.pageX : 0),
    y: (t.clientY !== undefined) ? t.clientY : (t.pageY !== undefined ? t.pageY : 0),
    id: t.identifier
  };
}

function bindTouch(handlers) {
  function wrap(fn) {
    return function (e) {
      var pts = [];
      var src = (e.touches && e.touches.length) ? e.touches : (e.changedTouches || []);
      for (var i = 0; i < src.length; i++) pts.push(pointOf(src[i]));
      if (fn) fn(pts);
    };
  }
  if (wx.onTouchStart) wx.onTouchStart(wrap(handlers.start));
  if (wx.onTouchMove) wx.onTouchMove(wrap(handlers.move));
  if (wx.onTouchEnd) wx.onTouchEnd(wrap(handlers.end));
  if (wx.onTouchCancel) wx.onTouchCancel(wrap(handlers.end));
}

/* ---------------------------------------------------------------- 键盘 */
var keyboardBound = false;

function bindKeyboard(handlers) {
  if (keyboardBound) return;
  keyboardBound = true;
  if (wx.onKeyboardInput) {
    wx.onKeyboardInput(function (e) { if (handlers.input) handlers.input(e.value || ''); });
  }
  if (wx.onKeyboardConfirm) {
    wx.onKeyboardConfirm(function (e) { if (handlers.confirm) handlers.confirm(e.value || ''); });
  }
  if (wx.onKeyboardComplete) {
    wx.onKeyboardComplete(function (e) { if (handlers.complete) handlers.complete(e.value || ''); });
  }
}

function showKeyboard(opts) {
  try {
    wx.showKeyboard(Object.assign({
      defaultValue: '',
      maxLength: 30,
      multiple: false,
      confirmHold: true,
      confirmType: 'done'
    }, opts || {}));
  } catch (e) { /* 部分基础库不支持，忽略 */ }
}

function hideKeyboard() {
  try { wx.hideKeyboard(); } catch (e) { /* ignore */ }
}

var keyboardHeight = 0;

function bindKeyboardHeight(cb) {
  if (!wx.onKeyboardHeightChange) return;
  wx.onKeyboardHeightChange(function (res) {
    keyboardHeight = (res && res.height) || 0;
    if (cb) cb(keyboardHeight);
  });
}

function getKeyboardHeight() {
  return keyboardHeight;
}

function vibrate() {
  try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------ 生命周期 */
function onShow(cb) { if (wx.onShow) wx.onShow(cb); }
function onHide(cb) { if (wx.onHide) wx.onHide(cb); }
function onResize(cb) { if (wx.onWindowResize) wx.onWindowResize(cb); }

module.exports = {
  info: info,
  W: W,
  H: H,
  dpr: DPR,
  scale: scale,
  safeTop: safeTop,
  safeBottom: safeBottom,
  getMainCanvas: getMainCanvas,
  createCanvas2D: createCanvas2D,
  readJSON: readJSON,
  writeJSON: writeJSON,
  raf: raf,
  bindTouch: bindTouch,
  bindKeyboard: bindKeyboard,
  showKeyboard: showKeyboard,
  hideKeyboard: hideKeyboard,
  bindKeyboardHeight: bindKeyboardHeight,
  getKeyboardHeight: getKeyboardHeight,
  vibrate: vibrate,
  onShow: onShow,
  onHide: onHide,
  onResize: onResize
};
