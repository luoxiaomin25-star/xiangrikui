'use strict';

/* ============================================================================
 * ui.js — 全屏 Canvas UI 层
 *   把 2D 画布绘制结果做成全屏纹理，盖在 3D 场景之上；同时负责按钮命中。
 * ==========================================================================*/

var makeCanvasTexture = require('./texture.js').makeCanvasTexture;

function createUI(host, platform) {
  var THREE = host.THREE;
  var W = platform.W;
  var H = platform.H;

  /* 纹理最大边不超过 2048，兼容老设备 */
  var maxSide = Math.max(W, H);
  var scale = Math.min(2, Math.max(1, platform.dpr * 0.8));
  if (maxSide * scale > 2048) scale = 2048 / maxSide;
  var cw = Math.round(W * scale);
  var ch = Math.round(H * scale);

  var canvas = platform.createCanvas2D(cw, ch);
  var ctx = canvas.getContext('2d');
  var tex = makeCanvasTexture(THREE, canvas);

  var material = new THREE.MeshBasicMaterial({
    map: tex.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  if ('toneMapped' in material) material.toneMapped = false;
  var mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  host.uiScene.add(mesh);

  var hits = [];
  var active = null;

  function begin() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    hits.length = 0;
    return ctx;
  }

  function end() {
    tex.update();
  }

  function hit(x, y, w, h, onTap) {
    hits.push({ x: x, y: y, w: w, h: h, onTap: onTap });
  }

  function inside(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  function touchStart(x, y) {
    for (var i = hits.length - 1; i >= 0; i--) {
      if (inside(hits[i], x, y)) {
        active = hits[i];
        return true;
      }
    }
    active = null;
    return false;
  }

  function touchEnd(x, y) {
    var r = active;
    active = null;
    if (!r) return false;
    if (inside(r, x, y) && r.onTap) r.onTap();
    return true;
  }

  function clearHits() {
    hits.length = 0;
  }

  return {
    W: W,
    H: H,
    scale: scale,
    ctx: ctx,
    begin: begin,
    end: end,
    hit: hit,
    touchStart: touchStart,
    touchEnd: touchEnd,
    clearHits: clearHits
  };
}

module.exports = { createUI: createUI };
