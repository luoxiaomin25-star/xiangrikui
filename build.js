/* ============================================================================
 * build.js — 生成向日葵模型并导出 3D 文件
 *   node build.js            导出 stl / obj / mtl 并打印自检报告
 * 单位：模型内部为 cm，导出时放大 10 倍为 mm（3D 打印常用单位）
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const THREE = require('./model/three.min.js');
const { buildSunflower } = require('./model/sunflower.js');

const OUT_DIR = __dirname;
const SCALE = 10; /* cm -> mm */

const OVERRIDES = {};
process.argv.slice(2).forEach((a) => {
  const m = /^--([a-zA-Z]+)=([\d.]+)$/.exec(a);
  if (m) OVERRIDES[m[1]] = parseFloat(m[2]);
});

console.log('构建向日葵模型 ...');
const t0 = Date.now();
const model = buildSunflower(THREE, OVERRIDES);
const tBuild = Date.now() - t0;

/* ------------------------------------------------------------ 提取三角面 */
function collectTriangles(model) {
  const tris = [];
  model.group.updateMatrixWorld(true);
  model.parts.forEach((part) => {
    const g = part.geometry;
    const pos = g.attributes.position.array;
    const col = g.attributes.color ? g.attributes.color.array : null;
    const idx = g.index.array;
    const m = part.mesh.matrixWorld;
    const v = new THREE.Vector3();
    for (let k = 0; k < idx.length; k += 3) {
      const tri = { p: [], c: [] };
      for (let e = 0; e < 3; e++) {
        const vi = idx[k + e] * 3;
        v.set(pos[vi], pos[vi + 1], pos[vi + 2]).applyMatrix4(m);
        tri.p.push([v.x, v.y, v.z]);
        if (col) tri.c.push([col[vi], col[vi + 1], col[vi + 2]]);
      }
      tri.part = part.name;
      tris.push(tri);
    }
  });
  return tris;
}

/* ------------------------------------------------------------- 封闭性自检 */
function manifoldReport(model) {
  const rows = [];
  model.parts.forEach((part) => {
    const idx = part.geometry.index.array;
    const pos = part.geometry.attributes.position.array;
    const edges = new Map();
    let degenerate = 0;
    const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k], b = idx[k + 1], c = idx[k + 2];
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (Math.sqrt(nx * nx + ny * ny + nz * nz) / 2 < 1e-9) { degenerate++; continue; }
      for (const [s, t] of [[a, b], [b, c], [c, a]]) {
        const kk = key(s, t);
        edges.set(kk, (edges.get(kk) || 0) + 1);
      }
    }
    let open = 0, nonManifold = 0;
    edges.forEach((n) => { if (n === 1) open++; else if (n > 2) nonManifold++; });
    const groups = countShells(part.geometry);
    rows.push({
      name: part.name,
      tris: idx.length / 3,
      degenerate,
      open,
      nonManifold,
      shells: groups,
      closed: open === 0 && nonManifold === 0
    });
  });
  return rows;
}

/* 用并查集统计独立封闭体数量 */
function countShells(geometry) {
  const idx = geometry.index.array;
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const union = (a, b) => {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let k = 0; k < idx.length; k += 3) {
    union(idx[k], idx[k + 1]);
    union(idx[k + 1], idx[k + 2]);
  }
  const roots = new Set();
  parent.forEach((_, k) => roots.add(find(k)));
  return roots.size;
}

/* --------------------------------------------------------------- STL 导出 */
function writeBinarySTL(tris, file, scale) {
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.write('sunflower (procedural, SunflowerModel)', 0, 40, 'ascii');
  buf.writeUInt32LE(tris.length, 80);
  let off = 84;
  tris.forEach((tri) => {
    const [a, b, c] = tri.p;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    buf.writeFloatLE(nx, off); buf.writeFloatLE(ny, off + 4); buf.writeFloatLE(nz, off + 8);
    off += 12;
    for (const p of tri.p) {
      buf.writeFloatLE(p[0] * scale, off);
      buf.writeFloatLE(p[1] * scale, off + 4);
      buf.writeFloatLE(p[2] * scale, off + 8);
      off += 12;
    }
    buf.writeUInt16LE(0, off); off += 2;
  });
  fs.writeFileSync(file, buf);
  return buf.length;
}

