'use strict';

/* ============================================================================
 * texture.js — 把 2D Canvas 转成 WebGL 可上传的 DataTexture
 *
 * 小游戏 WebGL 对 Canvas 直接当纹理的支持不稳定，这里用 getImageData 取像素，
 * 手动上下翻转后交给 DataTexture，兼容性最好。
 * ==========================================================================*/

function makeCanvasTexture(THREE, canvas) {
  var w = canvas.width;
  var h = canvas.height;
  var ctx = canvas.getContext('2d');
  var data = new Uint8Array(w * h * 4);
  var texture = new THREE.DataTexture(
    data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
  texture.needsUpdate = true;

  var rowBytes = w * 4;

  function update() {
    var img;
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return;
    }
    if (!img || !img.data) return;
    var src = img.data;
    /* canvas 第 0 行在最上方；WebGL 纹理由下往上，逐行翻转 */
    for (var y = 0; y < h; y++) {
      var from = (h - 1 - y) * rowBytes;
      data.set(src.subarray(from, from + rowBytes), y * rowBytes);
    }
    texture.needsUpdate = true;
  }

  return {
    texture: texture,
    update: update,
    width: w,
    height: h,
    canvas: canvas,
    ctx: ctx
  };
}

module.exports = { makeCanvasTexture: makeCanvasTexture };
