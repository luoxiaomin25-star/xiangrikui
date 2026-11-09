/* ============================================================================
 * sunflower.js — 程序化向日葵三维模型
 *
 * 仅使用 three.js 的数学类与 BufferGeometry，不依赖渲染器，
 * 因此同一份代码既能跑在浏览器（查看器）里，也能跑在 Node（导出 stl/obj）。
 *
 *   const model = SunflowerModel.buildSunflower(THREE, { headTilt: 24 });
 *   model.group    -> THREE.Group（含各部件 Mesh）
 *   model.parts    -> { stem, leaf, petal, ... }
 *   model.stats    -> 面数、尺寸
 *
 * 造型依据真实向日葵（Helianthus annuus）的结构：
 *   · 花盘小花按黄金角 137.5° 的 Fermat 螺旋排布（斐波那契螺旋可见）
 *   · 外圈为开放管状小花（橙黄），内圈为成熟瘦果（褐色）
 *   · 舌状花两轮，基部偏橙、尖端淡黄，横截面呈浅槽状并回卷
 *   · 总苞片（萼片）两轮，向外下方反折
 *   · 心形叶片具锯齿边缘、主脉隆起与羽状侧脉，叶片整体下垂
 * 所有曲面均按厚度加厚为封闭实体，可直接 3D 打印。
 * ==========================================================================*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SunflowerModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis
  : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var D2R = Math.PI / 180;
  var GOLDEN_ANGLE = 137.507764;

  /* ---------------------------------------------------------------- 工具 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function rgb(hex) {
    return [
      srgbToLinear(((hex >> 16) & 255) / 255),
      srgbToLinear(((hex >> 8) & 255) / 255),
      srgbToLinear((hex & 255) / 255)
    ];
  }
  function mixRGB(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function tint(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  /* ------------------------------------------------------------- 调色板 */
  var PALETTE = {
    stem: 0x74924a,
    stemDark: 0x5c7a38,
    leaf: 0x4e7c30,
    leafVein: 0x84b153,
    leafEdge: 0x3d6425,
    bract: 0x5f8339,
    bractTip: 0x6f8b3a,
    receptacle: 0x82a04c,
    receptacleBack: 0x93ab58,
    petalBase: 0xd8870f,
    petalMid: 0xf2b91f,
    petalTip: 0xffdf6b,
    floretBase: 0xa9541a,
    floretTip: 0xf0b423,
    seed: 0x2b1a0e,
    seedHi: 0x4c3620,
    pith: 0xb9a06a
  };

  /* ------------------------------------------------------------ 顶点缓冲 */
  function Part(name, material) {
    this.name = name;
    this.material = material;
    this.pos = [];
    this.col = [];
    this.idx = [];
  }
  Part.prototype.push = function (x, y, z, c) {
    this.pos.push(x, y, z);
    if (c) this.col.push(c[0], c[1], c[2]);
    return this.pos.length / 3 - 1;
  };
  Part.prototype.tri = function (a, b, c) { this.idx.push(a, b, c); };
  Part.prototype.triSafe = function (a, b, c) {
    if (a === b || b === c || a === c) return;
    this.idx.push(a, b, c);
  };
  Part.prototype.quad = function (a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  };
  Part.prototype.toGeometry = function (THREE) {
    var g = new THREE.BufferGeometry();
    /* three r108（微信小程序适配版）使用 addAttribute，r110+ 使用 setAttribute */
    var put = g.setAttribute
      ? function (n, a) { g.setAttribute(n, a); }
      : function (n, a) { g.addAttribute(n, a); };
    put('position', new THREE.Float32BufferAttribute(this.pos, 3));
    if (this.col.length === this.pos.length) {
      put('color', new THREE.Float32BufferAttribute(this.col, 3));
    }
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  Part.prototype.triangles = function () { return this.idx.length / 3; };

  /* 闭合实体的有向体积；用于自动统一面朝向 */
  function signedVolume(part) {
    var p = part.pos, idx = part.idx, v = 0;
    for (var k = 0; k < idx.length; k += 3) {
      var a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
      var ax = p[a], ay = p[a + 1], az = p[a + 2];
      var bx = p[b], by = p[b + 1], bz = p[b + 2];
      var cx = p[c], cy = p[c + 1], cz = p[c + 2];
      v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    return v / 6;
  }
  function ensureOutward(part) {
    if (signedVolume(part) >= 0) return;
    var idx = part.idx;
    for (var k = 0; k < idx.length; k += 3) {
      var t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t;
    }
  }

  /* ==========================================================================
   * 通用几何工具
   * ========================================================================*/

  /* 把 rows×cols 的参数网格加厚成封闭实体。
   * grid[i][j] 为 THREE.Vector3，i 沿 u 方向，j 沿 v 方向。
   * 正面沿 +normal（normal = du×dv，可用 normalHint 翻转），背面偏移 -normal。 */
  function solidifyGrid(part, grid, opts) {
    var THREE = opts.THREE;
    var rows = grid.length, cols = grid[0].length;
    var closedCols = !!opts.closedCols;
    var h = (opts.thickness || 0.05) * 0.5;
    var colorAt = opts.colorAt || null;
    var N = [], i, j;
    for (i = 0; i < rows; i++) {
      N.push([]);
      for (j = 0; j < cols; j++) {
        var i0 = Math.max(0, i - 1), i1 = Math.min(rows - 1, i + 1);
        var j0 = closedCols ? (j - 1 + cols) % cols : Math.max(0, j - 1);
        var j1 = closedCols ? (j + 1) % cols : Math.min(cols - 1, j + 1);
        var du = new THREE.Vector3().subVectors(grid[i1][j], grid[i0][j]);
        var dv = new THREE.Vector3().subVectors(grid[i][j1], grid[i][j0]);
        var n = new THREE.Vector3().crossVectors(du, dv);
        if (n.lengthSq() < 1e-14) n.set(0, 1, 0); else n.normalize();
        N[i].push(n);
      }
    }
    if (opts.normalHint) {
      var hint = opts.normalHint, s = 0;
      for (i = 0; i < rows; i++) for (j = 0; j < cols; j++) s += N[i][j].dot(hint);
      if (s < 0) for (i = 0; i < rows; i++) for (j = 0; j < cols; j++) N[i][j].negate();
    }

    /* 检测塌缩的行/列（例如叶片中心、花瓣基部），这些位置共享同一个顶点，
     * 否则会留下未闭合边 */
    var rowDeg = [], colDeg = [], i2, j2chk, eps2 = 1e-12;
    for (i = 0; i < rows; i++) {
      var rd = true;
      for (j = 1; j < cols; j++) {
        if (grid[i][j].distanceToSquared(grid[i][0]) > eps2) { rd = false; break; }
      }
      rowDeg.push(rd);
    }
    for (j = 0; j < cols; j++) {
      var cd = true;
      for (i = 1; i < rows; i++) {
        if (grid[i][j].distanceToSquared(grid[0][j]) > eps2) { cd = false; break; }
      }
      colDeg.push(cd);
    }
    /* 塌缩行/列的法线沿用相邻行，避免退化为默认方向 */
    for (i = 0; i < rows; i++) {
      if (!rowDeg[i]) continue;
      var src = (i + 1 < rows && !rowDeg[i + 1]) ? i + 1
        : ((i - 1 >= 0 && !rowDeg[i - 1]) ? i - 1 : -1);
      if (src >= 0) for (j = 0; j < cols; j++) N[i][j].copy(N[src][j]);
    }
    for (j = 0; j < cols; j++) {
      if (!colDeg[j]) continue;
      var src2 = (j + 1 < cols && !colDeg[j + 1]) ? j + 1
        : ((j - 1 >= 0 && !colDeg[j - 1]) ? j - 1 : -1);
      if (src2 >= 0) for (i = 0; i < rows; i++) N[i][j].copy(N[i][src2]);
    }

    var F = [], B = [];
    for (i = 0; i < rows; i++) {
      F.push([]); B.push([]);
      for (j = 0; j < cols; j++) {
        if (j > 0 && rowDeg[i]) { F[i][j] = F[i][0]; B[i][j] = B[i][0]; continue; }
        if (i > 0 && colDeg[j]) { F[i][j] = F[0][j]; B[i][j] = B[0][j]; continue; }
        var u = rows > 1 ? i / (rows - 1) : 0;
        var v = cols > 1 ? j / (cols - 1) : 0;
        var c = colorAt ? colorAt(u, v, i, j) : null;
        var p = grid[i][j], n = N[i][j];
        F[i][j] = part.push(p.x + n.x * h, p.y + n.y * h, p.z + n.z * h, c);
        B[i][j] = part.push(p.x - n.x * h, p.y - n.y * h, p.z - n.z * h, c);
      }
    }

    var jMax = closedCols ? cols : cols - 1;
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    for (i = 0; i < rows - 1; i++) {
      for (j = 0; j < jMax; j++) {
        var j2 = (j + 1) % cols;
        var ga = grid[i][j], gb = grid[i + 1][j], gc = grid[i + 1][j2], gd = grid[i][j2];
        v1.subVectors(gb, ga);
        v2.subVectors(gc, ga);
        v3.subVectors(gd, ga);
        var area1 = new THREE.Vector3().crossVectors(v1, v2).length();
        var area2 = new THREE.Vector3().crossVectors(v2, v3).length();
        if (area1 > 1e-10) {
          part.tri(F[i][j], F[i + 1][j], F[i + 1][j2]);
          part.tri(B[i][j], B[i + 1][j2], B[i + 1][j]);
        }
        if (area2 > 1e-10) {
          part.tri(F[i][j], F[i + 1][j2], F[i][j2]);
          part.tri(B[i][j], B[i][j2], B[i + 1][j2]);
        }
      }
    }

    function wall(a1, b1, a2, b2, order, g1, g2) {
      if (g1.distanceToSquared(g2) < 1e-16) return;
      if (order > 0) part.quad(a1, b1, b2, a2);
      else part.quad(a1, a2, b2, b1);
    }
    var last = cols - 1;
    if (!closedCols) {
      for (i = 0; i < rows - 1; i++) {
        wall(F[i][0], B[i][0], F[i + 1][0], B[i + 1][0], 1, grid[i][0], grid[i + 1][0]);
        wall(F[i][last], B[i][last], F[i + 1][last], B[i + 1][last], -1, grid[i][last], grid[i + 1][last]);
      }
    }
    for (j = 0; j < jMax; j++) {
      var jj = (j + 1) % cols;
      wall(F[0][j], B[0][j], F[0][jj], B[0][jj], 1, grid[0][j], grid[0][jj]);
      wall(F[rows - 1][j], B[rows - 1][j], F[rows - 1][jj], B[rows - 1][jj], -1,
        grid[rows - 1][j], grid[rows - 1][jj]);
    }
  }

  /* 沿脊线生成变半径圆管（含端盖），脊线为 THREE.Vector3 数组 */
  function tubeSolid(part, opts) {
    var THREE = opts.THREE;
    var spine = opts.spine;
    var seg = opts.radialSegments || 12;
    var radius = opts.radius || function () { return 0.4; };
    var colorAt = opts.colorAt || null;
    var n = spine.length;
    var tangents = [];
    var i, j;
    for (i = 0; i < n; i++) {
      var a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
      var t = new THREE.Vector3().subVectors(b, a);
      if (t.lengthSq() < 1e-14) t.set(0, 1, 0);
      tangents.push(t.normalize());
    }
    var ref = Math.abs(tangents[0].y) < 0.9
      ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    var nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
    var rings = [], q = new THREE.Quaternion();
    for (i = 0; i < n; i++) {
      if (i > 0) {
        q.setFromUnitVectors(tangents[i - 1], tangents[i]);
        nrm.applyQuaternion(q);
        nrm.addScaledVector(tangents[i], -nrm.dot(tangents[i])).normalize();
      }
      var bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
      var r = radius(i / (n - 1), i);
      var ring = [];
      for (j = 0; j < seg; j++) {
        var ph = j / seg * Math.PI * 2;
        var dir = new THREE.Vector3()
          .addScaledVector(nrm, Math.cos(ph))
          .addScaledVector(bin, Math.sin(ph));
        var c = colorAt ? colorAt(i / (n - 1), j / seg) : null;
        ring.push(part.push(
          spine[i].x + dir.x * r, spine[i].y + dir.y * r, spine[i].z + dir.z * r, c));
      }
      rings.push(ring);
    }
    for (i = 0; i < n - 1; i++) {
      for (j = 0; j < seg; j++) {
        var k = (j + 1) % seg;
        part.quad(rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]);
      }
    }
    if (opts.caps !== false) {
      var c0 = colorAt ? colorAt(0, 0) : null;
      var c1 = colorAt ? colorAt(1, 0) : null;
      var startC = part.push(spine[0].x, spine[0].y, spine[0].z, c0);
      var endC = part.push(spine[n - 1].x, spine[n - 1].y, spine[n - 1].z, c1);
      for (j = 0; j < seg; j++) {
        var k2 = (j + 1) % seg;
        part.tri(startC, rings[0][k2], rings[0][j]);
        part.tri(endC, rings[n - 1][j], rings[n - 1][k2]);
      }
    }
  }

  /* 旋转体：profile = [[r, y], ...]，两端 r=0 时自动闭合 */
  function revolveProfile(part, opts) {
    var THREE = opts.THREE;
    var prof = opts.profile, seg = opts.segments || 64;
    var colorAt = opts.colorAt;
    var mat = opts.matrix;
    var pv = new THREE.Vector3();
    var rows = [], i, j;
    for (i = 0; i < prof.length; i++) {
      var r = prof[i][0], y = prof[i][1];
      var ring = [], c = colorAt ? colorAt(i / (prof.length - 1), r, y) : null;
      if (r < 1e-9) {
        pv.set(0, y, 0); if (mat) pv.applyMatrix4(mat);
        ring.push(part.push(pv.x, pv.y, pv.z, c));
        for (j = 1; j < seg; j++) ring.push(ring[0]);
      } else {
        for (j = 0; j < seg; j++) {
          var a = j / seg * Math.PI * 2;
          pv.set(Math.cos(a) * r, y, Math.sin(a) * r);
          if (mat) pv.applyMatrix4(mat);
          ring.push(part.push(pv.x, pv.y, pv.z, c));
        }
      }
      rows.push(ring);
    }
    for (i = 0; i < prof.length - 1; i++) {
      for (j = 0; j < seg; j++) {
        var k = (j + 1) % seg;
        var a = rows[i][j], b = rows[i][k], c2 = rows[i + 1][k], d = rows[i + 1][j];
        if (a === b || c2 === d) { part.triSafe(a, c2, d); part.triSafe(a, b, c2); }
        else part.quad(a, b, c2, d);
      }
    }
  }

  /* 椭球（用于瘦果），matrix 定义位置与朝向，axes 为三轴半径 */
  function ellipsoid(part, opts) {
    var THREE = opts.THREE;
    var m = opts.matrix, A = opts.axes;
    var nu = opts.nu || 4, nv = opts.nv || 7;
    var colorAt = opts.colorAt || null;
    var rows = [], i, j;
    var v3 = new THREE.Vector3();
    /* 两端极点单独生成，避免退化三角形 */
    var poleA = new THREE.Vector3(0, A[1], 0).applyMatrix4(m);
    var poleB = new THREE.Vector3(0, -A[1], 0).applyMatrix4(m);
    var topIdx = part.push(poleA.x, poleA.y, poleA.z, colorAt ? colorAt(0, 0) : null);
    for (i = 1; i <= nu - 1; i++) {
      var u = i / nu * Math.PI;
      var ring = [];
      for (j = 0; j < nv; j++) {
        var v = j / nv * Math.PI * 2;
        var sx = Math.sin(u) * Math.cos(v);
        var sy = Math.cos(u);
        var sz = Math.sin(u) * Math.sin(v);
        /* 瘦果外形：外端略收窄 */
        var taper = 1 - 0.16 * clamp(sx, 0, 1);
        v3.set(sx * A[0], sy * A[1] * taper, sz * A[2] * taper).applyMatrix4(m);
        var c = colorAt ? colorAt(i / nu, j / nv) : null;
        ring.push(part.push(v3.x, v3.y, v3.z, c));
      }
      rows.push(ring);
    }
    var botIdx = part.push(poleB.x, poleB.y, poleB.z, colorAt ? colorAt(1, 0) : null);
    for (j = 0; j < nv; j++) {
      var k = (j + 1) % nv;
      part.tri(topIdx, rows[0][k], rows[0][j]);
      part.tri(botIdx, rows[rows.length - 1][j], rows[rows.length - 1][k]);
    }
    for (i = 0; i < rows.length - 1; i++) {
      for (j = 0; j < nv; j++) {
        var k2 = (j + 1) % nv;
        part.quad(rows[i][j], rows[i][k2], rows[i + 1][k2], rows[i + 1][j]);
      }
    }
  }

  /* ==========================================================================
   * 零件轮廓
   * ========================================================================*/

  /* 舌状花（花瓣）半宽剖面：倒卵形，顶端圆钝并带小缺刻 */
  function petalHalfWidth(u, notch) {
    var w = 0.30 + 0.70 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.7);
    var tip = Math.sqrt(Math.max(0, 1 - Math.pow(u, 9)));
    var root = Math.pow(Math.min(1, u / 0.10), 0.5);
    var n = 1;
    if (notch && u > 0.90) {
      n = 1 - 0.05 * (1 - Math.abs(Math.sin(Math.PI * u * 3)));
    }
    return w * tip * root * n;
  }
  /* 总苞片半宽剖面：基部最宽，向尖端渐尖 */
  function bractHalfWidth(u) {
    var w = 0.52 + 0.48 * Math.sin(Math.PI * Math.min(1, u * 1.7));
    return w * Math.pow(1 - u, 0.85);
  }

  /* 带厚度与弯曲的带状面（花瓣、苞片共用）
   * 局部坐标：+X 为长度方向，+Z 为宽度方向，+Y 为正面法线 */
  function ribbonGrid(opts) {
    var THREE = opts.THREE;
    var nu = opts.nu || 14, nv = opts.nv || 8;
    var L = opts.length, W = opts.width;
    var curl = opts.curl || 0, cup = opts.cup || 0, roll = opts.roll || 0;
    var twist = opts.twist || 0, jitter = opts.jitter || 0;
    var rand = opts.rand || Math.random;
    var hwFn = opts.halfWidth;
    var mat = opts.matrix;
    var grid = [], i, j;
    for (i = 0; i <= nu; i++) {
      var u = i / nu;
      var hw = W * hwFn(u, opts.notch);
      var row = [];
      for (j = 0; j <= nv; j++) {
        var v = -1 + 2 * j / nv;
        var x = L * u;
        /* 顶端小缺刻（3 浅齿） */
        if (opts.tipTeeth) {
          x -= opts.tipTeeth * L * 0.085 * smoothstep(0.78, 1, u)
            * (0.5 - 0.5 * Math.cos(3 * Math.PI * (v * 0.5 + 0.5)));
        }
        var y = -curl * L * Math.pow(u, 2.1);
        var z = v * hw;
        /* 横截面浅槽：边缘上翘、中脉略凹 */
        var cy = cup * W * (v * v - 0.34);
        /* 纵向脉纹 */
        if (opts.ribs) cy += opts.ribs * W * 0.016 * Math.cos(opts.ribs * Math.PI * v)
          * smoothstep(0.05, 0.55, u);
        /* 沿长度方向扭转 */
        var a = twist * u;
        var zr = z * Math.cos(a) - cy * Math.sin(a);
        var yr = z * Math.sin(a) + cy * Math.cos(a);
        var wob = jitter ? (rand() - 0.5) * jitter * W : 0;
        var p = new THREE.Vector3(x, y + yr + wob, zr);
        var wob2 = jitter ? (rand() - 0.5) * jitter * L * 0.02 : 0;
        if (roll) p.y += roll * W * Math.pow(u, 1.5) * Math.abs(v);
        p.applyMatrix4(mat);
        p.addScaledVector(opts.jitterDir || new THREE.Vector3(0, 0, 0), wob2);
        row.push(p);
      }
      grid.push(row);
    }
    return grid;
  }

  /* 心形叶片轮廓（经典 heart curve），返回归一化到 [0,1] 的平面点 */
  function heartOutline(n) {
    var pts = [], k, t;
    for (k = 0; k < n; k++) {
      t = k / n * Math.PI * 2;
      pts.push([
        16 * Math.pow(Math.sin(t), 3),
        13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      ]);
    }
    var xmax = 0, ymin = 1e9, ymax = -1e9;
    for (k = 0; k < n; k++) {
      xmax = Math.max(xmax, Math.abs(pts[k][0]));
      ymin = Math.min(ymin, pts[k][1]);
      ymax = Math.max(ymax, pts[k][1]);
    }
    return { pts: pts, xmax: xmax, ymin: ymin, ymax: ymax };
  }

  /* 叶片：极坐标扇形网格 + 中脉/侧脉/锯齿/下垂 */
  function leafGrid(opts) {
    var THREE = opts.THREE;
    var out = opts.outline, L = opts.length, W = opts.width;
    var nRows = opts.rows || 9, nCols = opts.cols || 104;
    var mat = opts.matrix;
    var jitter = opts.jitter || 0, rand = opts.rand || Math.random;
    var Zc = 0.30 * L;                       /* 扇形中心（叶内一点） */
    var grid = [], i, j;
    for (i = 0; i <= nRows; i++) {
      var s = i / nRows;
      var row = [];
      for (j = 0; j < nCols; j++) {
        /* 边缘锯齿 */
        var serr = 1 + 0.028 * Math.sin(j / nCols * Math.PI * 2 * 13)
          + (jitter ? (rand() - 0.5) * jitter : 0);
        var raw = out.pts[j];
        var X = raw[0] / out.xmax * (W / 2) * serr;
        var Z = (out.ymax - raw[1]) / (out.ymax - out.ymin) * L * serr;
        /* 由扇形中心向轮廓插值 */
        var px = X * s, pz = Zc + (Z - Zc) * s;
        /* 起伏：下垂 + 沿中脉折起 + 主脉/侧脉隆起 */
        var r = Math.sqrt(px * px + pz * pz) ;
        var ang = Math.atan2(px, Math.max(1e-6, pz));
        var edge = 1 - s;
        var midrib = Math.exp(-Math.pow(px / (0.022 * W + 1e-6), 2));
        var veins = Math.cos(7 * ang) * smoothstep(0.05, 0.4, r / L) * Math.pow(edge, 0.55);
        var droop = -0.30 * L * Math.pow(pz / L, 2.0);
        var fold = 0.085 * Math.abs(px);
        var relief = 0.030 * L * (0.85 * midrib + 0.35 * veins * (1 - midrib * 0.5));
        var y = droop + fold + relief;
        var p = new THREE.Vector3(px, y, pz);
        p.applyMatrix4(mat);
        row.push({ p: p, midrib: midrib, veins: veins, s: s, edge: edge });
      }
      grid.push(row);
    }
    return grid;
  }

  /* ==========================================================================
   * 主构建函数
   * ========================================================================*/
  function buildSunflower(THREE, options) {
    var P = Object.assign({
      stemHeight: 47,          /* 花盘中心高度 cm */
      stemBaseRadius: 0.62,
      stemTopRadius: 0.33,
      headTilt: 24,            /* 花头偏离竖直方向的角度 */
      headAzimuth: 0,          /* 花头朝向方位角 */
      diskRadius: 7.2,         /* 花盘半径 cm */
      diskBulge: 0.075,        /* 花盘正面隆起比例 */
      /* 花托边缘(-0.125R)到背面最深处的高度，取原值 (1.03-0.125)R 的三分之一 */
      receptacleDepth: 0.125 + (1.03 - 0.125) / 3,
      florets: 1000,           /* 花盘小花总数（黄金角螺旋排布） */
      openFrom: 0.60,          /* 该半径比例以外为开放小花 */
      bractWhorls: [
        { count: 14, length: 5.6, width: 1.35, pitch: -34, cup: 0.45 },
        { count: 12, length: 4.6, width: 1.15, pitch: -58, cup: 0.5 }
      ],
      petalWhorls: [
        { count: 24, length: 5.9, width: 1.22, baseR: 1.005, pitch: -6, curl: 0.32, cup: 0.34, twist: 0.30 },
        { count: 18, length: 4.7, width: 1.10, baseR: 0.965, pitch: 15, curl: 0.24, cup: 0.30, twist: -0.22 }
      ],
      leaves: [
        { at: 0.17, az: 10, length: 14.0, width: 11.8, petiole: 5.6, rise: 15, droop: 32 },
        { at: 0.36, az: 196, length: 13.4, width: 11.2, petiole: 5.1, rise: 19, droop: 30 },
        { at: 0.55, az: 42, length: 11.8, width: 9.8, petiole: 4.3, rise: 25, droop: 25 },
        { at: 0.72, az: 232, length: 10.2, width: 8.5, petiole: 3.6, rise: 31, droop: 21 },
        { at: 0.87, az: 128, length: 8.2, width: 6.9, petiole: 2.8, rise: 37, droop: 17 }
      ],
      seed: 20240918,
      hairs: 220,              /* 茎干细毛数量，0 为不生成 */
      stemQuality: 90,
      petalThickness: 0.030,
      leafThickness: 0.035,
      bractThickness: 0.030
    }, options || {});

    var rand = mulberry32(P.seed);
    var parts = {};
    function part(name, material) {
      if (!parts[name]) parts[name] = new Part(name, material);
      return parts[name];
    }

    var R = P.diskRadius;
    var tilt = P.headTilt * D2R, az = P.headAzimuth * D2R;
    var headDir = new THREE.Vector3(
      Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
    var headPos = new THREE.Vector3(0, P.stemHeight, 0);
    var refZ = new THREE.Vector3(0, 0, 1);
    var zAxis = new THREE.Vector3().copy(refZ)
      .addScaledVector(headDir, -refZ.dot(headDir)).normalize();
    var xAxis = new THREE.Vector3().crossVectors(headDir, zAxis).normalize();
    var headMat = new THREE.Matrix4().makeBasis(xAxis, headDir, zAxis).setPosition(headPos);

    function diskY(r) { var t = r / R; return R * P.diskBulge * (1 - t * t); }
    /* 旋转面 y(r)=R·b·(1-t²) 的外法线：径向外分量 2bt、竖向 1 */
    function diskNormal(r, rad) {
      var t = r / R;
      return new THREE.Vector3()
        .addScaledVector(rad, 2 * P.diskBulge * t)
        .add(new THREE.Vector3(0, 1, 0)).normalize();
    }

    /* ---------------------------------------------------------- 1. 茎干 */
    /* 茎干末端须埋进花托内部；花托越扁，衔接点越靠近花盘平面 */
    var backOffset = R * Math.min(0.80, Math.max(0.12, P.receptacleDepth * 0.72));
    var headBack = headPos.clone().addScaledVector(headDir, -backOffset);
    var spineCtrl = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.9, P.stemHeight * 0.26, -0.5),
      new THREE.Vector3(-1.1, P.stemHeight * 0.52, 0.9),
      new THREE.Vector3(0.6, P.stemHeight * 0.74, 0.2),
      headBack.clone().addScaledVector(headDir, -P.stemHeight * 0.10),
      headBack
    ];
    var stemCurve = new THREE.CatmullRomCurve3(spineCtrl, false, 'catmullrom', 0.5);
    var stemPts = stemCurve.getPoints(P.stemQuality);
    var stemPart = part('stem', 'stem');
    tubeSolid(stemPart, {
      THREE: THREE,
      spine: stemPts,
      radialSegments: 14,
      radius: function (t) {
        var r = lerp(P.stemBaseRadius, P.stemTopRadius, Math.pow(t, 0.85));
        r *= 1 + 0.16 * Math.exp(-t * 26);            /* 基部略膨大 */
        r *= 1 + 0.55 * Math.exp(-Math.pow((t - 1) / 0.05, 2)); /* 花梗顶端膨大 */
        return r;
      },
      colorAt: function (t, ph) {
        var base = rgb(PALETTE.stem);
        var dark = rgb(PALETTE.stemDark);
        var shade = 0.5 + 0.5 * Math.cos(ph * Math.PI * 2);
        return mixRGB(base, dark, 0.30 + 0.45 * shade * (1 - t * 0.5));
      }
    });

    /* 茎干上的细毛：短小的锥体只在近处可见，用少量线段感的细管代替 */
    var hairPart = part('hair', 'stem');
    var hairN = Math.max(0, P.hairs | 0);
    for (var hi = 0; hi < hairN; hi++) {
      var ht = 0.03 + 0.94 * rand();
      var hp = stemCurve.getPointAt(ht);
      var htan = stemCurve.getTangentAt(ht).normalize();
      var hAz = rand() * Math.PI * 2;
      var hRef = Math.abs(htan.y) < 0.9
        ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      var hn = new THREE.Vector3().crossVectors(htan, hRef).normalize();
      var hb = new THREE.Vector3().crossVectors(htan, hn).normalize();
      var hDir = new THREE.Vector3()
        .addScaledVector(hn, Math.cos(hAz)).addScaledVector(hb, Math.sin(hAz))
        .normalize();
      var hr = lerp(P.stemBaseRadius, P.stemTopRadius, Math.pow(ht, 0.85)) * 0.95;
      var hLen = 0.12 + 0.10 * rand();
      var hStart = hp.clone().addScaledVector(hDir, hr * 0.7);
      var hEnd = hStart.clone()
        .addScaledVector(hDir, hLen)
        .addScaledVector(htan, hLen * 0.55)
        .addScaledVector(new THREE.Vector3(0, 1, 0), hLen * 0.3);
      tubeSolid(hairPart, {
        THREE: THREE, spine: [hStart, hEnd], radialSegments: 4, caps: true,
        radius: function (t) { return 0.022 * (1 - t * 0.85); },
        colorAt: function () { return rgb(PALETTE.stemDark); }
      });
    }

    /* ------------------------------------------------------ 2. 花托与花盘 */
    var recPart = part('receptacle', 'receptacle');
    var recBack = rgb(PALETTE.receptacle);
    /* 花托剖面：正面微鼓 → 边缘 → 厚实圆润的背面（深度由 receptacleDepth 控制） */
    var RD = P.receptacleDepth;
    var RIM_Y = 0.125;                       /* 花托边缘相对花盘平面的深度（×R） */
    /* 背面各控制点按深度比例缩放，改 receptacleDepth 即为整体压扁/加厚 */
    function backY(frac) { return -R * (RIM_Y + (RD - RIM_Y) * frac); }
    var recProfile = [
      [0, diskY(0)],
      [0.26 * R, R * 0.070],
      [0.50 * R, R * 0.056],
      [0.72 * R, R * 0.036],
      [0.88 * R, R * 0.012],
      [0.975 * R, -R * 0.030],
      [1.02 * R, -R * RIM_Y],
      [1.00 * R, backY(0.193)],
      [0.935 * R, backY(0.408)],
      [0.83 * R, backY(0.613)],
      [0.69 * R, backY(0.778)],
      [0.52 * R, backY(0.892)],
      [0.34 * R, backY(0.960)],
      [0.16 * R, backY(0.998)],
      [0, -RD * R]
    ];
    var recFrontT = 6 / (recProfile.length - 1);
    revolveProfile(recPart, {
      THREE: THREE,
      segments: 96,
      matrix: headMat,          /* 花托位于花头处（此前漏掉此变换会导致花托停留在原点） */
      profile: recProfile,
      /* 花盘正面（中心深褐 → 边缘浅褐）之后为花托背面 */
      colorAt: function (t) {
        if (t <= recFrontT) {
          var k = smoothstep(0, recFrontT, t);
          return mixRGB(rgb(PALETTE.seed), rgb(PALETTE.pith), 0.25 + 0.75 * k);
        }
        var u = (t - recFrontT) / (1 - recFrontT);
        return mixRGB(recBack, rgb(PALETTE.receptacleBack), Math.pow(u, 0.7));
      }
    });

    /* 花盘小花 / 瘦果：Fermat 螺旋（黄金角） */
    var floretPart = part('floret', 'floret');
    var seedPart = part('seed', 'seed');
    var goldRad = GOLDEN_ANGLE * D2R;
    var NF = P.florets;
    var seedColA = rgb(PALETTE.seed), seedColB = rgb(PALETTE.seedHi);
    for (var fi = 0; fi < NF; fi++) {
      var fr = R * 0.985 * Math.sqrt((fi + 0.5) / NF);
      var fth = fi * goldRad + (rand() - 0.5) * 0.05;
      var ft = fr / R;
      var cy = diskY(fr);
      var rad = new THREE.Vector3(Math.cos(fth), 0, Math.sin(fth));
      var tang = new THREE.Vector3(-Math.sin(fth), 0, Math.cos(fth));
      var dn = diskNormal(fr, rad);
      var localP = new THREE.Vector3(rad.x * fr, cy, rad.z * fr);
      if (ft > P.openFrom) {
        /* 开放管状小花 */
        var tiltA = lerp(4, 34, smoothstep(P.openFrom, 1.0, ft)) * D2R;
        var axis = new THREE.Vector3()
          .addScaledVector(dn, Math.cos(tiltA))
          .addScaledVector(rad, Math.sin(tiltA)).normalize();
        var bx = new THREE.Vector3().crossVectors(axis, tang).normalize();
        var bz = new THREE.Vector3().crossVectors(bx, axis).normalize();
        var m = new THREE.Matrix4().makeBasis(bx, axis, bz);
        m.setPosition(localP.clone().applyMatrix4(headMat));
        var hgt = 0.40 + 0.10 * smoothstep(P.openFrom, 1.0, ft);
        var rr = 0.094 + 0.016 * rand();
        var rings = [[0, rr * 1.15, 0], [0.35, rr * 1.05, 0.1], [0.72, rr, 0.45], [1.0, rr * 1.18, 1.0]];
        var vvv = new THREE.Vector3();
        var ringIdx = [], nseg = 6;
        for (var ri = 0; ri < rings.length; ri++) {
          var ring = [];
          var c = mixRGB(rgb(PALETTE.floretBase), rgb(PALETTE.floretTip), Math.pow(rings[ri][0], 0.8));
          for (var si = 0; si < nseg; si++) {
            var pa = si / nseg * Math.PI * 2;
            var star = 1 + rings[ri][2] * 0.36 * Math.cos(5 * pa);
            vvv.set(Math.cos(pa) * rings[ri][1] * star, rings[ri][0] * hgt, Math.sin(pa) * rings[ri][1] * star);
            vvv.applyMatrix4(m);
            ring.push(floretPart.push(vvv.x, vvv.y, vvv.z, c));
          }
          ringIdx.push(ring);
        }
        for (var rq = 0; rq < rings.length - 1; rq++) {
          for (var sq = 0; sq < nseg; sq++) {
            var sq2 = (sq + 1) % nseg;
            floretPart.quad(ringIdx[rq][sq], ringIdx[rq][sq2], ringIdx[rq + 1][sq2], ringIdx[rq + 1][sq]);
          }
        }
        var topC = new THREE.Vector3(0, hgt, 0).applyMatrix4(m);
        var botC = new THREE.Vector3(0, -0.05, 0).applyMatrix4(m);
        var tc = floretPart.push(topC.x, topC.y, topC.z, rgb(PALETTE.floretTip));
        var bc = floretPart.push(botC.x, botC.y, botC.z, rgb(PALETTE.floretBase));
        for (var sd = 0; sd < nseg; sd++) {
          var sd2 = (sd + 1) % nseg;
          floretPart.tri(tc, ringIdx[rings.length - 1][sd], ringIdx[rings.length - 1][sd2]);
          floretPart.tri(bc, ringIdx[0][sd2], ringIdx[0][sd]);
        }
      } else {
        /* 成熟瘦果：长轴沿半径方向，略陷入花托 */
        var sz = 0.66 + 0.20 * ft;
        /* 局部正交基：X=径向(长轴) Y=花盘法线 Z=切向，再整体变换到世界坐标 */
        var mLocal = new THREE.Matrix4().makeBasis(rad, dn, tang);
        mLocal.setPosition(localP.clone().addScaledVector(dn, -0.015 * sz / 0.6));
        var mm = headMat.clone().multiply(mLocal);
        ellipsoid(seedPart, {
          THREE: THREE, matrix: mm, axes: [sz * 0.56, sz * 0.21, sz * 0.32],
          nu: 3, nv: 6,
          colorAt: function (u, v) {
            return mixRGB(seedColA, seedColB, 0.25 + 0.6 * Math.abs(Math.cos(v * Math.PI * 2)));
          }
        });
      }
    }

    /* ------------------------------------------------------ 3. 舌状花（花瓣） */
    var petalPart = part('petal', 'petal');
    var pBase = rgb(PALETTE.petalBase), pMid = rgb(PALETTE.petalMid), pTip = rgb(PALETTE.petalTip);
    var whorlCount = P.petalWhorls.length;
    for (var w = 0; w < whorlCount; w++) {
      var wh = P.petalWhorls[w];
      var off = (w === 0 ? 0 : Math.PI / wh.count) + (rand() - 0.5) * 0.03;
      for (var pk = 0; pk < wh.count; pk++) {
        var th = pk / wh.count * Math.PI * 2 + off;
        var pitch = (wh.pitch + (rand() - 0.5) * 7) * D2R;
        var dirOut = new THREE.Vector3(Math.cos(th) * Math.cos(pitch), Math.sin(pitch), Math.sin(th) * Math.cos(pitch));
        var upV = new THREE.Vector3(-Math.cos(th) * Math.sin(pitch), Math.cos(pitch), -Math.sin(th) * Math.sin(pitch));
        var tangv = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
        var baseR = R * wh.baseR;
        var m = new THREE.Matrix4().makeBasis(dirOut, upV, tangv);
        /* 花瓣附着点：花盘边缘，略微下陷 */
        var anchor = new THREE.Vector3(Math.cos(th) * baseR, diskY(baseR) * 0.7, Math.sin(th) * baseR);
        m.setPosition(anchor);
        var world = headMat.clone().multiply(m);
        var L = wh.length * (0.94 + 0.12 * rand());
        var Wd = wh.width * (0.92 + 0.16 * rand());
        var grid = ribbonGrid({
          THREE: THREE, nu: 16, nv: 8, length: L, width: Wd,
          curl: wh.curl * (0.85 + 0.3 * rand()), cup: wh.cup, notch: true,
          tipTeeth: 1, ribs: 4,
          twist: wh.twist * (0.7 + 0.6 * rand()),
          halfWidth: petalHalfWidth, matrix: world, rand: rand
        });
        solidifyGrid(petalPart, grid, {
          THREE: THREE, thickness: P.petalThickness,
          normalHint: new THREE.Vector3(0, 1, 0),
          colorAt: function (u) {
            /* 基部一小段偏橙，其余金黄，尖端转淡 */
            var c = u < 0.22 ? mixRGB(pBase, pMid, u / 0.22)
              : mixRGB(pMid, pTip, (u - 0.22) / 0.78);
            return c;
          }
        });
      }
    }

    /* ---------------------------------------------------------- 4. 总苞片 */
    var bractPart = part('bract', 'bract');
    var bA = rgb(PALETTE.bract), bB = rgb(PALETTE.bractTip);
    for (var bw = 0; bw < P.bractWhorls.length; bw++) {
      var bl = P.bractWhorls[bw];
      var boff = (bw === 0 ? 0 : Math.PI / bl.count) + (rand() - 0.5) * 0.04;
      for (var bk = 0; bk < bl.count; bk++) {
        var bth = bk / bl.count * Math.PI * 2 + boff + (rand() - 0.5) * 0.05;
        var bpitch = (bl.pitch + (rand() - 0.5) * 8) * D2R;
        var bdir = new THREE.Vector3(Math.cos(bth) * Math.cos(bpitch), Math.sin(bpitch), Math.sin(bth) * Math.cos(bpitch));
        var bup = new THREE.Vector3(-Math.cos(bth) * Math.sin(bpitch), Math.cos(bpitch), -Math.sin(bth) * Math.sin(bpitch));
        var btan = new THREE.Vector3(-Math.sin(bth), 0, Math.cos(bth));
        var bR = R * (bw === 0 ? 0.96 : 0.90);
        var bm = new THREE.Matrix4().makeBasis(bdir, bup, btan);
        bm.setPosition(new THREE.Vector3(Math.cos(bth) * bR, -R * 0.06 - bw * R * 0.06, Math.sin(bth) * bR));
        var bworld = headMat.clone().multiply(bm);
        var blen = bl.length * (0.9 + 0.2 * rand());
        var bgrid = ribbonGrid({
          THREE: THREE, nu: 12, nv: 6, length: blen, width: bl.width,
          curl: 0.10, cup: bl.cup, twist: 0.12,
          halfWidth: bractHalfWidth, matrix: bworld, rand: rand
        });
        solidifyGrid(bractPart, bgrid, {
          THREE: THREE, thickness: P.bractThickness,
          normalHint: new THREE.Vector3(0, 1, 0),
          colorAt: function (u, v) {
            var c = mixRGB(bA, bB, Math.pow(u, 1.4));
            return tint(c, 0.88 + 0.14 * (1 - Math.abs(v - 0.5) * 2));
          }
        });
      }
    }

    /* ------------------------------------------------------------ 5. 叶片 */
    var leafPart = part('leaf', 'leaf');
    var petiolePart = part('petiole', 'stem');
    var outline = heartOutline(84);
    var lBase = rgb(PALETTE.leaf), lVein = rgb(PALETTE.leafVein), lEdge = rgb(PALETTE.leafEdge);
    for (var li = 0; li < P.leaves.length; li++) {
      var lf = P.leaves[li];
      var tPos = clamp(lf.at, 0.02, 0.97);
      var attach = stemCurve.getPointAt(tPos);
      var stemR = lerp(P.stemBaseRadius, P.stemTopRadius, Math.pow(tPos, 0.85))
        * (1 + 0.16 * Math.exp(-tPos * 26));
      var azim = (lf.az + (rand() - 0.5) * 12) * D2R;
      var rise = (lf.rise + (rand() - 0.5) * 6) * D2R;
      var outDir = new THREE.Vector3(Math.cos(azim), Math.sin(rise) * 0.8, Math.sin(azim)).normalize();
      var sideUp = new THREE.Vector3().crossVectors(outDir, new THREE.Vector3(0, 1, 0)).normalize();
      var upDir = new THREE.Vector3().crossVectors(sideUp, outDir).normalize();
      /* 叶柄：从茎干斜向外上方伸出 */
      var p0 = attach.clone().addScaledVector(outDir, stemR * 0.5);
      var p1 = p0.clone().addScaledVector(outDir, lf.petiole * 0.55).addScaledVector(upDir, lf.petiole * 0.22);
      var p2 = p0.clone().addScaledVector(outDir, lf.petiole).addScaledVector(upDir, lf.petiole * 0.12);
      tubeSolid(petiolePart, {
        THREE: THREE,
        spine: [p0, p1, p2, p2.clone().addScaledVector(outDir, 0.6)],
        radialSegments: 10,
        radius: function (t) { return lerp(stemR * 0.85, stemR * 0.42, t) * (1 + 0.25 * Math.exp(-t * 6)); },
        colorAt: function (t, ph) { return mixRGB(rgb(PALETTE.stem), rgb(PALETTE.stemDark), 0.25 * (1 - t)); }
      });
      /* 叶片朝向：叶尖背向茎干，并向下垂 */
      var droop = (lf.droop + (rand() - 0.5) * 8) * D2R;
      var leafDir = outDir.clone().multiplyScalar(Math.cos(droop))
        .addScaledVector(upDir, -Math.sin(droop)).normalize();
      /* 右手系：leafSide × leafUp = leafDir，保证叶片不被镜像 */
      var leafSide = new THREE.Vector3().crossVectors(upDir, leafDir).normalize();
      var leafUp = new THREE.Vector3().crossVectors(leafDir, leafSide).normalize();
      var rollA = (rand() - 0.5) * 0.5;
      var rollM = new THREE.Matrix4().makeRotationAxis(leafDir, rollA);
      leafUp.applyMatrix4(rollM); leafSide.applyMatrix4(rollM);
      /* 叶片局部：+X 为宽度，+Y 为叶面法线，+Z 为叶尖方向 */
      var lmat = new THREE.Matrix4().makeBasis(leafSide, leafUp, leafDir);
      /* 使叶片基部的凹口正好落在叶柄末端 */
      var bx0 = p2.clone().addScaledVector(leafDir, -0.19 * lf.length);
      lmat.setPosition(bx0);
      var lg = leafGrid({
        THREE: THREE, outline: outline, length: lf.length, width: lf.width,
        rows: 9, cols: 84, matrix: lmat, rand: rand, jitter: 0.006
      });
      var cs = lg.map(function (row) {
        return row.map(function (o) {
          var ridge = clamp(o.midrib * 0.9 + Math.abs(o.veins) * 0.5, 0, 1);
          var c = mixRGB(lBase, lVein, ridge * 0.75);
          c = mixRGB(c, lEdge, Math.pow(o.edge, 2.2) * 0.55);
          return c;
        });
      });
      var grid = lg.map(function (row) { return row.map(function (o) { return o.p; }); });
      solidifyGrid(leafPart, grid, {
        THREE: THREE, thickness: P.leafThickness, closedCols: true,
        normalHint: leafUp,
        colorAt: function (u, v, i, j) { return cs[i][j]; }
      });
    }

    /* ------------------------------------------------------- 6. 组装网格 */
    var MATERIAL_SPEC = {
      stem: { color: 0xffffff, roughness: 0.88, metalness: 0.0 },
      leaf: { color: 0xffffff, roughness: 0.72, metalness: 0.0 },
      bract: { color: 0xffffff, roughness: 0.80, metalness: 0.0 },
      receptacle: { color: 0xffffff, roughness: 0.85, metalness: 0.0 },
      petal: { color: 0xffffff, roughness: 0.68, metalness: 0.0, side: THREE.DoubleSide },
      floret: { color: 0xffffff, roughness: 0.68, metalness: 0.0 },
      seed: { color: 0xffffff, roughness: 0.62, metalness: 0.0 }
    };
    var materials = {};
    function materialFor(key) {
      if (!materials[key]) {
        var spec = MATERIAL_SPEC[key] || { color: 0xffffff, roughness: 0.8 };
        materials[key] = new THREE.MeshStandardMaterial({
          color: spec.color, roughness: spec.roughness, metalness: spec.metalness,
          vertexColors: true, side: spec.side || THREE.FrontSide,
          flatShading: false, transparent: false
        });
      }
      return materials[key];
    }

    var group = new THREE.Group();
    group.name = 'Sunflower';
    var list = [], tris = 0;
    Object.keys(parts).forEach(function (name) {
      var p = parts[name];
      if (!p.pos.length) return;
      ensureOutward(p);
      var geo = p.toGeometry(THREE);
      var mesh = new THREE.Mesh(geo, materialFor(p.material));
      mesh.name = name;
      mesh.userData.part = name;
      mesh.userData.materialKey = p.material;
      mesh.userData.triangles = p.triangles();
      group.add(mesh);
      tris += p.triangles();
      list.push({ name: name, material: p.material, mesh: mesh, geometry: geo, triangles: p.triangles() });
    });

    var bbox = new THREE.Box3().setFromObject(group);
    var size = new THREE.Vector3();
    bbox.getSize(size);
    return {
      group: group,
      parts: list,
      params: P,
      materials: materials,
      stats: {
        triangles: tris,
        parts: list.length,
        size: { x: size.x, y: size.y, z: size.z },
        bounds: { min: bbox.min.toArray(), max: bbox.max.toArray() }
      }
    };
  }

  return {
    buildSunflower: buildSunflower,
    PALETTE: PALETTE,
    GOLDEN_ANGLE: GOLDEN_ANGLE,
    heartOutline: heartOutline
  };
});