/* ------------------------------------------------------------ OBJ/MTL 导出 */
function writeOBJ(tris, objFile, mtlFile, scale) {
  const parts = [...new Set(tris.map((t) => t.part))];
  const mtlName = path.basename(mtlFile);
  let out = '# 程序化向日葵模型 / procedural sunflower\n';
  out += '# 单位 mm，每行顶点后附 r g b 顶点色\n';
  out += `mtllib ${mtlName}\n`;
  let mtl = '# 向日葵材质\n';
  let base = 1;
  const v = new THREE.Vector3();
  parts.forEach((pname) => {
    const list = tris.filter((t) => t.part === pname);
    const avg = [0, 0, 0];
    out += `\no ${pname}\n`;
    list.forEach((t) => {
      t.p.forEach((p, i) => {
        const c = t.c[i] || [0.5, 0.5, 0.5];
        avg[0] += c[0]; avg[1] += c[1]; avg[2] += c[2];
        out += `v ${(p[0] * scale).toFixed(4)} ${(p[1] * scale).toFixed(4)} ${(p[2] * scale).toFixed(4)}`
          + ` ${c[0].toFixed(4)} ${c[1].toFixed(4)} ${c[2].toFixed(4)}\n`;
      });
    });
    const n = list.length * 3;
    avg[0] /= n; avg[1] /= n; avg[2] /= n;
    out += `usemtl ${pname}\n`;
    list.forEach((t, ti) => {
      const a = base + ti * 3;
      out += `f ${a} ${a + 1} ${a + 2}\n`;
    });
    base += n;
    mtl += `\nnewmtl ${pname}\nKd ${avg[0].toFixed(4)} ${avg[1].toFixed(4)} ${avg[2].toFixed(4)}\n`
      + 'Ka 0.1 0.1 0.1\nKs 0.05 0.05 0.05\nNs 20\nd 1.0\nillum 2\n';
  });
  fs.writeFileSync(objFile, out);
  fs.writeFileSync(mtlFile, mtl);
  return out.length;
}

/* ------------------------------------------------------------------ 执行 */
const tris = collectTriangles(model);
const report = manifoldReport(model);
const stlBytes = writeBinarySTL(tris, path.join(OUT_DIR, 'sunflower.stl'), SCALE);
writeOBJ(tris, path.join(OUT_DIR, 'sunflower.obj'), path.join(OUT_DIR, 'sunflower.mtl'), SCALE);

const size = model.stats.size;
console.log(`\n构建完成：${tBuild} ms`);
console.log(`三角面 ${tris.length.toLocaleString()}，部件 ${report.length} 个`);
console.log(`尺寸  宽 ${(size.x * SCALE).toFixed(1)} mm × 高 ${(size.y * SCALE).toFixed(1)} mm × 深 ${(size.z * SCALE).toFixed(1)} mm`);
console.log('\n部件自检（open=未闭合边，非流形边应全为 0）：');
console.log('  ' + '部件'.padEnd(12) + '面数'.padStart(9) + '独立体'.padStart(8) + '退化面'.padStart(8) + '未闭合边'.padStart(9) + '非流形'.padStart(8) + '  状态');
report.forEach((r) => {
  console.log('  ' + r.name.padEnd(12)
    + String(r.tris).padStart(9)
    + String(r.shells).padStart(8)
    + String(r.degenerate).padStart(8)
    + String(r.open).padStart(9)
    + String(r.nonManifold).padStart(8)
    + '  ' + (r.closed ? 'OK 闭合' : '需检查'));
});
const bad = report.filter((r) => !r.closed);
console.log(bad.length ? `\n⚠ ${bad.length} 个部件存在开放边` : '\n全部部件为闭合流形，可直接 3D 打印');
console.log(`sunflower.stl  ${(stlBytes / 1048576).toFixed(2)} MB（二进制，单位 mm）`);
console.log('sunflower.obj / sunflower.mtl（含顶点色）');

/* ------------------------------------------------- 小尺寸 3D 打印版本 */
const PRINT_HEIGHT = 200; /* mm */
const printModel = buildSunflower(THREE, Object.assign({}, OVERRIDES, {
  hairs: 0,                 /* 细毛过细，打印时省略 */
  petalThickness: 0.085,    /* 加厚花瓣以便小尺寸打印 */
  leafThickness: 0.090,
  bractThickness: 0.085,
  florets: 620,
  stemBaseRadius: 0.80,
  stemTopRadius: 0.46,
  seed: (OVERRIDES.seed || 20240918)
}));
const printTris = collectTriangles(printModel);
const printScale = PRINT_HEIGHT / printModel.stats.size.y;
const printBytes = writeBinarySTL(printTris, path.join(OUT_DIR, 'sunflower-print.stl'), printScale);
const ps = printModel.stats.size;
console.log(`\n打印版 sunflower-print.stl  ${(printBytes / 1048576).toFixed(2)} MB`);
console.log(`  缩放至高 ${PRINT_HEIGHT} mm（1 cm = ${printScale.toFixed(2)} mm）`
  + `，外形 ${(ps.x * printScale).toFixed(0)} × ${PRINT_HEIGHT} × ${(ps.z * printScale).toFixed(0)} mm`);
console.log(`  最小壁厚约 ${(0.085 * printScale * 10 / 10).toFixed(2)} mm（花瓣）`);
