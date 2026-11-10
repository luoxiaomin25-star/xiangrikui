'use strict';

/* ============================================================================
 * theme.js — 配色、圆角/文字等绘制工具、简易图标
 * ==========================================================================*/

var FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

function palette(night) {
  if (night) {
    return {
      night: true,
      bgTop: '#0d1220', bgMid: '#131a2b', bgBottom: '#1b2030',
      ink: '#f2ecdf', muted: '#a9b2c6', faint: 'rgba(242,236,223,0.42)',
      panel: 'rgba(24,30,46,0.92)', panelBorder: 'rgba(255,255,255,0.10)',
      card: 'rgba(255,255,255,0.06)', cardBorder: 'rgba(255,255,255,0.12)',
      gold: '#f0b53c', goldDeep: '#d88f22', cream: '#fff6e9',
      water: '#5bb7e8', light: '#f0b53c', bond: '#ef7f7a', energy: '#8dbf6a',
      shadow: 'rgba(0,0,0,0.35)'
    };
  }
  return {
    night: false,
    bgTop: '#fdf3e3', bgMid: '#f7dfbb', bgBottom: '#e8c496',
    ink: '#2c2118', muted: '#7c6752', faint: 'rgba(44,33,24,0.42)',
    panel: 'rgba(255,250,240,0.93)', panelBorder: 'rgba(90,60,30,0.14)',
    card: 'rgba(255,255,255,0.62)', cardBorder: 'rgba(90,60,30,0.14)',
    gold: '#eeb13d', goldDeep: '#d68b1f', cream: '#fff8ec',
    water: '#5bb7e8', light: '#f0b53c', bond: '#ef7f7a', energy: '#8dbf6a',
    shadow: 'rgba(108,62,22,0.16)'
  };
}

function font(size, weight) {
  return (weight || 400) + ' ' + size + 'px ' + FONT;
}

function text(ctx, str, x, y, size, color, weight, align) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function measure(ctx, str, size, weight) {
  ctx.font = font(size, weight);
  return ctx.measureText(str).width;
}

/* 按宽度逐字换行（中文按单字断行即可） */
function wrapText(ctx, str, maxWidth, size, weight) {
  ctx.font = font(size, weight);
  var lines = [];
  var line = '';
  var s = String(str || '');
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    var test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundPath(ctx, x, y, w, h, r) {
  var rr = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function fillRound(ctx, x, y, w, h, r, color) {
  roundPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRound(ctx, x, y, w, h, r, color, width) {
  roundPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  ctx.stroke();
}

function hGradient(ctx, x, y, w, h, stops) {
  var g = ctx.createLinearGradient(x, y, x, y + h);
  for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/* ------------------------------------------------------------------ 图标 */
function iconSun(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.4, r * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  for (var i = 0; i < 8; i++) {
    var a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

function iconMoon(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  /* 两个同向圆弧、相反绕向叠加出月牙 */
  ctx.arc(cx, cy, r, 0, Math.PI * 2, false);
  ctx.arc(cx + r * 0.52, cy - r * 0.3, r * 0.9, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.restore();
}

function iconDrop(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.bezierCurveTo(cx + r * 0.9, cy - r * 0.1, cx + r * 0.72, cy + r * 0.72, cx, cy + r * 0.82);
  ctx.bezierCurveTo(cx - r * 0.72, cy + r * 0.72, cx - r * 0.9, cy - r * 0.1, cx, cy - r);
  ctx.fill();
  ctx.restore();
}

function iconHeart(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.78);
  ctx.bezierCurveTo(cx - r * 1.15, cy - r * 0.05, cx - r * 0.62, cy - r * 0.98, cx, cy - r * 0.34);
  ctx.bezierCurveTo(cx + r * 0.62, cy - r * 0.98, cx + r * 1.15, cy - r * 0.05, cx, cy + r * 0.78);
  ctx.fill();
  ctx.restore();
}

function iconChat(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  roundPath(ctx, cx - r, cy - r * 0.82, r * 2, r * 1.44, r * 0.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.36, cy + r * 0.55);
  ctx.lineTo(cx - r * 0.72, cy + r * 1.05);
  ctx.lineTo(cx + r * 0.2, cy + r * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (var i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx + i * r * 0.42, cy - r * 0.1, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function iconHelp(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, r * 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(r * 1.24, 600);
  ctx.fillText('?', cx, cy + r * 0.04);
  ctx.restore();
}

function iconBack(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.8, r * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.32, cy - r * 0.72);
  ctx.lineTo(cx - r * 0.42, cy);
  ctx.lineTo(cx + r * 0.32, cy + r * 0.72);
  ctx.stroke();
  ctx.restore();
}

function iconFlower(ctx, cx, cy, r, petalColor, centerColor) {
  ctx.save();
  ctx.fillStyle = petalColor;
  for (var i = 0; i < 10; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * Math.PI / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.62, r * 0.26, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = centerColor;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function iconFace(ctx, cx, cy, r, inkColor, cheekColor) {
  ctx.save();
  ctx.fillStyle = '#fff6e6';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cheekColor;
  ctx.beginPath();
  ctx.arc(cx - r * 0.52, cy + r * 0.24, r * 0.2, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.52, cy + r * 0.24, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inkColor;
  ctx.beginPath();
  ctx.arc(cx - r * 0.34, cy - r * 0.1, r * 0.11, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.34, cy - r * 0.1, r * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.02, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function iconChevron(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, r * 0.2);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy - r * 0.6);
  ctx.lineTo(cx + r * 0.34, cy);
  ctx.lineTo(cx - r * 0.3, cy + r * 0.6);
  ctx.stroke();
  ctx.restore();
}

function iconSparkle(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.18, cy - r * 0.18, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.18, cy + r * 0.18, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.18, cy + r * 0.18, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.18, cy - r * 0.18, cx, cy - r);
  ctx.fill();
  ctx.restore();
}

module.exports = {
  palette: palette,
  font: font,
  text: text,
  measure: measure,
  wrapText: wrapText,
  roundPath: roundPath,
  fillRound: fillRound,
  strokeRound: strokeRound,
  hGradient: hGradient,
  iconSun: iconSun,
  iconMoon: iconMoon,
  iconDrop: iconDrop,
  iconHeart: iconHeart,
  iconChat: iconChat,
  iconHelp: iconHelp,
  iconBack: iconBack,
  iconFlower: iconFlower,
  iconFace: iconFace,
  iconChevron: iconChevron,
  iconSparkle: iconSparkle
};
