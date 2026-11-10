'use strict';

/* ============================================================================
 * face.js — 花盘上的表情（Canvas 2D 绘制）
 * 从 game/face.js 迁移：只把 document.createElement('canvas') 换成离屏画布，
 * 其余绘制逻辑保持一致。
 * ==========================================================================*/

var SIZE = 512;
var INK = '#2b1a12';

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

/* 兼容旧基础库：没有 ctx.ellipse 时用四段贝塞尔近似整圆椭圆 */
function ellipsePath(ctx, cx, cy, rx, ry) {
  if (ctx.ellipse) {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    return;
  }
  var k = 0.5522847498;
  ctx.moveTo(cx + rx, cy);
  ctx.bezierCurveTo(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry);
  ctx.bezierCurveTo(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy);
  ctx.bezierCurveTo(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy);
}

function softBlob(ctx, x, y, r, rgb, alpha) {
  var g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawEye(ctx, cx, cy, side, p) {
  var rx = 46;
  var ry = 54;
  var open = clamp01(p.eyeOpen) * clamp01(p.blink === undefined ? 1 : p.blink);
  var curve = p.eyeCurve || 0;

  if (open < 0.14) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 17;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.86, cy + 6);
    ctx.quadraticCurveTo(cx, cy - 48 * curve, cx + rx * 0.86, cy + 6);
    ctx.stroke();
    ctx.restore();
    return;
  }

  var h = ry * open;
  ctx.save();
  ctx.beginPath();
  ellipsePath(ctx, cx, cy, rx, h);
  ctx.fillStyle = '#fff7e6';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ellipsePath(ctx, cx, cy, rx, h);
  ctx.clip();

  var px = cx + (p.pupilX || 0) * 20;
  var py = cy + (p.pupilY || 0) * 16 + h * 0.05;
  var pr = Math.min(rx, h) * 0.66;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px - pr * 0.33, py - pr * 0.36, pr * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf6';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ellipsePath(ctx, cx, cy, rx, h);
  ctx.strokeStyle = 'rgba(43,26,18,0.55)';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  if ((p.anger || 0) > 0.12) {
    var inner = side < 0 ? cx + rx * 0.75 : cx - rx * 0.75;
    var outer = side < 0 ? cx - rx * 0.95 : cx + rx * 0.95;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(outer, cy - h * 0.72);
    ctx.quadraticCurveTo(cx, cy - h * 0.95 + (p.anger || 0) * h * 0.18, inner, cy - h * 0.42);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBrows(ctx, p) {
  var weight = p.brow || 0;
  if (weight < 0.05) return;
  var tilt = p.browTilt || 0;
  var raise = (p.browRaise || 0) * 12;
  [-1, 1].forEach(function (side) {
    var cx = SIZE / 2 + side * 78;
    var y = 174 - raise;
    var innerX = cx - side * 38;
    var outerX = cx + side * 38;
    var innerY = y + tilt * 16;
    var outerY = y - tilt * 7;
    ctx.save();
    ctx.globalAlpha = Math.min(1, weight);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(outerX, outerY);
    ctx.quadraticCurveTo(cx, (innerY + outerY) / 2 - 5, innerX, innerY);
    ctx.stroke();
    ctx.restore();
  });
}

function drawMouth(ctx, p) {
  var cx = SIZE / 2;
  var cy = 338;
  var open = clamp01(p.mouthOpen || 0);
  var smile = p.smile || 0;

  if (open > 0.10) {
    var w = 34 + 30 * open;
    var h = 12 + 40 * open;
    ctx.save();
    ctx.beginPath();
    ellipsePath(ctx, cx, cy + 4, w, h);
    ctx.fillStyle = '#3a2115';
    ctx.fill();
    ctx.beginPath();
    ellipsePath(ctx, cx, cy + 4, w, h);
    ctx.clip();
    ctx.beginPath();
    ellipsePath(ctx, cx, cy + 4 + h * 0.55, w * 0.62, h * 0.55);
    ctx.fillStyle = '#d1685c';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ellipsePath(ctx, cx, cy + 4, w, h);
    ctx.strokeStyle = 'rgba(43,26,18,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 56, cy);
    ctx.quadraticCurveTo(cx, cy + smile * 34, cx + 56, cy);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTear(ctx, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  var g = ctx.createLinearGradient(x, y - 18, x, y + 44);
  g.addColorStop(0, '#d6f2ff');
  g.addColorStop(1, '#79c6ee');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.bezierCurveTo(x + 19, y + 8, x + 15, y + 40, x, y + 42);
  ctx.bezierCurveTo(x - 15, y + 40, x - 19, y + 8, x, y - 18);
  ctx.fill();
  ctx.restore();
}

function drawSparkle(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fill();
  ctx.restore();
}

function drawAngerMark(ctx, x, y, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ff6f5e';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (var i = 0; i < 4; i++) {
    var a = i * Math.PI / 2 + Math.PI / 4;
    var ix = x + Math.cos(a) * 8;
    var iy = y + Math.sin(a) * 8;
    var ox = x + Math.cos(a) * 26;
    var oy = y + Math.sin(a) * 26;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.quadraticCurveTo(ox + Math.cos(a + 1.2) * 8, oy + Math.sin(a + 1.2) * 8, ox, oy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace(ctx, p, t) {
  ctx.clearRect(0, 0, SIZE, SIZE);

  /* 米色脸区 */
  var patch = ctx.createRadialGradient(256, 268, 24, 256, 268, 208);
  patch.addColorStop(0, 'rgba(255,245,224,0.95)');
  patch.addColorStop(0.70, 'rgba(255,240,214,0.88)');
  patch.addColorStop(0.93, 'rgba(255,238,210,0.35)');
  patch.addColorStop(1, 'rgba(255,238,210,0)');
  ctx.save();
  ctx.beginPath();
  ellipsePath(ctx, 256, 268, 212, 190);
  ctx.fillStyle = patch;
  ctx.fill();
  ctx.restore();

  /* 腮红 */
  var blush = clamp01(p.blush || 0);
  if (blush > 0.02) {
    softBlob(ctx, 142, 306, 52, '255,118,104', 0.42 * blush);
    softBlob(ctx, 370, 306, 52, '255,118,104', 0.42 * blush);
  }

  drawEye(ctx, SIZE / 2 - 78, 236, -1, p);
  drawEye(ctx, SIZE / 2 + 78, 236, 1, p);
  drawBrows(ctx, p);
  drawMouth(ctx, p);

  var tears = clamp01(p.tears || 0);
  if (tears > 0.05) {
    drawTear(ctx, SIZE / 2 - 88, 300, tears);
    drawTear(ctx, SIZE / 2 + 88, 300, tears * 0.85);
  }

  var sleep = clamp01(p.sleep || 0);
  if (sleep > 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.9 * sleep;
    ctx.fillStyle = '#fff7e6';
    ctx.font = 'bold 58px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText('Z', 384, 152);
    ctx.font = 'bold 40px -apple-system, "Segoe UI", sans-serif';
    ctx.fillText('z', 428, 106);
    ctx.restore();
  }

  var anger = clamp01(p.anger || 0);
  if (anger > 0.1) drawAngerMark(ctx, 392, 144, anger);

  var sparkle = clamp01(p.sparkle || 0);
  if (sparkle > 0.05) {
    var tw = 0.72 + 0.28 * Math.sin(t * 3.0);
    drawSparkle(ctx, 108, 148, 20 * tw, sparkle * 0.9);
    drawSparkle(ctx, 404, 196, 15 * (1.3 - tw), sparkle * 0.8);
    drawSparkle(ctx, 96, 372, 12 * tw, sparkle * 0.55);
  }
}

function createFace(platform) {
  var canvas = platform.createCanvas2D(SIZE, SIZE);
  var ctx = canvas.getContext('2d');
  return {
    size: SIZE,
    canvas: canvas,
    ctx: ctx,
    draw: function (p, t) { drawFace(ctx, p, t); }
  };
}

module.exports = { createFace: createFace };
